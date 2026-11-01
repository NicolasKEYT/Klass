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


select plan(20);

-- Contexto Identidade e Acesso: perfis, papéis e visibilidade.

-- O papel nunca vem do cadastro: todo perfil novo nasce aluno, mesmo que o
-- cliente peça outro papel nos metadados do usuário.
insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change)
values ('00000000-0000-0000-0000-000000000000', 'b1000000-0000-4000-8000-0000000000f1',
  'authenticated', 'authenticated', 'tenta.coord@klass.dev', 'x', now(), '{}',
  '{"nome_completo": "Quem Tenta Ser Coordenação", "papel": "coordenacao"}', now(), now(), '', '', '', '');
select is((select papel::text from identidade.profiles where id = 'b1000000-0000-4000-8000-0000000000f1'),
  'aluno', 'cadastro com papel "coordenacao" nos metadados vira aluno');
select is((select nome_completo from identidade.profiles where id = 'b1000000-0000-4000-8000-0000000000f1'),
  'Quem Tenta Ser Coordenação', 'o nome do perfil vem dos metadados do cadastro');
select is((select papel::text from identidade.profiles where id = pg_temp.id('prof2')),
  'professor', 'a promoção feita pelo dono do banco é respeitada');

-- Visibilidade: aluno e professor veem só o próprio perfil; coordenação vê todos.
select pg_temp.como('al1');
select is((select count(*)::int from identidade.profiles), 1, 'aluno vê só o próprio perfil');
select is((select id from identidade.profiles), pg_temp.id('al1'), 'o perfil visível é o do próprio aluno');
select pg_temp.volta();
select pg_temp.como('prof1');
select is((select count(*)::int from identidade.profiles), 1, 'professor vê só o próprio perfil');
select pg_temp.volta();
select pg_temp.como('coord');
select cmp_ok((select count(*)::int from identidade.profiles), '>=', 7,
  'coordenação vê os perfis da instituição');
select pg_temp.volta();

-- Funções de papel usadas pela RLS.
select pg_temp.como('al1');
select is(identidade.papel_do_usuario_atual()::text, 'aluno', 'papel_do_usuario_atual devolve aluno');
select is(identidade.usuario_e_coordenacao(), false, 'aluno não é coordenação');
select pg_temp.volta();
select pg_temp.como('prof1');
select is(identidade.papel_do_usuario_atual()::text, 'professor', 'papel_do_usuario_atual devolve professor');
select pg_temp.volta();
select pg_temp.como('coord');
select is(identidade.usuario_e_coordenacao(), true, 'coordenação é reconhecida como tal');
select pg_temp.volta();

-- Troca de papel: ninguém promove a si mesmo.
select pg_temp.como('al1');
select throws_like($$update identidade.profiles set papel = 'coordenacao' where id = auth.uid()$$,
  '%papel%', 'aluno não promove a si mesmo a coordenação');
select pg_temp.volta();
select pg_temp.como('prof1');
select throws_like($$update identidade.profiles set papel = 'coordenacao' where id = auth.uid()$$,
  '%papel%', 'professor não promove a si mesmo a coordenação');
select pg_temp.volta();

-- O aluno edita o próprio nome, mas não o de outra pessoa, e o nome tem tamanho mínimo.
select pg_temp.como('al1');
select lives_ok($$update identidade.profiles set nome_completo = 'Aluno Um Editado' where id = auth.uid()$$,
  'aluno edita o próprio nome');
select is((select nome_completo from identidade.profiles where id = auth.uid()), 'Aluno Um Editado',
  'o nome editado foi gravado');
select throws_ok($$update identidade.profiles set nome_completo = 'a' where id = auth.uid()$$,
  '23514', null, 'nome com um caractere é recusado');
select is(pg_temp.afetadas($$update identidade.profiles set nome_completo = 'Invasor' where id = 'b1000000-0000-4000-8000-000000000002'$$), 0,
  'aluno não altera o perfil de outra pessoa');
select pg_temp.volta();

-- Nomes públicos: qualquer usuário autenticado resolve nomes (ex.: nome do professor na turma).
select pg_temp.como('al1');
select is((select count(*)::int from identidade.nomes_completos(array[pg_temp.id('prof1')])), 1,
  'aluno resolve o nome do professor da turma');
select pg_temp.volta();

-- Anônimo não executa as funções de papel.
select ok(not has_function_privilege('anon', 'identidade.usuario_e_coordenacao()', 'execute'),
  'anon não executa usuario_e_coordenacao');
select ok(not has_function_privilege('anon', 'identidade.papel_do_usuario_atual()', 'execute'),
  'anon não executa papel_do_usuario_atual');

select * from finish();
rollback;
