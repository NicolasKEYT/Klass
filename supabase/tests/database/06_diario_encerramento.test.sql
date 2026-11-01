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


select plan(38);

-- Encerramento de matrícula: aprovação, reprovação, trava de edição e reabertura.

-- Cenário: turma T1 (mínimos da trilha: média 7 e frequência 75%) com três
-- matriculadas e uma só inscrita; 3 aulas dentro do prazo e 2 avaliações (pesos 1 e 3).
update selecao.turmas set vagas_total = 4 where id = pg_temp.id('t1');
select pg_temp.matricular('al1', 't1');
select pg_temp.matricular('al4', 't1');
select pg_temp.matricular('al2', 't1');
insert into selecao.matriculas (aluno_id, turma_id) values (pg_temp.id('al3'), pg_temp.id('t1'));
create temp table aulas_t (chave text primary key, id uuid) on commit drop;
grant select on aulas_t to authenticated;
insert into aulas_t values ('a1', pg_temp.aula('t1', 5)), ('a2', pg_temp.aula('t1', 4)), ('a3', pg_temp.aula('t1', 3));
create temp table aval_t (chave text primary key, id uuid) on commit drop;
grant select on aval_t to authenticated;
insert into aval_t values ('p1', pg_temp.avaliacao('t1', 'Prova 1', 1)), ('p2', pg_temp.avaliacao('t1', 'Prova 2', 3));
-- al1: presente nas três aulas, notas 10 e 6 (média 7,00): aprovada.
select pg_temp.presenca(id, pg_temp.mat('al1', 't1'), true) from aulas_t;
select pg_temp.nota((select id from aval_t where chave = 'p1'), pg_temp.mat('al1', 't1'), 10);
select pg_temp.nota((select id from aval_t where chave = 'p2'), pg_temp.mat('al1', 't1'), 6);
-- al4: presente sempre, notas 3 e 3: reprovada por média.
select pg_temp.presenca(id, pg_temp.mat('al4', 't1'), true) from aulas_t;
select pg_temp.nota((select id from aval_t where chave = 'p1'), pg_temp.mat('al4', 't1'), 3);
select pg_temp.nota((select id from aval_t where chave = 'p2'), pg_temp.mat('al4', 't1'), 3);
-- al2: notas 10 e 10, mas presente em 1 de 3 aulas: reprovada por frequência.
select pg_temp.presenca((select id from aulas_t where chave = 'a1'), pg_temp.mat('al2', 't1'), true);
select pg_temp.presenca((select id from aulas_t where chave = 'a2'), pg_temp.mat('al2', 't1'), false);
select pg_temp.presenca((select id from aulas_t where chave = 'a3'), pg_temp.mat('al2', 't1'), false);
select pg_temp.nota((select id from aval_t where chave = 'p1'), pg_temp.mat('al2', 't1'), 10);
select pg_temp.nota((select id from aval_t where chave = 'p2'), pg_temp.mat('al2', 't1'), 10);

select is(diario.calcular_frequencia_percentual(pg_temp.mat('al2', 't1')), 33.33::numeric,
  'frequência de 1 presença em 3 aulas é 33,33%');
select is(diario.calcular_pronto_para_encerrar(pg_temp.mat('al1', 't1')), true,
  'matrícula com todas as notas e chamadas está pronta para encerrar');

-- Encerramento pelo professor da turma.
select pg_temp.como('prof1');
select lives_ok($$select diario.encerrar_matricula(pg_temp.mat('al1', 't1'))$$, 'professor encerra a matrícula aprovada');
select lives_ok($$select diario.encerrar_matricula(pg_temp.mat('al4', 't1'))$$, 'professor encerra a matrícula reprovada por média');
select lives_ok($$select diario.encerrar_matricula(pg_temp.mat('al2', 't1'))$$, 'professor encerra a matrícula reprovada por frequência');
select throws_like($$select diario.encerrar_matricula(pg_temp.mat('al1', 't1'))$$, '%ativa%',
  'matrícula já encerrada não é encerrada de novo');
select throws_like($$select diario.encerrar_matricula(pg_temp.mat('al3', 't1'))$$, '%ainda há%',
  'matrícula só inscrita não é encerrada');
select pg_temp.volta();

select is((select status::text from selecao.matriculas where id = pg_temp.mat('al1', 't1')), 'concluida',
  'média 7,00 e frequência 100% concluem a matrícula');
select is((select status::text from selecao.matriculas where id = pg_temp.mat('al4', 't1')), 'reprovada',
  'média abaixo do mínimo reprova');
select is((select status::text from selecao.matriculas where id = pg_temp.mat('al2', 't1')), 'reprovada',
  'frequência abaixo do mínimo reprova');
select alike((select motivo_conclusao from selecao.matriculas where id = pg_temp.mat('al4', 't1')), 'Média%',
  'o motivo da reprovação por média cita a média');
select alike((select motivo_conclusao from selecao.matriculas where id = pg_temp.mat('al2', 't1')), 'Frequência%',
  'o motivo da reprovação por frequência cita a frequência');
select is((select encerrada_por from selecao.matriculas where id = pg_temp.mat('al1', 't1')), pg_temp.id('prof1'),
  'o encerramento registra quem o fez');
select is((select count(*)::int from diario.historico_encerramentos where acao = 'encerrar' and turma_id = pg_temp.id('t1')), 3,
  'cada encerramento fica no histórico');
select is((select media from diario.historico_encerramentos where matricula_id = pg_temp.mat('al1', 't1')), 7.00::numeric,
  'o histórico guarda a média no momento do encerramento');

-- Depois do encerramento, nota e presença ficam travadas, e o status final não é editável.
select pg_temp.como('prof1');
select throws_like($$update diario.notas set valor = 10 where matricula_id = pg_temp.mat('al1', 't1')$$, '%encerrad%',
  'nota de matrícula encerrada não é alterada');
select throws_like($$delete from diario.notas where matricula_id = pg_temp.mat('al1', 't1')$$, '%encerrad%',
  'nota de matrícula encerrada não é apagada');
select throws_like($$update diario.presencas set presente = false where matricula_id = pg_temp.mat('al1', 't1')$$, '%encerrad%',
  'presença de matrícula encerrada não é alterada');
select throws_like($$update selecao.matriculas set status = 'concluida' where id = pg_temp.mat('al3', 't1')$$, '%encerramento%',
  'professor não define o status final por UPDATE direto');
select throws_like($$update selecao.matriculas set status = 'matriculada' where id = pg_temp.mat('al1', 't1')$$, '%Desfazer encerramento%',
  'professor não reabre matrícula encerrada por UPDATE');
select pg_temp.volta();

-- Quem enxerga o quê.
select pg_temp.como('al4');
select is((select count(*)::int from diario.notas where matricula_id = pg_temp.mat('al1', 't1')), 0,
  'aluno não vê as notas de outro aluno');
select is((select count(*)::int from diario.notas where matricula_id = pg_temp.mat('al4', 't1')), 2,
  'aluno vê as próprias notas');
select is((select count(*)::int from diario.historico_encerramentos), 0,
  'aluno não lê o histórico de encerramentos');
select pg_temp.volta();
select pg_temp.como('prof2');
select is((select count(*)::int from diario.historico_encerramentos), 0,
  'professor de outra turma não lê o histórico');
select pg_temp.volta();
select pg_temp.como('prof1');
select is((select count(*)::int from diario.historico_encerramentos where turma_id = pg_temp.id('t1')), 3,
  'o professor da turma lê o histórico');
select is(diario.pode_gerenciar_turma(pg_temp.id('t1')), true, 'professor gerencia a própria turma');
select pg_temp.volta();
select pg_temp.como('prof2');
select is(diario.pode_gerenciar_turma(pg_temp.id('t1')), false, 'professor de outra turma não a gerencia');
select pg_temp.volta();
select pg_temp.como('coord');
select is(diario.pode_gerenciar_turma(pg_temp.id('t1')), true, 'coordenação gerencia qualquer turma');
select pg_temp.volta();

-- Desfazer o encerramento: só a coordenação, com motivo, e fica registrado.
select pg_temp.como('prof1');
select throws_like($$select diario.desfazer_encerramento(pg_temp.mat('al1', 't1'), 'Quero mudar a nota depois')$$, '%apenas a coordenação%',
  'professor não desfaz encerramento');
select pg_temp.volta();
select pg_temp.como('coord');
select throws_like($$select diario.desfazer_encerramento(pg_temp.mat('al1', 't1'), 'curto')$$, '%motivo%',
  'desfazer encerramento exige motivo com 10 caracteres ou mais');
select lives_ok($$select diario.desfazer_encerramento(pg_temp.mat('al1', 't1'), 'Nota da prova 2 lançada errada')$$,
  'coordenação desfaz o encerramento com motivo');
select pg_temp.volta();
select is((select status::text from selecao.matriculas where id = pg_temp.mat('al1', 't1')), 'matriculada',
  'a matrícula volta a ficar ativa');
select is((select count(*)::int from diario.historico_encerramentos where acao = 'desfazer' and matricula_id = pg_temp.mat('al1', 't1')), 1,
  'o desfazer fica no histórico');
select is((select motivo from diario.historico_encerramentos where acao = 'desfazer' and matricula_id = pg_temp.mat('al1', 't1')),
  'Nota da prova 2 lançada errada', 'o histórico guarda o motivo informado');
select pg_temp.como('prof1');
select lives_ok($$update diario.notas set valor = 8 where matricula_id = pg_temp.mat('al1', 't1') and avaliacao_id = (select id from aval_t where chave = 'p2')$$,
  'com a matrícula reaberta, o professor corrige a nota');
select lives_ok($$select diario.encerrar_matricula(pg_temp.mat('al1', 't1'))$$,
  'e encerra a matrícula de novo');
select pg_temp.volta();
select is((select status::text from selecao.matriculas where id = pg_temp.mat('al1', 't1')), 'concluida',
  'com a nota corrigida (média 8,50), a matrícula conclui de novo');

-- Reativar turma também é da coordenação e exige motivo.
select pg_temp.como('prof1');
select throws_like($$select diario.reativar_turma(pg_temp.id('t1'), 'Reabrir para novas notas')$$, '%coordenação%',
  'professor não reativa turma');
select pg_temp.volta();

select * from finish();
rollback;
