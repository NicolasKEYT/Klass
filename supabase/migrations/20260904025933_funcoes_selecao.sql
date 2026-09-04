-- MS3 — validações de negócio. As cinco funções abaixo são SECURITY
-- DEFINER porque precisam enxergar dado de outros usuários (quantas
-- matrículas uma turma tem, se um aluno concluiu outra trilha) mesmo
-- quando quem dispara o trigger é o próprio aluno, cuja RLS normalmente
-- só deixaria ver a própria linha.

create or replace function selecao.professor_da_turma(p_profile_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from identidade.profiles where id = p_profile_id and papel = 'professor'
  );
$$;

create or replace function selecao.aluno_da_matricula(p_profile_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from identidade.profiles where id = p_profile_id and papel = 'aluno'
  );
$$;

create or replace function selecao.validar_pre_requisitos_trilha(p_aluno_id uuid, p_trilha_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_faltantes text;
begin
  select string_agg(t.nome, ', ')
  into v_faltantes
  from selecao.pre_requisitos_trilha pr
  join catalogo.trilhas t on t.id = pr.trilha_requisito_id
  where pr.trilha_id = p_trilha_id
    and not exists (
      select 1
      from selecao.matriculas m
      join selecao.turmas tu on tu.id = m.turma_id
      where m.aluno_id = p_aluno_id
        and tu.trilha_id = pr.trilha_requisito_id
        and m.status = 'concluida'
    );

  if v_faltantes is not null then
    raise exception 'Você precisa concluir a trilha % antes de se inscrever nesta.', v_faltantes;
  end if;
end;
$$;

create or replace function selecao.checar_vaga_disponivel(p_turma_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ocupadas integer;
  v_total smallint;
begin
  select count(*) into v_ocupadas
  from selecao.matriculas
  where turma_id = p_turma_id and status in ('inscrita', 'matriculada');

  select vagas_total into v_total from selecao.turmas where id = p_turma_id;

  if v_ocupadas >= v_total then
    raise exception 'Turma sem vagas disponíveis';
  end if;
end;
$$;

create or replace function selecao.checar_matricula_ativa_na_trilha(p_aluno_id uuid, p_trilha_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from selecao.matriculas m
    join selecao.turmas t on t.id = m.turma_id
    where m.aluno_id = p_aluno_id
      and t.trilha_id = p_trilha_id
      and m.status in ('inscrita', 'matriculada')
  ) then
    raise exception 'Você já tem uma matrícula ativa nesta trilha em outra turma.';
  end if;
end;
$$;

grant execute on function selecao.professor_da_turma(uuid) to authenticated;
grant execute on function selecao.aluno_da_matricula(uuid) to authenticated;
grant execute on function selecao.validar_pre_requisitos_trilha(uuid, uuid) to authenticated;
grant execute on function selecao.checar_vaga_disponivel(uuid) to authenticated;
grant execute on function selecao.checar_matricula_ativa_na_trilha(uuid, uuid) to authenticated;

-- A FK de professor_id não sabe de papel — só de existência da linha em
-- profiles. Quem garante que é de fato um professor é este trigger.
create or replace function selecao.validar_professor_da_turma()
returns trigger
language plpgsql
as $$
begin
  if not selecao.professor_da_turma(new.professor_id) then
    raise exception 'o profile informado não tem papel de professor';
  end if;
  return new;
end;
$$;

drop trigger if exists turmas_valida_professor on selecao.turmas;
create trigger turmas_valida_professor
  before insert or update on selecao.turmas
  for each row
  execute function selecao.validar_professor_da_turma();

create or replace function selecao.validar_aluno_da_matricula()
returns trigger
language plpgsql
as $$
begin
  if not selecao.aluno_da_matricula(new.aluno_id) then
    raise exception 'o profile informado não tem papel de aluno';
  end if;
  return new;
end;
$$;

drop trigger if exists matriculas_valida_aluno on selecao.matriculas;
create trigger matriculas_valida_aluno
  before insert on selecao.matriculas
  for each row
  execute function selecao.validar_aluno_da_matricula();

-- Nome de trigger em ordem alfabética de propósito: "matriculas_valida_aluno"
-- roda antes de "matriculas_valida_regras_negocio" (Postgres dispara
-- triggers BEFORE na ordem alfabética do nome) — confirma que é aluno
-- antes de checar vaga/trilha-ativa/pré-requisito.
create or replace function selecao.validar_regras_negocio_matricula()
returns trigger
language plpgsql
as $$
declare
  v_trilha_id uuid;
begin
  select trilha_id into v_trilha_id from selecao.turmas where id = new.turma_id;

  perform selecao.checar_vaga_disponivel(new.turma_id);
  perform selecao.checar_matricula_ativa_na_trilha(new.aluno_id, v_trilha_id);
  perform selecao.validar_pre_requisitos_trilha(new.aluno_id, v_trilha_id);

  return new;
end;
$$;

drop trigger if exists matriculas_valida_regras_negocio on selecao.matriculas;
create trigger matriculas_valida_regras_negocio
  before insert on selecao.matriculas
  for each row
  execute function selecao.validar_regras_negocio_matricula();

create or replace function selecao.registrar_deferimento_matricula()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'inscrita' and new.status in ('matriculada', 'rejeitada') then
    new.deferido_em = now();

    if new.deferido_por is null then
      raise exception 'informe quem aprovou ou rejeitou a matrícula';
    end if;

    if new.status = 'rejeitada'
       and (new.motivo_rejeicao is null or char_length(btrim(new.motivo_rejeicao)) < 10) then
      raise exception 'motivo da rejeição precisa ter pelo menos 10 caracteres';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists matriculas_registra_deferimento on selecao.matriculas;
create trigger matriculas_registra_deferimento
  before update on selecao.matriculas
  for each row
  execute function selecao.registrar_deferimento_matricula();
