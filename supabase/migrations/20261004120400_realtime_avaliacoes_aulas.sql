-- MS4 — avaliações e aulas também no Realtime: criar ou apagar uma
-- avaliação/aula passa a atualizar Boletim e Início do aluno e o "Hoje" do
-- professor sem recarregar (antes só notas, presenças e matrículas
-- chegavam). Idempotente, no mesmo padrão de 20260908145204. A RLS de
-- SELECT das duas tabelas continua decidindo quem recebe cada linha
-- (aluno só das turmas em que cursa, professor das suas, coordenação
-- todas); DELETE chega só com o id (ver as assinaturas no frontend).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'diario' and tablename = 'avaliacoes'
  ) then
    alter publication supabase_realtime add table diario.avaliacoes;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'diario' and tablename = 'aulas'
  ) then
    alter publication supabase_realtime add table diario.aulas;
  end if;
end
$$;
