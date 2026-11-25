-- Testes de banco do Klass (pgTAP). Rodam só no banco local (`supabase start`),
-- nunca no Supabase hospedado: `supabase test db`.
--
-- Cada arquivo é uma transação que termina em rollback. Os dados de teste são
-- criados aqui, com IDs fixos próprios (prefixos b1/e1/e2/e3), e o que vem do
-- seed se limita aos usuários de demonstração (coordenação e professor 1).
-- Os testes assumem os papéis `authenticated` e `anon` com claims JWT forjadas
-- (`request.jwt.claims`), que é o que o PostgREST faz em produção.
begin;
create extension if not exists pgtap with schema extensions;

create function pg_temp.id(p text) returns uuid language sql immutable as $$
  select (case p
    when 'coord' then 'a1000000-0000-4000-8000-000000000003'
    when 'prof1' then 'a1000000-0000-4000-8000-000000000002'
    when 'prof2' then 'b1000000-0000-4000-8000-000000000005'
    when 'al1' then 'b1000000-0000-4000-8000-000000000001'
    when 'al2' then 'b1000000-0000-4000-8000-000000000002'
    when 'al3' then 'b1000000-0000-4000-8000-000000000003'
    when 'al4' then 'b1000000-0000-4000-8000-000000000004'
    when 'tr1' then 'e1000000-0000-4000-8000-000000000001'
    when 'tr2' then 'e1000000-0000-4000-8000-000000000002'
    when 'm1' then 'e2000000-0000-4000-8000-000000000001'
    when 'm2' then 'e2000000-0000-4000-8000-000000000002'
    when 'm3' then 'e2000000-0000-4000-8000-000000000003'
    when 't1' then 'e3000000-0000-4000-8000-000000000001'
    when 't2' then 'e3000000-0000-4000-8000-000000000002'
    when 't3' then 'e3000000-0000-4000-8000-000000000003'
    when 't4' then 'e3000000-0000-4000-8000-000000000004'
  end)::uuid
$$;

create function pg_temp.como(p text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', pg_temp.id(p), 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create function pg_temp.como_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
end $$;

create function pg_temp.volta() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Executa um comando de escrita e devolve quantas linhas ele afetou: é como se
-- vê que a RLS filtrou o UPDATE/DELETE (a RLS não dá erro, afeta zero linhas).
create function pg_temp.afetadas(p_sql text) returns int language plpgsql as $$
declare n int;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end $$;

-- Fixture: os helpers abaixo rodam como dono (ignoram a RLS) para montar o
-- cenário; o que se testa acontece depois de pg_temp.como(...).
create function pg_temp.hoje() returns date language sql as $$
  select (now() at time zone 'America/Sao_Paulo')::date
$$;

create function pg_temp.mat(p_aluno text, p_turma text) returns uuid
language sql security definer as $$
  select id from selecao.matriculas
  where aluno_id = pg_temp.id(p_aluno) and turma_id = pg_temp.id(p_turma)
$$;

create function pg_temp.matricular(p_aluno text, p_turma text) returns uuid
language sql security definer as $$
  insert into selecao.matriculas (aluno_id, turma_id, status, deferido_por, deferido_em)
  values (pg_temp.id(p_aluno), pg_temp.id(p_turma), 'matriculada', pg_temp.id('coord'), now())
  returning id
$$;

create function pg_temp.aula(p_turma text, p_dias_atras int) returns uuid
language sql security definer as $$
  insert into diario.aulas (turma_id, data, horario)
  values (pg_temp.id(p_turma), pg_temp.hoje() - p_dias_atras, '19:00') returning id
$$;

create function pg_temp.avaliacao(p_turma text, p_titulo text, p_peso int) returns uuid
language sql security definer as $$
  insert into diario.avaliacoes (turma_id, titulo, peso, ordem)
  values (pg_temp.id(p_turma), p_titulo, p_peso,
          (select coalesce(max(ordem), 0) + 1 from diario.avaliacoes where turma_id = pg_temp.id(p_turma)))
  returning id
$$;

create function pg_temp.presenca(p_aula uuid, p_mat uuid, p_presente boolean) returns void
language sql security definer as $$
  insert into diario.presencas (aula_id, matricula_id, presente, registrada_por)
  values (p_aula, p_mat, p_presente, pg_temp.id('prof1'))
$$;

create function pg_temp.nota(p_av uuid, p_mat uuid, p_valor numeric) returns void
language sql security definer as $$
  insert into diario.notas (avaliacao_id, matricula_id, valor, lancada_por)
  values (p_av, p_mat, p_valor, pg_temp.id('prof1'))
$$;

-- Usuários de teste: alunos 1 a 4 e o professor 2 (o professor 1 e a
-- coordenação vêm do seed). O papel nunca vem do cadastro; promove-se depois.
insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', pg_temp.id(n), 'authenticated', 'authenticated',
  n || '.pgtap@klass.dev', 'x', now(), '{}',
  jsonb_build_object('nome_completo', 'Pessoa ' || n), now(), now(), '', '', '', ''
from unnest(array['al1','al2','al3','al4','prof2']) as n;
update identidade.profiles set papel = 'professor' where id = pg_temp.id('prof2');

insert into catalogo.trilhas (id, slug, nome, descricao, publicada, tipo_certificacao, media_minima, frequencia_minima_percentual) values
  (pg_temp.id('tr1'), 'trilha-pgtap-1', 'Trilha Pgtap 1', 'Trilha publicada de teste', true, 'modulo', 7, 75),
  (pg_temp.id('tr2'), 'trilha-pgtap-2', 'Trilha Pgtap 2', 'Trilha em rascunho de teste', false, 'modulo', 7, 75);
insert into catalogo.modulos (id, trilha_id, ordem, nome, descricao, nivel, carga_horaria_horas) values
  (pg_temp.id('m1'), pg_temp.id('tr1'), 1, 'Modulo Um', 'Primeiro módulo de teste', 'iniciante', 20),
  (pg_temp.id('m2'), pg_temp.id('tr1'), 2, 'Modulo Dois', 'Segundo módulo de teste', 'iniciante', 30),
  (pg_temp.id('m3'), pg_temp.id('tr2'), 1, 'Modulo Tres', 'Módulo da trilha em rascunho', 'iniciante', 10);
insert into catalogo.pre_requisitos_modulo (modulo_id, pre_requisito_id)
  values (pg_temp.id('m2'), pg_temp.id('m1'));
insert into selecao.turmas (id, modulo_id, codigo, professor_id, periodo_inicio, periodo_fim, vagas_total) values
  (pg_temp.id('t1'), pg_temp.id('m1'), 'PGT-A1', pg_temp.id('prof1'), pg_temp.hoje() - 20, pg_temp.hoje() + 20, 2),
  (pg_temp.id('t2'), pg_temp.id('m2'), 'PGT-B1', pg_temp.id('prof1'), pg_temp.hoje() - 20, pg_temp.hoje() + 20, 2),
  (pg_temp.id('t3'), pg_temp.id('m1'), 'PGT-C1', pg_temp.id('prof2'), pg_temp.hoje() - 20, pg_temp.hoje() + 20, 1),
  (pg_temp.id('t4'), pg_temp.id('m1'), 'PGT-D1', pg_temp.id('prof1'), pg_temp.hoje() - 60, pg_temp.hoje() - 30, 2);


select plan(32);

-- RLS habilitada em tudo, anônimo sem acesso e funções privilegiadas fechadas à API.

-- Toda tabela dos cinco contextos nasce com RLS habilitada.
select is((select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'identidade' and c.relkind = 'r' and not c.relrowsecurity), 0,
  'identidade: toda tabela tem RLS habilitada');
select is((select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'catalogo' and c.relkind = 'r' and not c.relrowsecurity), 0,
  'catalogo: toda tabela tem RLS habilitada');
select is((select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'selecao' and c.relkind = 'r' and not c.relrowsecurity), 0,
  'selecao: toda tabela tem RLS habilitada');
select is((select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'diario' and c.relkind = 'r' and not c.relrowsecurity), 0,
  'diario: toda tabela tem RLS habilitada');
select is((select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'certificacao' and c.relkind = 'r' and not c.relrowsecurity), 0,
  'certificacao: toda tabela tem RLS habilitada');

-- Tabela com RLS e sem política de leitura não seria lida por ninguém: toda tabela tem SELECT.
select is((select count(*)::int
           from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname in ('identidade', 'catalogo', 'selecao', 'diario', 'certificacao')
             and c.relkind = 'r'
             and not exists (select 1 from pg_policies p
                             where p.schemaname = n.nspname and p.tablename = c.relname
                               and p.cmd = 'SELECT')), 0,
  'toda tabela de domínio tem política de leitura');

-- Nenhuma política vale para o papel anon: o anônimo não lê nada de domínio.
select is((select count(*)::int from pg_policies
           where schemaname in ('identidade', 'catalogo', 'selecao', 'diario', 'certificacao')
             and ('anon' = any (roles) or 'public' = any (roles))), 0,
  'nenhuma política de domínio vale para anon ou public');

select pg_temp.como_anon();
select throws_ok($$select count(*) from selecao.matriculas$$, '42501', null,
  'anon não lê matrículas');
select throws_ok($$select count(*) from diario.notas$$, '42501', null,
  'anon não lê notas');
select throws_ok($$select count(*) from certificacao.certificados$$, '42501', null,
  'anon não lê a tabela de certificados');
select throws_ok($$select count(*) from identidade.profiles$$, '42501', null,
  'anon não lê perfis');
select throws_ok($$select count(*) from catalogo.trilhas$$, '42501', null,
  'anon não lê o catálogo');
select throws_ok($$insert into selecao.matriculas (aluno_id, turma_id) values (gen_random_uuid(), gen_random_uuid())$$,
  '42501', null, 'anon não insere matrícula');
select pg_temp.volta();

-- Funções SECURITY DEFINER (ignoram a RLS): só a verificação pública é aberta ao anônimo.
select is((select coalesce(string_agg(n.nspname || '.' || p.proname, ', ' order by p.proname), '')
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname in ('identidade', 'catalogo', 'selecao', 'diario', 'certificacao')
             and p.prosecdef and p.prorettype <> 'trigger'::regtype
             and has_function_privilege('anon', p.oid, 'execute')),
  'certificacao.verificar_por_hash',
  'a única função SECURITY DEFINER executável por anon é a verificação pública');

-- Cálculos internos e emissão de certificado ficam fechados à API.
select ok(not has_function_privilege('authenticated', 'diario.calcular_media_ponderada(uuid)', 'execute'),
  'diario.calcular_media_ponderada fechada à API');
select ok(not has_function_privilege('authenticated', 'diario.calcular_frequencia_percentual(uuid)', 'execute'),
  'diario.calcular_frequencia_percentual fechada à API');
select ok(not has_function_privilege('authenticated', 'diario.calcular_pronto_para_encerrar(uuid)', 'execute'),
  'diario.calcular_pronto_para_encerrar fechada à API');
select ok(not has_function_privilege('authenticated', 'certificacao.emitir_certificado_modulo(uuid)', 'execute'),
  'certificacao.emitir_certificado_modulo fechada à API');
select ok(not has_function_privilege('authenticated', 'certificacao.verificar_e_emitir(uuid, uuid)', 'execute'),
  'certificacao.verificar_e_emitir fechada à API');
select ok(not has_function_privilege('authenticated', 'certificacao.revogar_certificados_da_matricula(uuid, text)', 'execute'),
  'certificacao.revogar_certificados_da_matricula fechada à API');
select ok(not has_function_privilege('authenticated', 'selecao.modulos_concluidos_do_aluno(uuid)', 'execute'),
  'selecao.modulos_concluidos_do_aluno fechada à API');
select ok(not has_function_privilege('authenticated', 'selecao.resumo_matricula(uuid)', 'execute'),
  'selecao.resumo_matricula fechada à API');

-- Leituras brutas dos relatórios: nenhum papel da API as executa.
select ok(not has_function_privilege('authenticated', 'identidade.fonte_pessoas(identidade.papel, boolean)', 'execute'),
  'identidade.fonte_pessoas fechada à API');
select ok(not has_function_privilege('authenticated', 'catalogo.fonte_modulos()', 'execute'),
  'catalogo.fonte_modulos fechada à API');
select ok(not has_function_privilege('authenticated', 'selecao.fonte_turmas()', 'execute'),
  'selecao.fonte_turmas fechada à API');
select ok(not has_function_privilege('authenticated', 'selecao.fonte_matriculas()', 'execute'),
  'selecao.fonte_matriculas fechada à API');
select ok(not has_function_privilege('authenticated', 'diario.fonte_desempenho()', 'execute'),
  'diario.fonte_desempenho fechada à API');
select ok(not has_function_privilege('authenticated', 'certificacao.fonte_certificados()', 'execute'),
  'certificacao.fonte_certificados fechada à API');

-- Triggers que ligam o banco ao Worker existem e estão ativos.
select is((select tgenabled::text from pg_trigger where tgname = 'matriculas_notifica_deferimento'), 'O',
  'trigger de e-mail de matrícula deferida está ativo');
select is((select tgenabled::text from pg_trigger where tgname = 'certificados_notifica_emissao'), 'O',
  'trigger de e-mail de certificado emitido está ativo');
select is((select tgenabled::text from pg_trigger where tgname = 'matriculas_notifica_inscricao'), 'O',
  'trigger de e-mail de inscrição recebida está ativo');

-- O bucket de materiais é privado.
select is((select public from storage.buckets where id = 'materiais'), false,
  'o bucket materiais é privado');

select * from finish();
rollback;
