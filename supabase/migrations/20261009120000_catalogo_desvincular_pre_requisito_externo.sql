-- A15 (QA, continuação): trilha despublicada deixa de travar outras trilhas.
--
-- Desde 20261008120000 um módulo pode exigir módulo de OUTRA trilha, desde
-- que ela esteja publicada. Se essa trilha volta para rascunho, o aluno da
-- trilha dependente fica travado por um módulo que não consegue mais cursar.
-- Decisão do produto (05/10): a coordenação é avisada antes, num popup, e o
-- vínculo é desfeito automaticamente.
--
-- O que muda:
-- 1. Trigger em catalogo.trilhas: ao passar de publicada para não
--    publicada, apaga na mesma transação os pré-requisitos de módulos de
--    OUTRAS trilhas que apontam para módulos desta. Entre módulos da mesma
--    trilha nada muda (a sequência interna continua valendo no rascunho).
--    É trigger, e não código da tela, para valer por qualquer caminho.
--    Exclusão de trilha ou módulo não precisa de trigger: as FKs de
--    pre_requisitos_modulo já são "on delete cascade" (criar_schema_catalogo),
--    então o vínculo sai junto, na mesma transação.
-- 2. catalogo.dependentes_em_outras_trilhas(): só coordenação; lista o que
--    seria desvinculado, para a tela mostrar no popup antes de confirmar.

create or replace function catalogo.desvincular_pre_requisitos_externos()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from catalogo.pre_requisitos_modulo pr
  using catalogo.modulos exigido, catalogo.modulos dependente
  where pr.pre_requisito_id = exigido.id
    and exigido.trilha_id = new.id
    and pr.modulo_id = dependente.id
    and dependente.trilha_id <> new.id;
  return null;
end;
$$;

drop trigger if exists trilhas_desvincular_pre_requisitos_externos on catalogo.trilhas;
create trigger trilhas_desvincular_pre_requisitos_externos
  after update of publicada on catalogo.trilhas
  for each row
  when (old.publicada and not new.publicada)
  execute function catalogo.desvincular_pre_requisitos_externos();

revoke execute on function catalogo.desvincular_pre_requisitos_externos() from public, anon, authenticated;

-- Informe p_trilha_id (despublicar/excluir trilha) ou p_modulo_id (excluir
-- módulo). Devolve cada módulo de outra trilha que perderia o pré-requisito.
create or replace function catalogo.dependentes_em_outras_trilhas(
  p_trilha_id uuid default null,
  p_modulo_id uuid default null
)
returns table (
  trilha_dependente_id uuid,
  trilha_dependente_nome text,
  modulo_dependente_id uuid,
  modulo_dependente_nome text,
  modulo_exigido_id uuid,
  modulo_exigido_nome text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not identidade.usuario_e_coordenacao() then
    raise exception 'Apenas a coordenação pode consultar os vínculos de pré-requisito.';
  end if;

  return query
  select td.id, td.nome, dependente.id, dependente.nome, exigido.id, exigido.nome
  from catalogo.pre_requisitos_modulo pr
  join catalogo.modulos exigido on exigido.id = pr.pre_requisito_id
  join catalogo.modulos dependente on dependente.id = pr.modulo_id
  join catalogo.trilhas td on td.id = dependente.trilha_id
  where dependente.trilha_id <> exigido.trilha_id
    and (p_trilha_id is null or exigido.trilha_id = p_trilha_id)
    and (p_modulo_id is null or exigido.id = p_modulo_id)
    and (p_trilha_id is not null or p_modulo_id is not null)
  order by td.nome, dependente.ordem, exigido.ordem;
end;
$$;

revoke execute on function catalogo.dependentes_em_outras_trilhas(uuid, uuid) from public, anon;
grant execute on function catalogo.dependentes_em_outras_trilhas(uuid, uuid) to authenticated;
