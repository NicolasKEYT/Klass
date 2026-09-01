-- Trocar a ordem de dois módulos com dois UPDATEs sequenciais simples
-- colide com a constraint única (trilha_id, ordem): o primeiro UPDATE
-- tentaria usar o valor que o outro módulo ainda ocupa. Torna a
-- constraint deferrable e faz a troca inteira numa função — o Postgres só
-- revalida a unicidade no fim da transação, quando os dois já trocaram.
-- "ALTER CONSTRAINT" só funciona em foreign keys — uma unique constraint
-- existente precisa ser recriada para virar deferrable.
alter table catalogo.modulos drop constraint modulos_trilha_ordem_unica;
alter table catalogo.modulos
  add constraint modulos_trilha_ordem_unica
  unique (trilha_id, ordem) deferrable initially immediate;

create or replace function catalogo.trocar_ordem_modulos(p_modulo_a uuid, p_modulo_b uuid)
returns void
language plpgsql
security invoker
as $$
declare
  v_ordem_a smallint;
  v_ordem_b smallint;
  v_trilha_a uuid;
  v_trilha_b uuid;
begin
  select ordem, trilha_id into v_ordem_a, v_trilha_a from catalogo.modulos where id = p_modulo_a;
  select ordem, trilha_id into v_ordem_b, v_trilha_b from catalogo.modulos where id = p_modulo_b;

  if v_trilha_a is null or v_trilha_b is null then
    raise exception 'módulo não encontrado';
  end if;
  if v_trilha_a <> v_trilha_b then
    raise exception 'só é possível reordenar módulos da mesma trilha';
  end if;

  set constraints catalogo.modulos_trilha_ordem_unica deferred;

  update catalogo.modulos set ordem = v_ordem_b where id = p_modulo_a;
  update catalogo.modulos set ordem = v_ordem_a where id = p_modulo_b;
end;
$$;

-- SECURITY INVOKER (padrão): quem chama precisa passar pela RLS de
-- UPDATE de catalogo.modulos normalmente, ou seja, só coordenação.
grant execute on function catalogo.trocar_ordem_modulos(uuid, uuid) to authenticated;
