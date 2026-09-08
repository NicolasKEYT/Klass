-- MS4 é o primeiro módulo a usar Realtime (artigo, Fluxo 3: aluno vê
-- nota nova sem recarregar). Sem adicionar a tabela à publicação
-- supabase_realtime, o subscribe do frontend nunca dispara nada — RLS já
-- habilitada nas três tabelas continua sendo o que decide QUAL linha
-- cada usuário recebe.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'diario' and tablename = 'notas'
  ) then
    alter publication supabase_realtime add table diario.notas;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'diario' and tablename = 'presencas'
  ) then
    alter publication supabase_realtime add table diario.presencas;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'selecao' and tablename = 'matriculas'
  ) then
    alter publication supabase_realtime add table selecao.matriculas;
  end if;
end
$$;
