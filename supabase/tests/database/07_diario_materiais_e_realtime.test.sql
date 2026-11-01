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

-- Materiais da turma (Storage + registro no diário) e tabelas publicadas no Realtime.

-- A tela do aluno reage a mudanças sem recarregar: as tabelas do diário e as matrículas
-- estão na publicação do Realtime.
select ok(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'diario' and tablename = 'notas'),
  'diario.notas está na publicação do Realtime');
select ok(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'diario' and tablename = 'presencas'),
  'diario.presencas está na publicação do Realtime');
select ok(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'diario' and tablename = 'avaliacoes'),
  'diario.avaliacoes está na publicação do Realtime');
select ok(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'diario' and tablename = 'aulas'),
  'diario.aulas está na publicação do Realtime');
select ok(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'selecao' and tablename = 'matriculas'),
  'selecao.matriculas está na publicação do Realtime');

-- Cenário: al1 matriculada em T1, al3 só inscrita.
update selecao.turmas set vagas_total = 4 where id = pg_temp.id('t1');
select pg_temp.matricular('al1', 't1');
insert into selecao.matriculas (aluno_id, turma_id) values (pg_temp.id('al3'), pg_temp.id('t1'));

-- O registro do material só entra se o arquivo existe no Storage; tamanho e tipo vêm do arquivo.
select pg_temp.como('prof1');
select throws_like($$insert into diario.materiais (turma_id, titulo, caminho, nome_arquivo, tipo_mime, tamanho_bytes, enviado_por)
  values ('e3000000-0000-4000-8000-000000000001', 'Apostila', 'e3000000-0000-4000-8000-000000000001/apostila.pdf', 'apostila.pdf', 'application/pdf', 10, auth.uid())$$,
  '%arquivo não encontrado%', 'material sem arquivo no Storage é recusado');
select pg_temp.volta();
insert into storage.objects (bucket_id, name, metadata) values
  ('materiais', 'e3000000-0000-4000-8000-000000000001/apostila.pdf', '{"size": 2048, "mimetype": "application/pdf"}'),
  ('materiais', 'e3000000-0000-4000-8000-000000000001/virus.exe', '{"size": 2048, "mimetype": "application/x-msdownload"}'),
  ('materiais', 'e3000000-0000-4000-8000-000000000003/outra.pdf', '{"size": 2048, "mimetype": "application/pdf"}'),
  ('materiais', 'e3000000-0000-4000-8000-000000000001/gigante.pdf', jsonb_build_object('size', diario.tamanho_maximo_material() + 1, 'mimetype', 'application/pdf'));
select pg_temp.como('prof1');
select lives_ok($$insert into diario.materiais (turma_id, titulo, caminho, nome_arquivo, tipo_mime, tamanho_bytes, enviado_por)
  values ('e3000000-0000-4000-8000-000000000001', 'Apostila', 'e3000000-0000-4000-8000-000000000001/apostila.pdf', 'apostila.pdf', 'application/pdf', 1, auth.uid())$$,
  'material com arquivo no Storage é registrado');
select is((select tamanho_bytes from diario.materiais where titulo = 'Apostila'), 2048::bigint,
  'o tamanho registrado vem do arquivo, não do cliente');
select throws_ok($$insert into diario.materiais (turma_id, titulo, caminho, nome_arquivo, tipo_mime, tamanho_bytes, enviado_por)
  values ('e3000000-0000-4000-8000-000000000001', 'Executável', 'e3000000-0000-4000-8000-000000000001/virus.exe', 'virus.exe', 'application/x-msdownload', 1, auth.uid())$$,
  '23514', null, 'tipo de arquivo fora da lista permitida é recusado');
select throws_ok($$insert into diario.materiais (turma_id, titulo, caminho, nome_arquivo, tipo_mime, tamanho_bytes, enviado_por)
  values ('e3000000-0000-4000-8000-000000000001', 'Gigante', 'e3000000-0000-4000-8000-000000000001/gigante.pdf', 'gigante.pdf', 'application/pdf', 1, auth.uid())$$,
  '23514', null, 'arquivo acima do limite de tamanho é recusado');
select throws_ok($$insert into diario.materiais (turma_id, titulo, caminho, nome_arquivo, tipo_mime, tamanho_bytes, enviado_por)
  values ('e3000000-0000-4000-8000-000000000001', 'Da outra turma', 'e3000000-0000-4000-8000-000000000003/outra.pdf', 'outra.pdf', 'application/pdf', 1, auth.uid())$$,
  '23514', null, 'o caminho do arquivo precisa começar pela turma do material');
select pg_temp.volta();

-- Quem lê e quem escreve.
select pg_temp.como('al1');
select is((select count(*)::int from diario.materiais), 1, 'aluno matriculado lê os materiais da turma');
select is((select count(*)::int from storage.objects where bucket_id = 'materiais' and name like 'e3000000-0000-4000-8000-000000000001/%'), 3,
  'aluno matriculado lê os arquivos da turma no Storage');
select throws_ok($$insert into diario.materiais (turma_id, titulo, caminho, nome_arquivo, tipo_mime, tamanho_bytes, enviado_por)
  values ('e3000000-0000-4000-8000-000000000001', 'Do aluno', 'e3000000-0000-4000-8000-000000000001/apostila.pdf', 'apostila.pdf', 'application/pdf', 1, auth.uid())$$,
  '42501', null, 'aluno não registra material');
select is(pg_temp.afetadas($$delete from diario.materiais$$), 0, 'aluno não apaga material');
select pg_temp.volta();
select pg_temp.como('al3');
select is((select count(*)::int from diario.materiais), 0, 'aluno apenas inscrito não lê os materiais');
select is((select count(*)::int from storage.objects where bucket_id = 'materiais'), 0,
  'aluno apenas inscrito não lê os arquivos no Storage');
select pg_temp.volta();
select pg_temp.como('prof2');
select is((select count(*)::int from diario.materiais), 0, 'professor de outra turma não lê os materiais');
select pg_temp.volta();
select pg_temp.como('coord');
select is((select count(*)::int from diario.materiais), 1, 'coordenação lê os materiais');
select pg_temp.volta();
select pg_temp.como('prof1');
select is(pg_temp.afetadas($$delete from diario.materiais where titulo = 'Apostila'$$), 1,
  'professor da turma apaga o registro do material');
select pg_temp.volta();

select * from finish();
rollback;
