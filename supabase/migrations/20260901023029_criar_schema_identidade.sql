-- MS1 — Identidade e Acesso: schema, papel (RBAC) e profiles.
-- Fundação de autorização para os outros quatro módulos: cada um vai
-- consultar o papel do usuário logado a partir daqui via função
-- SECURITY DEFINER, sem ler tabela de outro schema diretamente (ver
-- CLAUDE.md — comunicação entre contextos é por função nomeada, não por
-- acoplamento de tabela).

create schema if not exists identidade;
comment on schema identidade is 'MS1 — Identidade e Acesso: perfis de usuário e RBAC.';

-- CREATE TYPE não aceita "if not exists" nativamente — guardamos com um
-- DO block para a migration poder ser reaplicada sem erro.
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'papel' and n.nspname = 'identidade'
  ) then
    create type identidade.papel as enum ('aluno', 'professor', 'coordenacao');
  end if;
end
$$;
comment on type identidade.papel is 'As três personas do sistema (ver packages/types/src/comum.ts).';

create table if not exists identidade.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nome_completo text not null,
  papel identidade.papel not null default 'aluno',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint nome_completo_minimo check (char_length(btrim(nome_completo)) >= 2)
);
comment on table identidade.profiles is
  'Estende auth.users com dados que não são de autenticação. Deleção em cascata: sem usuário em auth.users, sem profile.';
comment on column identidade.profiles.papel is
  'Default aluno — o cadastro público nunca cria professor/coordenação direto; promoção é ação manual de uma coordenação existente (ver policy de UPDATE).';

-- atualizado_em é mantido por trigger, não pela aplicação, para não
-- depender de todo INSERT/UPDATE lembrar de setar a coluna.
create or replace function identidade.set_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_atualizado_em on identidade.profiles;
create trigger profiles_set_atualizado_em
  before update on identidade.profiles
  for each row
  execute function identidade.set_atualizado_em();

-- RLS habilitada desde a criação: uma tabela sem policy não é lida por
-- ninguém via PostgREST — esse é o padrão seguro do projeto.
alter table identidade.profiles enable row level security;

-- papel_do_usuario_atual/usuario_e_coordenacao são SECURITY DEFINER para
-- que policies de QUALQUER schema (MS2–MS5) possam consultar o papel do
-- usuário logado sem reabrir RLS de profiles — evita recursão de policy
-- e evita cada módulo duplicar essa checagem. STABLE porque o resultado
-- não muda dentro da mesma transação. search_path fixo e vazio: função
-- SECURITY DEFINER não deve confiar no search_path de quem chama.
create or replace function identidade.papel_do_usuario_atual()
returns identidade.papel
language sql
security definer
stable
set search_path = ''
as $$
  select papel from identidade.profiles where id = auth.uid();
$$;
comment on function identidade.papel_do_usuario_atual() is
  'Retorna null se não houver usuário logado — quem chama decide o que fazer com null.';

create or replace function identidade.usuario_e_coordenacao()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(identidade.papel_do_usuario_atual() = 'coordenacao', false);
$$;
comment on function identidade.usuario_e_coordenacao() is
  'Atalho para simplificar policies de outros módulos — evita repetir a comparação com o enum em cada um.';

-- Supabase não garante EXECUTE/USAGE a PUBLIC por padrão em schemas
-- novos — sem os grants abaixo, nem o usuário autenticado consegue
-- chamar estas funções ou ler a própria linha.
grant usage on schema identidade to authenticated;
grant select, update on identidade.profiles to authenticated;
grant execute on function identidade.papel_do_usuario_atual() to authenticated;
grant execute on function identidade.usuario_e_coordenacao() to authenticated;

-- SELECT: cada um lê o próprio profile; coordenação lê todo mundo (telas
-- de gestão de pessoas dos próximos módulos vão precisar disso).
drop policy if exists profiles_select on identidade.profiles;
create policy profiles_select
  on identidade.profiles
  for select
  to authenticated
  using (id = auth.uid() or identidade.usuario_e_coordenacao());

-- UPDATE: mesma regra de visibilidade do SELECT. A restrição "não pode
-- trocar o próprio papel" fica no trigger abaixo, não numa subquery
-- dentro de WITH CHECK — comparar o valor novo contra o valor antigo da
-- MESMA linha sendo atualizada tem timing ambíguo em Postgres quando
-- feito via subquery correlacionada; um trigger com OLD/NEW é a forma
-- correta e não ambígua de fazer essa comparação.
drop policy if exists profiles_update on identidade.profiles;
create policy profiles_update
  on identidade.profiles
  for update
  to authenticated
  using (id = auth.uid() or identidade.usuario_e_coordenacao())
  with check (id = auth.uid() or identidade.usuario_e_coordenacao());

create or replace function identidade.impedir_troca_de_papel_por_usuario_comum()
returns trigger
language plpgsql
as $$
begin
  if new.papel is distinct from old.papel and not identidade.usuario_e_coordenacao() then
    raise exception 'apenas coordenação pode alterar o papel de um usuário';
  end if;
  return new;
end;
$$;
comment on function identidade.impedir_troca_de_papel_por_usuario_comum() is
  'Só coordenação promove/rebaixa papel — reforçado aqui porque a policy de UPDATE sozinha não distingue "mudar meus dados" de "mudar meu papel".';

drop trigger if exists profiles_impedir_troca_de_papel on identidade.profiles;
create trigger profiles_impedir_troca_de_papel
  before update on identidade.profiles
  for each row
  execute function identidade.impedir_troca_de_papel_por_usuario_comum();

-- INSERT e DELETE não têm policy, de propósito: INSERT só acontece via
-- trigger SECURITY DEFINER (próxima migration — roda como owner e por
-- isso ignora RLS); DELETE só acontece via "on delete cascade" quando a
-- linha correspondente em auth.users é removida.
