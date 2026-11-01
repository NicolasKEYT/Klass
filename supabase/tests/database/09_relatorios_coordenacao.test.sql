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


select plan(40);

-- Relatórios da coordenação (exports e indicadores): quem pode chamar, o que devolvem
-- e se as definições dos indicadores batem com os dados.

-- Cenário (trilha 1): T1 com vagas para 5; al1 e al4 matriculadas, al2 inscrita.
-- Na turma encerrada T4: al3 concluída, uma aluna reprovada e um aluno que cancelou.
insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', ('b1000000-0000-4000-8000-0000000000f' || n)::uuid,
  'authenticated', 'authenticated', 'extra' || n || '.pgtap@klass.dev', 'x', now(), '{}',
  jsonb_build_object('nome_completo', 'Extra ' || n), now(), now(), '', '', '', ''
from generate_series(2, 3) n;
update selecao.turmas set vagas_total = 5 where id = pg_temp.id('t1');
select pg_temp.matricular('al1', 't1');
select pg_temp.matricular('al4', 't1');
insert into selecao.matriculas (aluno_id, turma_id) values (pg_temp.id('al2'), pg_temp.id('t1'));
insert into selecao.matriculas (aluno_id, turma_id, status, deferido_por, deferido_em, encerrada_em) values
  (pg_temp.id('al3'), pg_temp.id('t4'), 'concluida', pg_temp.id('coord'), now() - interval '40 days', now() - interval '30 days'),
  ('b1000000-0000-4000-8000-0000000000f2', pg_temp.id('t4'), 'reprovada', pg_temp.id('coord'), now() - interval '40 days', now() - interval '30 days');
insert into selecao.matriculas (aluno_id, turma_id, status) values
  ('b1000000-0000-4000-8000-0000000000f3', pg_temp.id('t4'), 'cancelada');
-- Notas 8 e 6 e chamada 100% / 0% em T1: média da turma 7,0 e frequência 50%.
select pg_temp.aula('t1', 2);
select pg_temp.avaliacao('t1', 'Prova', 1);
select pg_temp.presenca((select id from diario.aulas where turma_id = pg_temp.id('t1')), pg_temp.mat('al1', 't1'), true);
select pg_temp.presenca((select id from diario.aulas where turma_id = pg_temp.id('t1')), pg_temp.mat('al4', 't1'), false);
select pg_temp.nota((select id from diario.avaliacoes where turma_id = pg_temp.id('t1')), pg_temp.mat('al1', 't1'), 8);
select pg_temp.nota((select id from diario.avaliacoes where turma_id = pg_temp.id('t1')), pg_temp.mat('al4', 't1'), 6);

-- Só a coordenação chama: os demais recebem erro de permissão (42501), não lista vazia.
select pg_temp.como('al1');
select throws_ok($$select * from identidade.relatorio_alunos(null, null, null, null)$$, '42501', null, 'aluno não chama relatorio_alunos');
select throws_ok($$select * from identidade.relatorio_docentes(null, null, null, null)$$, '42501', null, 'aluno não chama relatorio_docentes');
select throws_ok($$select * from catalogo.relatorio_trilhas(null, null, null, null)$$, '42501', null, 'aluno não chama relatorio_trilhas');
select throws_ok($$select * from selecao.relatorio_turmas(null, null, null, null)$$, '42501', null, 'aluno não chama relatorio_turmas');
select throws_ok($$select * from selecao.relatorio_matriculas(null, null, null, null)$$, '42501', null, 'aluno não chama relatorio_matriculas');
select throws_ok($$select * from diario.relatorio_notas_frequencia(null, null, null, null)$$, '42501', null, 'aluno não chama relatorio_notas_frequencia');
select throws_ok($$select * from certificacao.relatorio_certificados(null, null, null, null)$$, '42501', null, 'aluno não chama relatorio_certificados');
select throws_ok($$select selecao.relatorio_indicadores(null, null, null)$$, '42501', null, 'aluno não chama relatorio_indicadores');
select pg_temp.volta();
select pg_temp.como('prof1');
select throws_ok($$select * from identidade.relatorio_alunos(null, null, null, null)$$, '42501', null, 'professor não chama relatorio_alunos');
select throws_ok($$select selecao.relatorio_indicadores(null, null, null)$$, '42501', null, 'professor não chama relatorio_indicadores');
select pg_temp.volta();
select pg_temp.como_anon();
select throws_ok($$select * from identidade.relatorio_alunos(null, null, null, null)$$, '42501', null, 'anônimo não chama relatorio_alunos');
select throws_ok($$select selecao.relatorio_indicadores(null, null, null)$$, '42501', null, 'anônimo não chama relatorio_indicadores');
select pg_temp.volta();

-- Conteúdo: o e-mail só sai na lista de alunos; nenhum conjunto traz CPF ou dado sensível.
select ok(pg_get_function_result('identidade.relatorio_alunos(date, date, uuid, text)'::regprocedure) like '%email%',
  'a lista de alunos traz o e-mail');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where p.proname like 'relatorio\_%' and n.nspname in ('identidade', 'catalogo', 'selecao', 'diario', 'certificacao')
             and p.proname <> 'relatorio_alunos' and pg_get_function_result(p.oid) ilike '%email%'), 0,
  'nenhuma outra lista traz e-mail');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where p.proname like 'relatorio\_%' and n.nspname in ('identidade', 'catalogo', 'selecao', 'diario', 'certificacao')
             and pg_get_function_result(p.oid) ~* '(^|[^a-z])(cpf|rg|documento|telefone|endereco|nascimento)([^a-z]|$)'), 0,
  'nenhum relatório traz CPF, documento, telefone, endereço ou data de nascimento');

-- Listas: filtros por trilha e por situação.
select pg_temp.como('coord');
select cmp_ok((select count(*)::int from identidade.relatorio_alunos(null, null, null, null) where email like '%.pgtap@klass.dev'), '>=', 4,
  'a coordenação lista os alunos com e-mail');
select is((select count(*)::int from selecao.relatorio_matriculas(null, null, pg_temp.id('tr1'), null)), 6,
  'a lista de matrículas da trilha 1 tem as seis matrículas do cenário');
select is((select count(*)::int from selecao.relatorio_matriculas(null, null, pg_temp.id('tr1'), 'matriculada')), 2,
  'filtro de situação: duas matriculadas');
select is((select count(*)::int from selecao.relatorio_matriculas(null, null, pg_temp.id('tr1'), 'cancelada')), 1,
  'filtro de situação: uma cancelada');
select is((select count(*)::int from selecao.relatorio_turmas(null, null, pg_temp.id('tr1'), null)), 4,
  'a lista de turmas da trilha 1 tem as quatro turmas do cenário');
select is((select count(*)::int from selecao.relatorio_turmas(null, null, pg_temp.id('tr1'), 'encerrada')), 1,
  'filtro de situação da turma: uma encerrada');
select is((select count(*)::int from catalogo.relatorio_trilhas(null, null, pg_temp.id('tr1'), null)), 2,
  'a lista de trilhas traz uma linha por módulo');
select is((select count(*)::int from diario.relatorio_notas_frequencia(null, null, pg_temp.id('tr1'), 'matriculada')), 2,
  'notas e frequência: duas matrículas ativas');
select is((select count(*)::int from selecao.relatorio_matriculas(null, null, gen_random_uuid(), null)), 0,
  'trilha sem dados devolve lista vazia, e não erro');
select pg_temp.volta();

-- Indicadores: as definições batem com os dados do cenário.
select pg_temp.como('coord');
create temp table ind (j jsonb) on commit drop;
grant all on ind to authenticated;
insert into ind select selecao.relatorio_indicadores(null, null, pg_temp.id('tr1'));
select is((select (j -> 'kpis' ->> 'alunos_ativos')::int from ind), 2, 'alunos com matrícula ativa: 2');
select is((select (j -> 'kpis' ->> 'matriculas_ativas')::int from ind), 2, 'matrículas ativas: 2');
select is((select (j -> 'kpis' ->> 'inscricoes_pendentes')::int from ind), 1, 'inscrições pendentes: 1');
select is((select (j -> 'kpis' ->> 'taxa_conclusao')::numeric from ind), 33.3::numeric,
  'conclusão: 1 concluída entre 3 encerradas ou canceladas = 33,3%');
select is((select (j -> 'kpis' ->> 'taxa_evasao')::numeric from ind), 66.7::numeric,
  'evasão: 1 reprovada e 1 cancelada entre 3 = 66,7%');
select is((select (j -> 'kpis' ->> 'nota_media')::numeric from ind), 7.00::numeric,
  'nota média das matrículas com nota: (8 + 6) / 2');
select is((select (j -> 'kpis' ->> 'frequencia_media')::numeric from ind), 50.0::numeric,
  'frequência média de quem está cursando: 100% e 0%');
select is((select (j -> 'kpis' ->> 'ocupacao_media')::numeric from ind), 13.3::numeric,
  'ocupação: matriculadas sobre vagas das turmas abertas (2/5, 0/2 e 0/1)');
select is((select (j -> 'kpis' ->> 'certificados_periodo')::int from ind), 0, 'sem certificados no cenário');
select is((select jsonb_array_length(j -> 'distribuicao_notas') from ind), 10,
  'a distribuição de notas tem sempre as dez faixas');
select is((select (e ->> 'total')::int from ind, jsonb_array_elements(j -> 'distribuicao_notas') e where (e ->> 'faixa_inicio')::int = 8), 1,
  'a nota 8 cai na faixa 8–9');
select is((select (e ->> 'total')::int from ind, jsonb_array_elements(j -> 'distribuicao_notas') e where (e ->> 'faixa_inicio')::int = 6), 1,
  'a nota 6 cai na faixa 6–7');
select is((select (e ->> 'alunos')::int from ind, jsonb_array_elements(j -> 'alunos_por_trilha') e), 4,
  'alunos por trilha: quatro (duas ativas, uma concluída, uma reprovada)');
select is((select (e ->> 'taxa_aprovacao')::numeric from ind, jsonb_array_elements(j -> 'desempenho_por_trilha') e), 50.0::numeric,
  'aprovação por trilha: 1 concluída entre 2 concluídas ou reprovadas');
-- O mesmo número com outro filtro: período futuro não pega nenhuma turma.
select is((select (selecao.relatorio_indicadores(pg_temp.hoje() + 100, pg_temp.hoje() + 200, pg_temp.id('tr1')) -> 'kpis' ->> 'matriculas_ativas')::int), 0,
  'período sem turmas devolve zero matrículas ativas');
select is((select (selecao.relatorio_indicadores(null, null, gen_random_uuid()) -> 'kpis' ->> 'alunos_ativos')::int), 0,
  'trilha sem dados devolve zero alunos ativos');
select pg_temp.volta();

select * from finish();
rollback;
