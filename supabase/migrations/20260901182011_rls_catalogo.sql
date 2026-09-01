-- MS2 — RLS do catálogo. Reaproveita identidade.usuario_e_coordenacao()
-- (MS1) em vez de duplicar a checagem de papel em cada policy.

alter table catalogo.trilhas enable row level security;
alter table catalogo.modulos enable row level security;
alter table catalogo.pre_requisitos_modulo enable row level security;

grant usage on schema catalogo to authenticated;
grant select, insert, update, delete on catalogo.trilhas to authenticated;
grant select, insert, update, delete on catalogo.modulos to authenticated;
grant select, insert, update, delete on catalogo.pre_requisitos_modulo to authenticated;

-- trilhas: rascunho (publicada = false) só é visível para coordenação.
drop policy if exists trilhas_select on catalogo.trilhas;
create policy trilhas_select
  on catalogo.trilhas
  for select
  to authenticated
  using (publicada or identidade.usuario_e_coordenacao());

drop policy if exists trilhas_insert on catalogo.trilhas;
create policy trilhas_insert
  on catalogo.trilhas
  for insert
  to authenticated
  with check (identidade.usuario_e_coordenacao());

drop policy if exists trilhas_update on catalogo.trilhas;
create policy trilhas_update
  on catalogo.trilhas
  for update
  to authenticated
  using (identidade.usuario_e_coordenacao())
  with check (identidade.usuario_e_coordenacao());

drop policy if exists trilhas_delete on catalogo.trilhas;
create policy trilhas_delete
  on catalogo.trilhas
  for delete
  to authenticated
  using (identidade.usuario_e_coordenacao());

-- Trilha publicada pode ter turma histórica dependendo dela (MS3) —
-- apagar precisa de mensagem clara, por isso é trigger e não só a
-- ausência de policy (RLS negando simplesmente reportaria "0 linhas
-- afetadas", sem dizer o motivo).
create or replace function catalogo.impedir_apagar_trilha_publicada()
returns trigger
language plpgsql
as $$
begin
  if old.publicada then
    raise exception 'não é possível apagar uma trilha publicada — despublique antes';
  end if;
  return old;
end;
$$;

drop trigger if exists trilhas_impedir_apagar_publicada on catalogo.trilhas;
create trigger trilhas_impedir_apagar_publicada
  before delete on catalogo.trilhas
  for each row
  execute function catalogo.impedir_apagar_trilha_publicada();

-- modulos: visibilidade segue a trilha-mãe (não tem coluna publicada própria).
drop policy if exists modulos_select on catalogo.modulos;
create policy modulos_select
  on catalogo.modulos
  for select
  to authenticated
  using (
    identidade.usuario_e_coordenacao()
    or exists (
      select 1 from catalogo.trilhas t
      where t.id = modulos.trilha_id and t.publicada
    )
  );

drop policy if exists modulos_insert on catalogo.modulos;
create policy modulos_insert
  on catalogo.modulos
  for insert
  to authenticated
  with check (identidade.usuario_e_coordenacao());

drop policy if exists modulos_update on catalogo.modulos;
create policy modulos_update
  on catalogo.modulos
  for update
  to authenticated
  using (identidade.usuario_e_coordenacao())
  with check (identidade.usuario_e_coordenacao());

drop policy if exists modulos_delete on catalogo.modulos;
create policy modulos_delete
  on catalogo.modulos
  for delete
  to authenticated
  using (identidade.usuario_e_coordenacao());

-- pre_requisitos_modulo: mesma regra — segue a trilha do módulo via join.
drop policy if exists pre_requisitos_select on catalogo.pre_requisitos_modulo;
create policy pre_requisitos_select
  on catalogo.pre_requisitos_modulo
  for select
  to authenticated
  using (
    identidade.usuario_e_coordenacao()
    or exists (
      select 1
      from catalogo.modulos m
      join catalogo.trilhas t on t.id = m.trilha_id
      where m.id = pre_requisitos_modulo.modulo_id and t.publicada
    )
  );

drop policy if exists pre_requisitos_insert on catalogo.pre_requisitos_modulo;
create policy pre_requisitos_insert
  on catalogo.pre_requisitos_modulo
  for insert
  to authenticated
  with check (identidade.usuario_e_coordenacao());

drop policy if exists pre_requisitos_update on catalogo.pre_requisitos_modulo;
create policy pre_requisitos_update
  on catalogo.pre_requisitos_modulo
  for update
  to authenticated
  using (identidade.usuario_e_coordenacao())
  with check (identidade.usuario_e_coordenacao());

drop policy if exists pre_requisitos_delete on catalogo.pre_requisitos_modulo;
create policy pre_requisitos_delete
  on catalogo.pre_requisitos_modulo
  for delete
  to authenticated
  using (identidade.usuario_e_coordenacao());
