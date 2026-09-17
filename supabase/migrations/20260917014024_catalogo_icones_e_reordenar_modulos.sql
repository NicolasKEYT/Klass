-- Ícone visual para trilha e módulo (item de UX pós-teste) + reordenação
-- de módulos em lote para o drag-and-drop.

-- Guarda o NOME de um ícone da biblioteca lucide-react (já usada no
-- frontend), não uma imagem — mantém o escopo simples, sem Storage. null
-- = usa um ícone padrão neutro na interface.
alter table catalogo.trilhas add column if not exists icone text;
alter table catalogo.modulos add column if not exists icone text;
comment on column catalogo.trilhas.icone is
  'Nome (kebab-case) de um ícone lucide-react curado no frontend; null usa o padrão.';
comment on column catalogo.modulos.icone is
  'Nome (kebab-case) de um ícone lucide-react curado no frontend; null usa o padrão.';

-- Reordenação em lote: recebe os ids dos módulos na nova ordem e grava
-- ordem = posição (1..n). A constraint (trilha_id, ordem) é deferrable
-- (ver migration reordenar_modulos), então dá pra reatribuir todas numa
-- transação sem colisão transitória. SECURITY INVOKER: a RLS de UPDATE de
-- catalogo.modulos (só coordenação) continua valendo.
create or replace function catalogo.reordenar_modulos(p_ids uuid[])
returns void
language plpgsql
security invoker
as $$
declare
  v_trilhas uuid[];
  i integer;
begin
  if p_ids is null or array_length(p_ids, 1) is null then
    return;
  end if;

  -- Todos os ids precisam existir e pertencer à MESMA trilha (o mesmo
  -- limite que trocar_ordem_modulos impõe).
  select array_agg(distinct trilha_id) into v_trilhas
  from catalogo.modulos where id = any(p_ids);

  if v_trilhas is null or array_length(v_trilhas, 1) <> 1 then
    raise exception 'só é possível reordenar módulos da mesma trilha';
  end if;
  if (select count(*) from catalogo.modulos where id = any(p_ids)) <> array_length(p_ids, 1) then
    raise exception 'algum módulo informado não foi encontrado';
  end if;

  set constraints catalogo.modulos_trilha_ordem_unica deferred;

  for i in 1 .. array_length(p_ids, 1) loop
    update catalogo.modulos set ordem = i where id = p_ids[i];
  end loop;
end;
$$;

grant execute on function catalogo.reordenar_modulos(uuid[]) to authenticated;
