-- Concede ao role service_role acesso aos schemas de domínio.
--
-- O CLAUDE.md define que a service role key (só nos Workers, fora da RLS)
-- é quem faz as operações sem usuário na ponta — webhooks e cron. Mas as
-- migrations de RLS só concederam USAGE/privilégios ao role `authenticated`;
-- o service_role nunca ganhou acesso aos schemas custom. Resultado: o
-- cliente admin do Worker (createSupabaseAdmin) recebia "permission denied
-- for schema selecao" ao consultar via PostgREST.
--
-- O bug ficou escondido porque o único consumidor desse caminho é o e-mail
-- de matrícula (MS3), disparado por Database Webhook — que nunca funcionou
-- neste projeto (schema supabase_functions ausente; ver migration
-- webhooks_via_pg_net). Assim que os webhooks passaram a disparar de fato,
-- o "permission denied" apareceu.
--
-- service_role já ignora RLS (bypassrls), mas ainda precisa do GRANT de
-- schema/tabela. Concede acesso total (é o papel de backend, sem usuário)
-- e ajusta default privileges para tabelas/sequences futuras.
do $$
declare
  v_schema text;
begin
  foreach v_schema in array array['identidade', 'catalogo', 'selecao', 'diario', 'certificacao'] loop
    execute format('grant usage on schema %I to service_role', v_schema);
    execute format('grant all on all tables in schema %I to service_role', v_schema);
    execute format('grant all on all sequences in schema %I to service_role', v_schema);
    execute format('grant execute on all functions in schema %I to service_role', v_schema);
    execute format('alter default privileges in schema %I grant all on tables to service_role', v_schema);
    execute format('alter default privileges in schema %I grant all on sequences to service_role', v_schema);
    execute format('alter default privileges in schema %I grant execute on functions to service_role', v_schema);
  end loop;
end
$$;
