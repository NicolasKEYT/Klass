-- MS2 — modelo de avaliações por módulo (decisão do dono do produto em
-- 03/10/2026): "a coordenação cadastra no módulo as avaliações padrão
-- (título e peso); toda turma nova já nasce com elas e o professor ajusta
-- na turma dele, sem pedir liberação".
--
-- O modelo é do catálogo (pertence ao módulo, como a carga horária); as
-- avaliações de cada turma continuam sendo do diário. A cópia acontece na
-- criação da turma, pelo MS4 (migration seguinte), que lê o modelo por uma
-- função nomeada deste contexto.

create table if not exists catalogo.avaliacoes_modelo (
  id uuid primary key default gen_random_uuid(),
  modulo_id uuid not null references catalogo.modulos (id) on delete cascade,
  titulo text not null,
  -- Mesma regra de diario.avaliacoes: inteiro positivo livre; a média
  -- normaliza pela soma dos pesos.
  peso smallint not null,
  ordem smallint not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint avaliacoes_modelo_titulo_minimo check (char_length(btrim(titulo)) >= 2),
  constraint avaliacoes_modelo_peso_positivo check (peso > 0),
  constraint avaliacoes_modelo_ordem_positiva check (ordem > 0),
  -- Deferrable: reordenar troca posições dentro de uma transação.
  constraint avaliacoes_modelo_modulo_ordem_unica unique (modulo_id, ordem) deferrable initially immediate
);
comment on table catalogo.avaliacoes_modelo is
  'Avaliações padrão de um módulo (título, peso, ordem). Copiadas para cada turma nova do módulo; turmas existentes não mudam.';

create index if not exists avaliacoes_modelo_modulo_ordem_idx on catalogo.avaliacoes_modelo (modulo_id, ordem);

drop trigger if exists avaliacoes_modelo_set_atualizado_em on catalogo.avaliacoes_modelo;
create trigger avaliacoes_modelo_set_atualizado_em
  before update on catalogo.avaliacoes_modelo
  for each row
  execute function catalogo.set_atualizado_em();

-- RLS: leitura para qualquer usuário logado (a Nova turma e o professor
-- veem o modelo); escrita só da coordenação, como o resto do catálogo.
alter table catalogo.avaliacoes_modelo enable row level security;

grant select, insert, update, delete on catalogo.avaliacoes_modelo to authenticated;
grant all on catalogo.avaliacoes_modelo to service_role;

create policy avaliacoes_modelo_select
  on catalogo.avaliacoes_modelo for select to authenticated
  using (true);

create policy avaliacoes_modelo_insert
  on catalogo.avaliacoes_modelo for insert to authenticated
  with check (identidade.usuario_e_coordenacao());

create policy avaliacoes_modelo_update
  on catalogo.avaliacoes_modelo for update to authenticated
  using (identidade.usuario_e_coordenacao())
  with check (identidade.usuario_e_coordenacao());

create policy avaliacoes_modelo_delete
  on catalogo.avaliacoes_modelo for delete to authenticated
  using (identidade.usuario_e_coordenacao());

-- Função nomeada que o MS4 usa para copiar o modelo (fronteira de
-- contexto: o diário não lê a tabela do catálogo).
create or replace function catalogo.avaliacoes_modelo_do_modulo(p_modulo_id uuid)
returns table (titulo text, peso smallint, ordem smallint)
language sql
security definer
stable
set search_path = ''
as $$
  select am.titulo, am.peso, am.ordem
  from catalogo.avaliacoes_modelo am
  where am.modulo_id = p_modulo_id
  order by am.ordem;
$$;

revoke execute on function catalogo.avaliacoes_modelo_do_modulo(uuid) from public, anon;
grant execute on function catalogo.avaliacoes_modelo_do_modulo(uuid) to authenticated, service_role;

-- Reordenar as avaliações padrão de um módulo (mesmo padrão de
-- catalogo.reordenar_modulos). INVOKER: a RLS de update (coordenação)
-- continua decidindo.
create or replace function catalogo.reordenar_avaliacoes_modelo(p_ids uuid[])
returns void
language plpgsql
security invoker
as $$
declare
  v_modulos uuid[];
  i integer;
begin
  if p_ids is null or array_length(p_ids, 1) is null then
    return;
  end if;

  select array_agg(distinct modulo_id) into v_modulos
  from catalogo.avaliacoes_modelo where id = any(p_ids);

  if v_modulos is null or array_length(v_modulos, 1) <> 1 then
    raise exception 'só é possível reordenar avaliações do mesmo módulo';
  end if;
  if (select count(*) from catalogo.avaliacoes_modelo where id = any(p_ids)) <> array_length(p_ids, 1) then
    raise exception 'alguma avaliação informada não foi encontrada';
  end if;

  set constraints catalogo.avaliacoes_modelo_modulo_ordem_unica deferred;

  for i in 1 .. array_length(p_ids, 1) loop
    update catalogo.avaliacoes_modelo set ordem = i where id = p_ids[i];
  end loop;
end;
$$;

revoke execute on function catalogo.reordenar_avaliacoes_modelo(uuid[]) from public, anon;
grant execute on function catalogo.reordenar_avaliacoes_modelo(uuid[]) to authenticated, service_role;
