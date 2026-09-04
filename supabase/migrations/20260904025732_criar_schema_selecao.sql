-- MS3 — Motor de Seleção: transforma interesse do aluno em matrícula
-- oficial, validando pré-requisitos e ocupando vagas de forma
-- transacional (ver artigo do TCC 1, Fluxo 1).

create schema if not exists selecao;
comment on schema selecao is 'MS3 — Motor de Seleção: turmas, matrículas e pré-requisitos entre trilhas.';

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'status_matricula' and n.nspname = 'selecao'
  ) then
    create type selecao.status_matricula as enum (
      'inscrita', 'matriculada', 'rejeitada', 'cancelada', 'concluida'
    );
  end if;
end
$$;

-- Padrão de código real observado no design (CDA-2026-1, IBD-2026-1):
-- sigla da trilha + ano + sequência — não o exemplo genérico do prompt.
create table if not exists selecao.turmas (
  id uuid primary key default gen_random_uuid(),
  -- on delete restrict: o MS2 já bloqueia apagar trilha PUBLICADA, mas
  -- isso aqui protege o caso de uma trilha não publicada que já ganhou
  -- turma — turma nunca pode ficar órfã.
  trilha_id uuid not null references catalogo.trilhas (id) on delete restrict,
  codigo text not null unique,
  -- on delete restrict: histórico de turma não pode sumir junto com o
  -- profile do professor.
  professor_id uuid not null references identidade.profiles (id) on delete restrict,
  periodo_inicio date not null,
  periodo_fim date not null,
  vagas_total smallint not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint turmas_codigo_formato check (codigo ~ '^[A-Z0-9]{2,8}-[0-9]{4}-[0-9]{1,2}$'),
  constraint turmas_periodo_valido check (periodo_fim > periodo_inicio),
  constraint turmas_vagas_positivas check (vagas_total > 0)
);
comment on table selecao.turmas is
  'Oferta concreta de uma trilha num período, com professor e vagas — aluno se inscreve na turma inteira, não módulo por módulo.';

create index if not exists turmas_trilha_id_idx on selecao.turmas (trilha_id);
create index if not exists turmas_professor_id_idx on selecao.turmas (professor_id);
create index if not exists turmas_periodo_inicio_idx on selecao.turmas (periodo_inicio);

-- atualizado_em por trigger, mesmo padrão do MS1/MS2 — função própria do
-- schema, sem acoplar módulos por uma utilidade compartilhada.
create or replace function selecao.set_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists turmas_set_atualizado_em on selecao.turmas;
create trigger turmas_set_atualizado_em
  before update on selecao.turmas
  for each row
  execute function selecao.set_atualizado_em();

-- "Para se inscrever em trilha_id, é preciso ter concluído
-- trilha_requisito_id" — mesma ideia de catalogo.pre_requisitos_modulo,
-- mas entre TRILHAS inteiras, não módulos dentro de uma trilha.
create table if not exists selecao.pre_requisitos_trilha (
  trilha_id uuid not null references catalogo.trilhas (id) on delete cascade,
  trilha_requisito_id uuid not null references catalogo.trilhas (id) on delete cascade,
  primary key (trilha_id, trilha_requisito_id),
  constraint pre_requisitos_trilha_nao_autorreferencia check (trilha_id <> trilha_requisito_id)
);
comment on table selecao.pre_requisitos_trilha is
  '"Para se inscrever em trilha_id, é preciso ter concluído trilha_requisito_id" — selecao.validar_pre_requisitos_trilha() consulta isso na inscrição.';

-- Mesma técnica anti-ciclo do MS2 (pre_requisitos_modulo), aplicada ao
-- grafo de trilhas. SECURITY DEFINER (pedido explicitamente aqui) para a
-- checagem não depender da policy de SELECT de quem está inserindo.
create or replace function selecao.impedir_ciclo_pre_requisito_trilha()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    with recursive cadeia as (
      select trilha_requisito_id as trilha
      from selecao.pre_requisitos_trilha
      where trilha_id = new.trilha_requisito_id
      union
      select p.trilha_requisito_id
      from selecao.pre_requisitos_trilha p
      join cadeia c on p.trilha_id = c.trilha
    )
    select 1 from cadeia where trilha = new.trilha_id
  ) then
    raise exception 'essa relação criaria um ciclo de pré-requisitos entre trilhas';
  end if;

  return new;
end;
$$;

drop trigger if exists pre_requisitos_trilha_impedir_ciclo on selecao.pre_requisitos_trilha;
create trigger pre_requisitos_trilha_impedir_ciclo
  before insert on selecao.pre_requisitos_trilha
  for each row
  execute function selecao.impedir_ciclo_pre_requisito_trilha();

create table if not exists selecao.matriculas (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references identidade.profiles (id) on delete cascade,
  -- on delete restrict: histórico de matrícula (mesmo rejeitada/cancelada)
  -- não pode sumir junto com a turma.
  turma_id uuid not null references selecao.turmas (id) on delete restrict,
  status selecao.status_matricula not null default 'inscrita',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  deferido_em timestamptz,
  deferido_por uuid references identidade.profiles (id),
  motivo_rejeicao text,
  -- Uma linha por (aluno, turma) — o status final é o que vale. Simples
  -- de propósito: permitir re-inscrição após rejeição complicaria sem
  -- necessidade clara neste escopo.
  constraint matriculas_aluno_turma_unica unique (aluno_id, turma_id),
  -- Tamanho mínimo do motivo fica no trigger (matriculas_registra_deferimento),
  -- que já trata a transição de status — aqui só a obrigatoriedade.
  constraint matriculas_motivo_rejeicao_obrigatorio check (
    status <> 'rejeitada' or motivo_rejeicao is not null
  )
);
comment on table selecao.matriculas is
  'Uma linha por (aluno, turma). Nunca apagada pelo app — é histórico, inclusive rejeitada/cancelada.';
comment on column selecao.matriculas.deferido_em is
  'Preenchido quando o status vira matriculada ou rejeitada (ver trigger matriculas_registra_deferimento).';

create index if not exists matriculas_aluno_status_idx on selecao.matriculas (aluno_id, status);
create index if not exists matriculas_turma_status_idx on selecao.matriculas (turma_id, status);

drop trigger if exists matriculas_set_atualizado_em on selecao.matriculas;
create trigger matriculas_set_atualizado_em
  before update on selecao.matriculas
  for each row
  execute function selecao.set_atualizado_em();
