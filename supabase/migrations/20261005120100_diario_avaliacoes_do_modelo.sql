-- MS4 — turma nova nasce com as avaliações padrão do módulo.
-- Coreografia orientada a eventos (CLAUDE.md): a criação da turma no MS3
-- é o evento; a reação é do MS4, que copia o modelo do MS2 chamando a
-- função nomeada catalogo.avaliacoes_modelo_do_modulo — sem ler a tabela
-- do catálogo e sem o MS3 conhecer o diário. Turmas existentes não mudam
-- (o trigger só reage a INSERT). Depois de criadas, são avaliações comuns
-- da turma: o professor edita e apaga sem pedir liberação.

create or replace function diario.criar_avaliacoes_do_modelo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into diario.avaliacoes (turma_id, titulo, peso, ordem)
  select new.id, m.titulo, m.peso, m.ordem
  from catalogo.avaliacoes_modelo_do_modulo(new.modulo_id) m;
  return null; -- AFTER trigger: retorno não é usado.
end;
$$;

drop trigger if exists turmas_cria_avaliacoes_do_modelo on selecao.turmas;
create trigger turmas_cria_avaliacoes_do_modelo
  after insert on selecao.turmas
  for each row
  execute function diario.criar_avaliacoes_do_modelo();

-- A validação "só o professor da turma ou a coordenação gerenciam o
-- diário" (avaliações e aulas) passa a valer só para quem fala pela API,
-- como as guardas da migration de segurança: turma criada pelo service
-- role (sem usuário na ponta) também precisa nascer com o modelo.
-- Recriada a partir de 20260908144043.
create or replace function diario.validar_professor_da_turma_diario()
returns trigger
language plpgsql
as $$
begin
  if diario.chamada_pela_api() and not diario.pode_gerenciar_turma(new.turma_id) then
    raise exception 'apenas o professor da turma ou a coordenação podem gerenciar o diário desta turma';
  end if;
  return new;
end;
$$;
