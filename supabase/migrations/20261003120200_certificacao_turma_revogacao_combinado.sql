-- MS5 — certificação completa (itens C8, G6, G7 e S5 da auditoria):
--   * turma congelada no certificado de módulo (G7);
--   * revogação: o certificado continua existindo, marcado como revogado
--     (G6 — desfazer encerramento de quem já tinha certificado);
--   * modo combinado 'modulo_e_trilha' e correção de verificar_e_emitir,
--     que nunca emitia o da trilha se já houvesse um de módulo (C8);
--   * verificação pública passa a dizer se é de módulo ou de trilha, a
--     turma e se foi revogado (S5).
-- A emissão deixa de ler selecao.matriculas/selecao.turmas direto: usa as
-- funções nomeadas do MS3 abaixo (fronteira de contexto do CLAUDE.md).

-- ---------------------------------------------------------------------------
-- MS3 — leituras para a certificação. Fechadas para a API: só as funções
-- definer do MS5 (dono postgres) e o service_role chamam.

-- Dados de UMA matrícula que a certificação congela no documento.
create or replace function selecao.resumo_matricula(p_matricula_id uuid)
returns table (
  aluno_id uuid,
  turma_id uuid,
  turma_codigo text,
  modulo_id uuid,
  professor_id uuid,
  periodo_inicio date,
  periodo_fim date,
  status selecao.status_matricula,
  encerrada_em timestamptz
)
language sql
security definer
stable
set search_path = ''
as $$
  select m.aluno_id, t.id, t.codigo, t.modulo_id, t.professor_id,
         t.periodo_inicio, t.periodo_fim, m.status, m.encerrada_em
  from selecao.matriculas m
  join selecao.turmas t on t.id = m.turma_id
  where m.id = p_matricula_id;
$$;

-- Uma linha por módulo que o aluno concluiu: a matrícula concluída mais
-- recente de cada módulo (pode haver mais de uma ao longo do tempo).
create or replace function selecao.modulos_concluidos_do_aluno(p_aluno_id uuid)
returns table (
  matricula_id uuid,
  modulo_id uuid,
  turma_id uuid,
  turma_codigo text,
  professor_id uuid,
  periodo_inicio date,
  periodo_fim date,
  encerrada_em timestamptz
)
language sql
security definer
stable
set search_path = ''
as $$
  select distinct on (t.modulo_id)
    m.id, t.modulo_id, t.id, t.codigo, t.professor_id,
    t.periodo_inicio, t.periodo_fim, m.encerrada_em
  from selecao.matriculas m
  join selecao.turmas t on t.id = m.turma_id
  where m.aluno_id = p_aluno_id
    and m.status = 'concluida'
  order by t.modulo_id, m.encerrada_em desc nulls last;
$$;

revoke execute on function selecao.resumo_matricula(uuid) from public, anon, authenticated;
revoke execute on function selecao.modulos_concluidos_do_aluno(uuid) from public, anon, authenticated;
grant execute on function selecao.resumo_matricula(uuid) to service_role;
grant execute on function selecao.modulos_concluidos_do_aluno(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Colunas novas.
alter table certificacao.certificados
  -- Matrícula que originou o certificado de MÓDULO. É o que liga o
  -- documento ao "desfazer encerramento" daquela matrícula. null no
  -- certificado de trilha (que consolida várias matrículas).
  add column if not exists matricula_id uuid null references selecao.matriculas (id) on delete restrict,
  -- Código da turma CONGELADO na emissão: a coordenação pode editar o
  -- código da turma depois, e o PDF precisa sair sempre igual.
  add column if not exists turma_codigo text null,
  -- Revogação. O certificado não é apagado (pode já ter circulado); a
  -- verificação pública passa a mostrá-lo como revogado.
  add column if not exists revogado_em timestamptz null,
  add column if not exists revogado_por uuid null references identidade.profiles (id) on delete restrict,
  add column if not exists motivo_revogacao text null;

alter table certificacao.certificados
  add constraint certificados_revogacao_completa check (
    (revogado_em is null and motivo_revogacao is null and revogado_por is null)
    or (revogado_em is not null and char_length(btrim(motivo_revogacao)) >= 10)
  );

comment on column certificacao.certificados.turma_codigo is
  'Código da turma congelado na emissão (só certificado de módulo).';
comment on column certificacao.certificados.revogado_em is
  'Preenchido quando o encerramento que gerou o certificado é desfeito. O documento continua existindo e aparece como revogado na verificação pública.';

-- Certificados de módulo já emitidos: liga à matrícula concluída do
-- módulo e congela o código da turma de agora (melhor informação
-- disponível; o código atual é o mesmo de quando foi emitido, salvo edição).
update certificacao.certificados c
set matricula_id = mc.matricula_id,
    turma_codigo = mc.turma_codigo
from (
  select distinct c2.aluno_id from certificacao.certificados c2 where c2.modulo_id is not null
) alunos
cross join lateral selecao.modulos_concluidos_do_aluno(alunos.aluno_id) mc
where c.modulo_id is not null
  and c.aluno_id = alunos.aluno_id
  and c.modulo_id = mc.modulo_id
  and c.matricula_id is null;

-- Unicidade só entre os NÃO revogados: depois de desfazer e reencerrar,
-- a nova conclusão gera um documento novo (com hash novo) sem apagar o
-- revogado.
drop index if exists certificacao.certificados_trilha_unico;
drop index if exists certificacao.certificados_modulo_unico;

create unique index certificados_trilha_unico
  on certificacao.certificados (aluno_id, trilha_id)
  where modulo_id is null and revogado_em is null;

create unique index certificados_modulo_unico
  on certificacao.certificados (aluno_id, modulo_id)
  where modulo_id is not null and revogado_em is null;

create index if not exists certificados_matricula_id_idx
  on certificacao.certificados (matricula_id);

-- ---------------------------------------------------------------------------
-- Emissão do certificado de UM módulo. Recriada a partir de 20260924005855:
--   * só emite se a matrícula está 'concluida' (S1: mesmo que alguém
--     consiga chamar, não sai certificado de matrícula em curso);
--   * congela turma_codigo e guarda matricula_id;
--   * idempotência considera só certificados não revogados.
-- EXECUTE fechado para a API (migration de segurança); quem chama é o
-- trigger ao_concluir_matricula.
create or replace function certificacao.emitir_certificado_modulo(p_matricula_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_certificado_id uuid;
  v_matricula record;
  v_trilha_id uuid;
  v_aluno_nome text;
  v_trilha_nome text;
  v_modulo_nome text;
  v_modulo_carga integer;
  v_professor_nome text;
  v_nota_final numeric;
begin
  select * into v_matricula from selecao.resumo_matricula(p_matricula_id);

  if v_matricula.modulo_id is null or v_matricula.status is distinct from 'concluida' then
    return null;
  end if;

  select id into v_certificado_id
  from certificacao.certificados
  where aluno_id = v_matricula.aluno_id
    and modulo_id = v_matricula.modulo_id
    and revogado_em is null;
  if v_certificado_id is not null then
    return v_certificado_id;
  end if;

  select mo.nome, mo.carga_horaria_horas, mo.trilha_id
  into v_modulo_nome, v_modulo_carga, v_trilha_id
  from catalogo.modulos mo where mo.id = v_matricula.modulo_id;

  select nome_completo into v_aluno_nome from identidade.profiles where id = v_matricula.aluno_id;
  select nome_completo into v_professor_nome from identidade.profiles where id = v_matricula.professor_id;
  select nome into v_trilha_nome from catalogo.trilhas where id = v_trilha_id;
  -- Cálculo sem guarda: a emissão já é consequência de um encerramento
  -- autorizado (ver migration de segurança).
  v_nota_final := diario.calcular_media_ponderada(p_matricula_id);

  begin
    insert into certificacao.certificados (
      hash_publico, aluno_id, trilha_id, modulo_id, matricula_id, turma_codigo,
      aluno_nome, trilha_nome, trilha_carga_horaria_total, modulo_nome,
      modulo_carga_horaria, professor_nome, nota_final, periodo_inicio, periodo_fim
    ) values (
      certificacao.gerar_hash_publico(), v_matricula.aluno_id, v_trilha_id,
      v_matricula.modulo_id, p_matricula_id, v_matricula.turma_codigo,
      v_aluno_nome, v_trilha_nome, null, v_modulo_nome,
      v_modulo_carga, v_professor_nome, v_nota_final,
      v_matricula.periodo_inicio, v_matricula.periodo_fim
    )
    returning id into v_certificado_id;
  exception when unique_violation then
    -- Corrida rara: outra transação emitiu o mesmo (aluno, módulo).
    select id into v_certificado_id
    from certificacao.certificados
    where aluno_id = v_matricula.aluno_id
      and modulo_id = v_matricula.modulo_id
      and revogado_em is null;
  end;

  return v_certificado_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Certificado da TRILHA. Recriada a partir de 20260915223946 (definição
-- única). Correção do C8: a busca do "já existe" filtrava só (aluno,
-- trilha) — havendo certificado de MÓDULO dessa trilha, devolvia o de
-- módulo e nunca emitia o da trilha (inclusive no bloco de
-- unique_violation). Agora filtra modulo_id is null e não revogado.
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
  select id into v_certificado_id
  from certificacao.certificados
  where aluno_id = p_aluno_id and trilha_id = p_trilha_id
    and modulo_id is null and revogado_em is null;
  if v_certificado_id is not null then
    return v_certificado_id;
  end if;

  select count(*) into v_total_modulos
  from catalogo.modulos where trilha_id = p_trilha_id;

  -- Trilha sem módulo não emite certificado — não há o que reconhecer.
  if v_total_modulos = 0 then
    return null;
  end if;

  select count(*) into v_modulos_concluidos
  from selecao.modulos_concluidos_do_aluno(p_aluno_id) mc
  join catalogo.modulos mo on mo.id = mc.modulo_id
  where mo.trilha_id = p_trilha_id;

  if v_modulos_concluidos < v_total_modulos then
    return null;
  end if;

  select nome_completo into v_aluno_nome from identidade.profiles where id = p_aluno_id;
  select nome, carga_horaria_total into v_trilha_nome, v_carga
  from catalogo.trilhas where id = p_trilha_id;

  -- Um item por módulo, na ordem da trilha. 'turma' entra congelada junto
  -- com os demais dados (o PDF da trilha pode listá-la).
  select jsonb_build_object('modulos', coalesce(jsonb_agg(item order by ordem), '[]'::jsonb))
  into v_metadata
  from (
    select
      mo.ordem as ordem,
      jsonb_build_object(
        'nome', mo.nome,
        'professor', prof.nome_completo,
        'carga_horaria_horas', mo.carga_horaria_horas,
        'nota_final', diario.calcular_media_ponderada(mc.matricula_id),
        'periodo_inicio', mc.periodo_inicio,
        'periodo_fim', mc.periodo_fim,
        'turma', mc.turma_codigo
      ) as item
    from selecao.modulos_concluidos_do_aluno(p_aluno_id) mc
    join catalogo.modulos mo on mo.id = mc.modulo_id
    join identidade.profiles prof on prof.id = mc.professor_id
    where mo.trilha_id = p_trilha_id
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
    select id into v_certificado_id
    from certificacao.certificados
    where aluno_id = p_aluno_id and trilha_id = p_trilha_id
      and modulo_id is null and revogado_em is null;
  end;

  return v_certificado_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Trigger de conclusão: os três modos.
--   'modulo'          → certificado do módulo;
--   'trilha'          → certificado da trilha quando todos os módulos fecham;
--   'modulo_e_trilha' → os dois (o da trilha só quando todos fecham).
create or replace function certificacao.ao_concluir_matricula()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_modulo_id uuid;
  v_trilha_id uuid;
  v_tipo catalogo.tipo_certificacao;
begin
  if new.status = 'concluida' and old.status is distinct from 'concluida' then
    select r.modulo_id into v_modulo_id from selecao.resumo_matricula(new.id) r;

    select mo.trilha_id, tr.tipo_certificacao
    into v_trilha_id, v_tipo
    from catalogo.modulos mo
    join catalogo.trilhas tr on tr.id = mo.trilha_id
    where mo.id = v_modulo_id;

    if v_trilha_id is not null then
      if v_tipo in ('modulo', 'modulo_e_trilha') then
        perform certificacao.emitir_certificado_modulo(new.id);
      end if;
      if v_tipo in ('trilha', 'modulo_e_trilha') then
        perform certificacao.verificar_e_emitir(new.aluno_id, v_trilha_id);
      end if;
    end if;
  end if;
  return null; -- AFTER trigger: retorno não é usado.
end;
$$;

-- ---------------------------------------------------------------------------
-- Revogação ao desfazer o encerramento de uma matrícula (G6). Chamada por
-- diario.desfazer_encerramento / diario.reativar_turma (definer), que já
-- checaram que quem pede é a coordenação. Revoga:
--   * o certificado do MÓDULO daquela matrícula;
--   * o certificado da TRILHA do aluno, se a matrícula estava concluída —
--     com o módulo reaberto a trilha deixa de estar completa.
-- Devolve quantos certificados foram revogados.
create or replace function certificacao.revogar_certificados_da_matricula(p_matricula_id uuid, p_motivo text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_matricula record;
  v_trilha_id uuid;
  v_revogados integer := 0;
  v_n integer;
begin
  if p_motivo is null or char_length(btrim(p_motivo)) < 10 then
    raise exception 'informe o motivo da revogação (mínimo 10 caracteres)';
  end if;

  select * into v_matricula from selecao.resumo_matricula(p_matricula_id);
  if v_matricula.aluno_id is null then
    return 0;
  end if;

  update certificacao.certificados
  set revogado_em = now(), revogado_por = auth.uid(), motivo_revogacao = btrim(p_motivo)
  where matricula_id = p_matricula_id and revogado_em is null;
  get diagnostics v_n = row_count;
  v_revogados := v_revogados + v_n;

  if v_matricula.status = 'concluida' then
    select trilha_id into v_trilha_id from catalogo.modulos where id = v_matricula.modulo_id;

    -- Certificado de módulo antigo, emitido antes de matricula_id existir
    -- e não ligado pelo preenchimento acima: casa por (aluno, módulo).
    update certificacao.certificados
    set revogado_em = now(), revogado_por = auth.uid(), motivo_revogacao = btrim(p_motivo)
    where aluno_id = v_matricula.aluno_id and modulo_id = v_matricula.modulo_id
      and matricula_id is null and revogado_em is null;
    get diagnostics v_n = row_count;
    v_revogados := v_revogados + v_n;

    update certificacao.certificados
    set revogado_em = now(), revogado_por = auth.uid(), motivo_revogacao = btrim(p_motivo)
    where aluno_id = v_matricula.aluno_id and trilha_id = v_trilha_id
      and modulo_id is null and revogado_em is null;
    get diagnostics v_n = row_count;
    v_revogados := v_revogados + v_n;
  end if;

  return v_revogados;
end;
$$;

revoke execute on function certificacao.revogar_certificados_da_matricula(uuid, text) from public, anon, authenticated;
grant execute on function certificacao.revogar_certificados_da_matricula(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- Verificação pública (S5). Muda o tipo de retorno, então é drop + create
-- (create or replace não troca colunas de retorno). Continua devolvendo só
-- dado mínimo e por hash exato; o motivo da revogação NÃO é público.
drop function if exists certificacao.verificar_por_hash(text);

create function certificacao.verificar_por_hash(p_hash text)
returns table (
  aluno_nome text,
  trilha_nome text,
  emitido_em timestamptz,
  tipo text,
  modulo_nome text,
  turma_codigo text,
  revogado boolean,
  revogado_em timestamptz
)
language sql
security definer
stable
set search_path = ''
as $$
  select c.aluno_nome,
         c.trilha_nome,
         c.emitido_em,
         case when c.modulo_id is null then 'trilha' else 'modulo' end,
         c.modulo_nome,
         c.turma_codigo,
         c.revogado_em is not null,
         c.revogado_em
  from certificacao.certificados c
  where c.hash_publico = p_hash;
$$;

revoke execute on function certificacao.verificar_por_hash(text) from public;
grant execute on function certificacao.verificar_por_hash(text) to anon, authenticated, service_role;
