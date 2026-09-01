-- MS2 — Catálogo Curricular: trilhas, módulos e pré-requisitos entre
-- módulos. Fundação para o MS3 (Motor de Seleção) validar inscrições
-- contra o que a instituição realmente oferece.

create schema if not exists catalogo;
comment on schema catalogo is 'MS2 — Catálogo Curricular: trilhas, módulos e pré-requisitos.';

-- Nenhum SVG mostra um campo de "nível" para módulo/disciplina — nomes
-- assumidos (iniciante/intermediario/avancado), não extraídos do design.
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'nivel_modulo' and n.nspname = 'catalogo'
  ) then
    create type catalogo.nivel_modulo as enum ('iniciante', 'intermediario', 'avancado');
  end if;
end
$$;

create table if not exists catalogo.trilhas (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  nome text not null,
  descricao text not null,
  descricao_curta text,
  -- Denormalizada, mantida por trigger (ver recalcular_carga_horaria_trilha
  -- abaixo) — um generated column do Postgres só pode expressar colunas
  -- da PRÓPRIA linha, não agregar de outra tabela, então "generated
  -- always as" não é possível aqui.
  carga_horaria_total integer not null default 0,
  -- Rascunho (false) não aparece no catálogo público nem para quem não é
  -- coordenação — coordenação prepara a trilha antes de publicar.
  publicada boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint trilhas_slug_formato check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint trilhas_nome_minimo check (char_length(btrim(nome)) >= 3),
  constraint trilhas_descricao_minima check (char_length(btrim(descricao)) >= 10),
  constraint trilhas_descricao_curta_tamanho check (
    descricao_curta is null or char_length(descricao_curta) <= 200
  )
);
comment on table catalogo.trilhas is 'Trilhas de aprendizado oferecidas pela instituição.';

create table if not exists catalogo.modulos (
  id uuid primary key default gen_random_uuid(),
  trilha_id uuid not null references catalogo.trilhas (id) on delete cascade,
  ordem smallint not null,
  nome text not null,
  descricao text not null,
  nivel catalogo.nivel_modulo not null,
  carga_horaria_horas smallint not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint modulos_ordem_positiva check (ordem > 0),
  constraint modulos_nome_minimo check (char_length(btrim(nome)) >= 3),
  constraint modulos_carga_horaria_positiva check (carga_horaria_horas > 0),
  -- Sem isso, dois módulos disputariam a mesma posição na listagem da trilha.
  constraint modulos_trilha_ordem_unica unique (trilha_id, ordem)
);
comment on table catalogo.modulos is 'Módulos (disciplinas) de uma trilha, em ordem sequencial.';

create table if not exists catalogo.pre_requisitos_modulo (
  modulo_id uuid not null references catalogo.modulos (id) on delete cascade,
  pre_requisito_id uuid not null references catalogo.modulos (id) on delete cascade,
  primary key (modulo_id, pre_requisito_id),
  constraint pre_requisitos_nao_autorreferencia check (modulo_id <> pre_requisito_id)
);
comment on table catalogo.pre_requisitos_modulo is
  '"Para cursar modulo_id, é preciso ter concluído pre_requisito_id" — o MS3 consulta isso na hora da inscrição.';

-- atualizado_em mantido por trigger, mesmo padrão do MS1 — cada schema
-- tem sua própria função para não acoplar módulos por uma função
-- utilitária compartilhada (fronteira de módulo é real, ver CLAUDE.md).
create or replace function catalogo.set_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists trilhas_set_atualizado_em on catalogo.trilhas;
create trigger trilhas_set_atualizado_em
  before update on catalogo.trilhas
  for each row
  execute function catalogo.set_atualizado_em();

drop trigger if exists modulos_set_atualizado_em on catalogo.modulos;
create trigger modulos_set_atualizado_em
  before update on catalogo.modulos
  for each row
  execute function catalogo.set_atualizado_em();

-- Mantém trilhas.carga_horaria_total em sincronia sempre que um módulo é
-- criado, apagado, tem a carga horária editada ou muda de trilha.
create or replace function catalogo.recalcular_carga_horaria_trilha()
returns trigger
language plpgsql
as $$
begin
  update catalogo.trilhas
  set carga_horaria_total = (
    select coalesce(sum(carga_horaria_horas), 0)
    from catalogo.modulos
    where trilha_id = coalesce(new.trilha_id, old.trilha_id)
  )
  where id = coalesce(new.trilha_id, old.trilha_id);

  if tg_op = 'UPDATE' and old.trilha_id is distinct from new.trilha_id then
    update catalogo.trilhas
    set carga_horaria_total = (
      select coalesce(sum(carga_horaria_horas), 0)
      from catalogo.modulos
      where trilha_id = old.trilha_id
    )
    where id = old.trilha_id;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists modulos_recalcular_carga_horaria on catalogo.modulos;
create trigger modulos_recalcular_carga_horaria
  after insert or delete or update of carga_horaria_horas, trilha_id on catalogo.modulos
  for each row
  execute function catalogo.recalcular_carga_horaria_trilha();

-- Decisão de escopo: pré-requisito só entre módulos da MESMA trilha.
-- Modelar dependência cruzando trilhas é complexidade sem retorno claro
-- neste escopo, e nenhum SVG mostra esse caso.
create or replace function catalogo.validar_pre_requisito_mesma_trilha()
returns trigger
language plpgsql
as $$
declare
  v_trilha_modulo uuid;
  v_trilha_pre_requisito uuid;
begin
  select trilha_id into v_trilha_modulo from catalogo.modulos where id = new.modulo_id;
  select trilha_id into v_trilha_pre_requisito from catalogo.modulos where id = new.pre_requisito_id;

  if v_trilha_modulo is distinct from v_trilha_pre_requisito then
    raise exception 'pré-requisito precisa ser um módulo da mesma trilha';
  end if;

  return new;
end;
$$;

drop trigger if exists pre_requisitos_validar_mesma_trilha on catalogo.pre_requisitos_modulo;
create trigger pre_requisitos_validar_mesma_trilha
  before insert on catalogo.pre_requisitos_modulo
  for each row
  execute function catalogo.validar_pre_requisito_mesma_trilha();

-- Sem essa proteção, o MS3 poderia entrar em loop infinito ao expandir a
-- árvore de pré-requisitos na hora de validar uma inscrição. Busca, a
-- partir do pré-requisito que está entrando, toda a cadeia de
-- pré-requisitos QUE ELE JÁ TEM — se o módulo que está pedindo esse
-- pré-requisito aparecer nessa cadeia, a nova linha fecharia um ciclo.
create or replace function catalogo.impedir_ciclo_pre_requisito()
returns trigger
language plpgsql
as $$
begin
  if exists (
    with recursive cadeia as (
      select pre_requisito_id as modulo
      from catalogo.pre_requisitos_modulo
      where modulo_id = new.pre_requisito_id
      union
      select p.pre_requisito_id
      from catalogo.pre_requisitos_modulo p
      join cadeia c on p.modulo_id = c.modulo
    )
    select 1 from cadeia where modulo = new.modulo_id
  ) then
    raise exception 'essa relação criaria um ciclo de pré-requisitos';
  end if;

  return new;
end;
$$;

drop trigger if exists pre_requisitos_impedir_ciclo on catalogo.pre_requisitos_modulo;
create trigger pre_requisitos_impedir_ciclo
  before insert on catalogo.pre_requisitos_modulo
  for each row
  execute function catalogo.impedir_ciclo_pre_requisito();

-- A listagem de módulos de uma trilha sempre vem ordenada por "ordem".
create index if not exists modulos_trilha_ordem_idx on catalogo.modulos (trilha_id, ordem);
-- O catálogo público sempre filtra por publicada = true.
create index if not exists trilhas_slug_publicada_idx on catalogo.trilhas (slug) where publicada;
