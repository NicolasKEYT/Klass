-- Bug pré-existente, descoberto no Prompt 15 (editar aula): a trigger
-- aulas_set_atualizado_em reaproveitava diario.set_atualizado_em(), a
-- mesma função usada por diario.avaliacoes — mas essa função escreve em
-- "atualizado_em", e diario.aulas tem a coluna "atualizada_em"
-- (concordância de gênero: "a aula", não "o aula"). Ficou dormente desde
-- a criação do schema porque nunca existiu um UPDATE em diario.aulas (só
-- INSERT via criarAula) até a funcionalidade de editar aula, que expôs o
-- erro "record 'new' has no field 'atualizado_em'" no primeiro UPDATE
-- real. Corrige com uma função própria para a coluna certa.
create or replace function diario.set_atualizada_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizada_em = now();
  return new;
end;
$$;

drop trigger if exists aulas_set_atualizado_em on diario.aulas;
create trigger aulas_set_atualizada_em
  before update on diario.aulas
  for each row
  execute function diario.set_atualizada_em();
