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


select plan(35);

-- Contexto Catálogo Curricular: quem gerencia, o que cada papel vê e as invariantes.

-- Escrita no catálogo é só da coordenação.
select pg_temp.como('coord');
select lives_ok($$insert into catalogo.trilhas (slug, nome, descricao) values ('nova-trilha', 'Nova Trilha', 'Descrição com mais de dez caracteres')$$,
  'coordenação cria trilha');
select pg_temp.volta();
select pg_temp.como('al1');
select throws_ok($$insert into catalogo.trilhas (slug, nome, descricao) values ('invasora', 'Invasora', 'Descrição com mais de dez caracteres')$$,
  '42501', null, 'aluno não cria trilha');
select throws_ok($$insert into catalogo.modulos (trilha_id, ordem, nome, descricao, nivel, carga_horaria_horas)
  values (pg_temp.id('tr1'), 9, 'Invasor', 'Descrição do módulo invasor', 'iniciante', 5)$$,
  '42501', null, 'aluno não cria módulo');
select is(pg_temp.afetadas($$update catalogo.trilhas set nome = 'Trilha Editada' where id = 'e1000000-0000-4000-8000-000000000001'$$), 0,
  'aluno não edita trilha');
select is(pg_temp.afetadas($$delete from catalogo.modulos where id = 'e2000000-0000-4000-8000-000000000001'$$), 0,
  'aluno não apaga módulo');
select pg_temp.volta();
select pg_temp.como('prof1');
select throws_ok($$insert into catalogo.trilhas (slug, nome, descricao) values ('do-professor', 'Do Professor', 'Descrição com mais de dez caracteres')$$,
  '42501', null, 'professor não cria trilha');
select pg_temp.volta();

-- Visibilidade: trilha em rascunho só aparece para a coordenação.
select pg_temp.como('al1');
select is((select count(*)::int from catalogo.trilhas where id in (pg_temp.id('tr1'), pg_temp.id('tr2'))), 1,
  'aluno vê só a trilha publicada');
select is((select count(*)::int from catalogo.modulos where trilha_id = pg_temp.id('tr2')), 0,
  'aluno não vê módulos de trilha em rascunho');
select is((select count(*)::int from catalogo.modulos where trilha_id = pg_temp.id('tr1')), 2,
  'aluno vê os módulos da trilha publicada');
select is((select count(*)::int from catalogo.pre_requisitos_modulo where modulo_id = pg_temp.id('m2')), 1,
  'aluno vê os pré-requisitos de módulo publicado');
select pg_temp.volta();
select pg_temp.como('coord');
select is((select count(*)::int from catalogo.trilhas where id in (pg_temp.id('tr1'), pg_temp.id('tr2'))), 2,
  'coordenação vê trilhas publicadas e em rascunho');
select pg_temp.volta();

-- Invariantes por check constraint.
select pg_temp.como('coord');
select throws_ok($$insert into catalogo.trilhas (slug, nome, descricao) values ('Slug Ruim', 'Trilha X', 'Descrição com mais de dez caracteres')$$,
  '23514', null, 'slug fora do formato é recusado');
select throws_ok($$insert into catalogo.trilhas (slug, nome, descricao, media_minima) values ('media-alta', 'Trilha X', 'Descrição com mais de dez caracteres', 11)$$,
  '23514', null, 'média mínima acima de 10 é recusada');
select throws_ok($$insert into catalogo.trilhas (slug, nome, descricao, frequencia_minima_percentual) values ('freq-alta', 'Trilha X', 'Descrição com mais de dez caracteres', 101)$$,
  '23514', null, 'frequência mínima acima de 100 é recusada');
select throws_ok($$insert into catalogo.trilhas (slug, nome, descricao) values ('desc-curta', 'Trilha X', 'curta')$$,
  '23514', null, 'descrição com menos de 10 caracteres é recusada');
select throws_ok($$insert into catalogo.modulos (trilha_id, ordem, nome, descricao, nivel, carga_horaria_horas)
  values (pg_temp.id('tr1'), 9, 'Sem horas', 'Módulo com carga zero', 'iniciante', 0)$$,
  '23514', null, 'módulo com carga horária zero é recusado');
select pg_temp.volta();

-- A carga horária da trilha é a soma dos módulos e se recalcula sozinha.
select is((select carga_horaria_total from catalogo.trilhas where id = pg_temp.id('tr1')), 50,
  'carga horária da trilha é a soma dos módulos (20 + 30)');
insert into catalogo.modulos (trilha_id, ordem, nome, descricao, nivel, carga_horaria_horas)
  values (pg_temp.id('tr1'), 3, 'Modulo Quatro', 'Terceiro módulo de teste', 'avancado', 10);
select is((select carga_horaria_total from catalogo.trilhas where id = pg_temp.id('tr1')), 60,
  'a carga horária da trilha é recalculada ao entrar um módulo');

-- Pré-requisitos: sem autorreferência e sem ciclo, inclusive entre trilhas.
select pg_temp.como('coord');
select throws_like($$insert into catalogo.pre_requisitos_modulo values ('e2000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000001')$$,
  '%de si mesmo%', 'módulo não pode ser pré-requisito de si mesmo');
select throws_like($$insert into catalogo.pre_requisitos_modulo values ('e2000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000002')$$,
  '%ciclo%', 'pré-requisito que fecha ciclo direto é recusado');
select lives_ok($$insert into catalogo.pre_requisitos_modulo values ('e2000000-0000-4000-8000-000000000003', 'e2000000-0000-4000-8000-000000000001')$$,
  'módulo pode ter como pré-requisito um módulo de outra trilha');
select throws_like($$insert into catalogo.pre_requisitos_modulo values ('e2000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000003')$$,
  '%ciclo%', 'ciclo entre trilhas diferentes também é recusado');
select pg_temp.volta();

-- Trilha publicada não é apagada; a em rascunho sim.
select pg_temp.como('coord');
select throws_like($$delete from catalogo.trilhas where id = 'e1000000-0000-4000-8000-000000000001'$$,
  '%publicada%', 'trilha publicada não pode ser apagada');
select is(pg_temp.afetadas($$delete from catalogo.trilhas where id = 'e1000000-0000-4000-8000-000000000002'$$), 1,
  'trilha em rascunho pode ser apagada');
select pg_temp.volta();

-- Modelo de avaliações: o peso é positivo e a turma nova nasce com as avaliações do módulo.
insert into catalogo.avaliacoes_modelo (modulo_id, titulo, peso, ordem) values
  (pg_temp.id('m1'), 'Prova do modelo', 2, 1), (pg_temp.id('m1'), 'Projeto do modelo', 3, 2);
select pg_temp.como('coord');
select throws_ok($$insert into catalogo.avaliacoes_modelo (modulo_id, titulo, peso, ordem) values ('e2000000-0000-4000-8000-000000000001', 'Peso zero', 0, 3)$$,
  '23514', null, 'peso zero no modelo é recusado');
select lives_ok($$insert into selecao.turmas (id, modulo_id, codigo, professor_id, periodo_inicio, periodo_fim, vagas_total)
  values ('e3000000-0000-4000-8000-0000000000a1', 'e2000000-0000-4000-8000-000000000001', 'PGT-MODELO', 'a1000000-0000-4000-8000-000000000002', current_date, current_date + 30, 5)$$,
  'coordenação cria turma de módulo com modelo de avaliações');
select pg_temp.volta();
select is((select count(*)::int from diario.avaliacoes where turma_id = 'e3000000-0000-4000-8000-0000000000a1'), 2,
  'a turma nova herda as avaliações do modelo do módulo');
select is((select sum(peso)::int from diario.avaliacoes where turma_id = 'e3000000-0000-4000-8000-0000000000a1'), 5,
  'os pesos do modelo são copiados para a turma');

-- A frequência mínima da trilha é herdada pela turma nova.
update catalogo.trilhas set frequencia_minima_percentual = 80 where id = pg_temp.id('tr1');
insert into selecao.turmas (id, modulo_id, codigo, professor_id, periodo_inicio, periodo_fim, vagas_total)
  values ('e3000000-0000-4000-8000-0000000000a2', pg_temp.id('m2'), 'PGT-FREQ', pg_temp.id('prof1'), pg_temp.hoje(), pg_temp.hoje() + 30, 5);
select is((select frequencia_minima_percentual::int from selecao.turmas where id = 'e3000000-0000-4000-8000-0000000000a2'), 80,
  'a turma herda a frequência mínima da trilha');

-- Reordenar módulos: coordenação reordena; aluno não consegue.
select pg_temp.como('coord');
select lives_ok($$select catalogo.reordenar_modulos(array['e2000000-0000-4000-8000-000000000002'::uuid, 'e2000000-0000-4000-8000-000000000001'::uuid])$$,
  'coordenação reordena módulos');
select is((select ordem::int from catalogo.modulos where id = 'e2000000-0000-4000-8000-000000000002'), 1,
  'o módulo movido para a primeira posição recebe ordem 1');
select pg_temp.volta();
select pg_temp.como('al1');
select lives_ok($$select catalogo.reordenar_modulos(array['e2000000-0000-4000-8000-000000000001'::uuid, 'e2000000-0000-4000-8000-000000000002'::uuid])$$,
  'aluno chama reordenar_modulos sem erro...');
select pg_temp.volta();
select is((select ordem::int from catalogo.modulos where id = 'e2000000-0000-4000-8000-000000000002'), 1,
  '...mas a ordem dos módulos não muda');

-- Despublicar trilha desfaz os pré-requisitos que outras trilhas tinham sobre ela.
select pg_temp.como('coord');
select lives_ok($$update catalogo.trilhas set publicada = false where id = 'e1000000-0000-4000-8000-000000000001'$$,
  'coordenação despublica a trilha');
select pg_temp.volta();
select is((select count(*)::int from catalogo.pre_requisitos_modulo where modulo_id = pg_temp.id('m3') and pre_requisito_id = pg_temp.id('m1')), 0,
  'despublicar remove o pré-requisito que outra trilha tinha sobre ela');

select * from finish();
rollback;
