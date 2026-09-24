-- MS5 — certificado passa a existir em dois escopos: da trilha inteira
-- (modulo_id null, comportamento histórico) ou de um módulo específico
-- (modulo_id preenchido). Colunas próprias congelam os dados de um
-- certificado de módulo, no mesmo espírito das colunas já congeladas para
-- o de trilha (aluno_nome, trilha_nome...).

alter table certificacao.certificados
  -- on delete restrict: módulo com certificado emitido é histórico, igual
  -- ao aluno/trilha — não pode sumir por baixo de um documento existente.
  add column modulo_id uuid null references catalogo.modulos (id) on delete restrict,
  add column modulo_nome text null,
  add column modulo_carga_horaria integer null,
  add column professor_nome text null,
  add column nota_final numeric(4, 2) null,
  add column periodo_inicio date null,
  add column periodo_fim date null;

-- trilha_carga_horaria_total só faz sentido no certificado de trilha.
-- Passa a aceitar null para o certificado de módulo (que usa
-- modulo_carga_horaria); linhas de trilha já existentes mantêm o valor.
alter table certificacao.certificados
  alter column trilha_carga_horaria_total drop not null;

comment on column certificacao.certificados.modulo_id is
  'null = certificado da trilha inteira (histórico); preenchido = certificado de um módulo específico.';

-- A unicidade antiga (aluno_id, trilha_id) não serve mais: no modo "por
-- módulo" há várias linhas por (aluno, trilha), uma por módulo. Dois
-- índices únicos parciais cobrem os dois escopos. IMPORTANTE: uma unique
-- comum não protegeria o certificado de trilha, porque NULL nunca é igual
-- a NULL — daí o índice parcial "where modulo_id is null".
alter table certificacao.certificados drop constraint if exists certificados_aluno_trilha_unico;

create unique index if not exists certificados_trilha_unico
  on certificacao.certificados (aluno_id, trilha_id)
  where modulo_id is null;

create unique index if not exists certificados_modulo_unico
  on certificacao.certificados (aluno_id, modulo_id)
  where modulo_id is not null;

-- Emissão de certificado de UM módulo, disparada quando aquela matrícula
-- específica é concluída (não espera a trilha). Idempotente: os índices
-- parciais garantem no banco, e a violação de unicidade é tratada aqui
-- para não quebrar o trigger. SECURITY DEFINER pelo mesmo motivo de
-- verificar_e_emitir: lê catalogo/selecao/identidade/diario e escreve em
-- certificacao independentemente do papel de quem concluiu a matrícula.
create or replace function certificacao.emitir_certificado_modulo(p_matricula_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_certificado_id uuid;
  v_aluno_id uuid;
  v_modulo_id uuid;
  v_trilha_id uuid;
  v_aluno_nome text;
  v_trilha_nome text;
  v_modulo_nome text;
  v_modulo_carga integer;
  v_professor_nome text;
  v_nota_final numeric;
  v_periodo_inicio date;
  v_periodo_fim date;
begin
  select m.aluno_id, t.modulo_id, t.periodo_inicio, t.periodo_fim, prof.nome_completo
  into v_aluno_id, v_modulo_id, v_periodo_inicio, v_periodo_fim, v_professor_nome
  from selecao.matriculas m
  join selecao.turmas t on t.id = m.turma_id
  join identidade.profiles prof on prof.id = t.professor_id
  where m.id = p_matricula_id;

  if v_modulo_id is null then
    return null;
  end if;

  -- Idempotência (passo 1): já existe certificado deste (aluno, módulo)?
  select id into v_certificado_id
  from certificacao.certificados
  where aluno_id = v_aluno_id and modulo_id = v_modulo_id;
  if v_certificado_id is not null then
    return v_certificado_id;
  end if;

  select mo.nome, mo.carga_horaria_horas, mo.trilha_id
  into v_modulo_nome, v_modulo_carga, v_trilha_id
  from catalogo.modulos mo where mo.id = v_modulo_id;

  select nome_completo into v_aluno_nome from identidade.profiles where id = v_aluno_id;
  select nome into v_trilha_nome from catalogo.trilhas where id = v_trilha_id;
  v_nota_final := diario.media_ponderada(p_matricula_id);

  begin
    insert into certificacao.certificados (
      hash_publico, aluno_id, trilha_id, modulo_id, aluno_nome, trilha_nome,
      trilha_carga_horaria_total, modulo_nome, modulo_carga_horaria,
      professor_nome, nota_final, periodo_inicio, periodo_fim
    ) values (
      certificacao.gerar_hash_publico(), v_aluno_id, v_trilha_id, v_modulo_id, v_aluno_nome,
      v_trilha_nome, null, v_modulo_nome, v_modulo_carga,
      v_professor_nome, v_nota_final, v_periodo_inicio, v_periodo_fim
    )
    returning id into v_certificado_id;
  exception when unique_violation then
    -- Corrida rara: outra transação emitiu o mesmo (aluno, módulo) entre o
    -- passo 1 e o insert. Mantém idempotência retornando o existente.
    select id into v_certificado_id
    from certificacao.certificados
    where aluno_id = v_aluno_id and modulo_id = v_modulo_id;
  end;

  return v_certificado_id;
end;
$$;

-- Emissão automática agora respeita o tipo de certificação da trilha.
-- 'trilha' (default): só emite quando todos os módulos estão concluídos.
-- 'modulo': emite um certificado para esta matrícula assim que concluída.
create or replace function certificacao.ao_concluir_matricula()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trilha_id uuid;
  v_tipo catalogo.tipo_certificacao;
begin
  if new.status = 'concluida' and old.status is distinct from 'concluida' then
    select mo.trilha_id, tr.tipo_certificacao
    into v_trilha_id, v_tipo
    from selecao.turmas t
    join catalogo.modulos mo on mo.id = t.modulo_id
    join catalogo.trilhas tr on tr.id = mo.trilha_id
    where t.id = new.turma_id;

    if v_trilha_id is not null then
      if v_tipo = 'modulo' then
        perform certificacao.emitir_certificado_modulo(new.id);
      else
        perform certificacao.verificar_e_emitir(new.aluno_id, v_trilha_id);
      end if;
    end if;
  end if;
  return null; -- AFTER trigger: retorno não é usado.
end;
$$;
