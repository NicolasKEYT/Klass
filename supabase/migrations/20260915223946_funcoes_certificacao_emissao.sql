-- MS5 — Geração de hash público, motor de emissão e trigger de conclusão.
-- Toda função aqui é SECURITY DEFINER porque a emissão precisa ler de
-- múltiplos schemas (catalogo, selecao, diario, identidade) e escrever em
-- certificacao independentemente do papel de quem disparou a conclusão —
-- o gatilho real é um professor encerrando a última matrícula da trilha,
-- que não tem (nem deve ter) permissão de escrita nesses schemas todos.

-- Código no formato KLASS-<ano>-<8 chars>. Alfabeto sem O/0/1/I para o
-- hash ser legível e fácil de digitar na verificação pública; ainda assim
-- todo caractere cai em [A-Z0-9], casando com o check da tabela. Loop de
-- retry cobre a colisão (improvável, mas o unique da tabela é a garantia).
create or replace function certificacao.gerar_hash_publico()
returns text
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_ano text := to_char(now(), 'YYYY');
  v_alfabeto text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_codigo text;
  v_hash text;
  i integer;
begin
  loop
    v_codigo := '';
    for i in 1..8 loop
      v_codigo := v_codigo || substr(v_alfabeto, 1 + floor(random() * length(v_alfabeto))::int, 1);
    end loop;
    v_hash := 'KLASS-' || v_ano || '-' || v_codigo;
    exit when not exists (select 1 from certificacao.certificados where hash_publico = v_hash);
  end loop;
  return v_hash;
end;
$$;

-- O coração do MS5. Idempotente: chamar duas vezes para o mesmo (aluno,
-- trilha) retorna o mesmo id, nunca duplica. Retorna null quando a trilha
-- ainda não está toda concluída — o chamador (trigger) trata isso como
-- "ainda não fechou a trilha", não como erro.
create or replace function certificacao.verificar_e_emitir(p_aluno_id uuid, p_trilha_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_certificado_id uuid;
  v_total_modulos integer;
  v_modulos_concluidos integer;
  v_aluno_nome text;
  v_trilha_nome text;
  v_carga integer;
  v_metadata jsonb;
begin
  -- 1. Já existe? Retorna o existente e sai (idempotência).
  select id into v_certificado_id
  from certificacao.certificados
  where aluno_id = p_aluno_id and trilha_id = p_trilha_id;
  if v_certificado_id is not null then
    return v_certificado_id;
  end if;

  -- 2. Quantos módulos a trilha tem.
  select count(*) into v_total_modulos
  from catalogo.modulos where trilha_id = p_trilha_id;

  -- Trilha sem módulo não emite certificado — não há o que reconhecer.
  if v_total_modulos = 0 then
    return null;
  end if;

  -- 3. Quantos desses módulos o aluno concluiu (matrícula 'concluida' numa
  -- turma daquele módulo). distinct porque um módulo pode ter tido mais de
  -- uma matrícula ao longo do tempo.
  select count(distinct t.modulo_id) into v_modulos_concluidos
  from selecao.matriculas m
  join selecao.turmas t on t.id = m.turma_id
  join catalogo.modulos mo on mo.id = t.modulo_id
  where m.aluno_id = p_aluno_id
    and mo.trilha_id = p_trilha_id
    and m.status = 'concluida';

  -- 4. Falta concluir algum módulo -> ainda não emite.
  if v_modulos_concluidos < v_total_modulos then
    return null;
  end if;

  -- 5. Emite com todos os dados congelados no momento da emissão.
  select nome_completo into v_aluno_nome from identidade.profiles where id = p_aluno_id;
  select nome, carga_horaria_total into v_trilha_nome, v_carga
  from catalogo.trilhas where id = p_trilha_id;

  -- metadata: um item por módulo (distinct on escolhe a matrícula concluída
  -- mais recente se houver mais de uma), na ordem da trilha, com professor
  -- e nota final vinda da média ponderada do MS4.
  select jsonb_build_object('modulos', coalesce(jsonb_agg(item order by ordem), '[]'::jsonb))
  into v_metadata
  from (
    select distinct on (mo.id)
      mo.ordem as ordem,
      jsonb_build_object(
        'nome', mo.nome,
        'professor', prof.nome_completo,
        'carga_horaria_horas', mo.carga_horaria_horas,
        'nota_final', diario.media_ponderada(m.id),
        'periodo_inicio', t.periodo_inicio,
        'periodo_fim', t.periodo_fim
      ) as item
    from selecao.matriculas m
    join selecao.turmas t on t.id = m.turma_id
    join catalogo.modulos mo on mo.id = t.modulo_id
    join identidade.profiles prof on prof.id = t.professor_id
    where m.aluno_id = p_aluno_id
      and mo.trilha_id = p_trilha_id
      and m.status = 'concluida'
    order by mo.id, m.encerrada_em desc nulls last
  ) itens;

  begin
    insert into certificacao.certificados (
      hash_publico, aluno_id, trilha_id, aluno_nome, trilha_nome,
      trilha_carga_horaria_total, metadata
    ) values (
      certificacao.gerar_hash_publico(), p_aluno_id, p_trilha_id, v_aluno_nome,
      v_trilha_nome, v_carga, v_metadata
    )
    returning id into v_certificado_id;
  exception when unique_violation then
    -- Corrida rara: outra transação emitiu o mesmo (aluno, trilha) entre o
    -- passo 1 e o insert. Mantém a idempotência retornando o que já existe.
    select id into v_certificado_id
    from certificacao.certificados
    where aluno_id = p_aluno_id and trilha_id = p_trilha_id;
  end;

  return v_certificado_id;
end;
$$;

-- Emissão automática (atributo 1 do MS5): reage à conclusão de uma
-- matrícula. Coreografia orientada a eventos do CLAUDE.md — a mudança de
-- estado em selecao.matriculas dispara a reação que pertence ao
-- certificacao, sem o MS4 conhecer o MS5.
create or replace function certificacao.ao_concluir_matricula()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trilha_id uuid;
begin
  -- Só a transição para 'concluida' interessa — encerrar como 'reprovada'
  -- ou qualquer update que não mexe no status não deve reprocessar.
  if new.status = 'concluida' and old.status is distinct from 'concluida' then
    select mo.trilha_id into v_trilha_id
    from selecao.turmas t
    join catalogo.modulos mo on mo.id = t.modulo_id
    where t.id = new.turma_id;

    if v_trilha_id is not null then
      -- Retorno ignorado: emitiu (id) ou ainda faltam módulos (null); os
      -- dois casos são normais.
      perform certificacao.verificar_e_emitir(new.aluno_id, v_trilha_id);
    end if;
  end if;
  return null; -- AFTER trigger: retorno não é usado.
end;
$$;

drop trigger if exists matriculas_emitir_certificado on selecao.matriculas;
create trigger matriculas_emitir_certificado
  after update on selecao.matriculas
  for each row
  execute function certificacao.ao_concluir_matricula();
