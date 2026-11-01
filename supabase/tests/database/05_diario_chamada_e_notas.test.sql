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


select plan(24);

-- Contexto Diário de Classe: chamada, notas, encerramento e travas.

-- Cenário: turma T1 com quatro vagas, duas matriculadas (al1, al4), uma inscrita (al3).
update selecao.turmas set vagas_total = 4 where id = pg_temp.id('t1');
select pg_temp.matricular('al1', 't1');
select pg_temp.matricular('al4', 't1');
insert into selecao.matriculas (aluno_id, turma_id) values (pg_temp.id('al3'), pg_temp.id('t1'));
create temp table aulas_t (chave text primary key, id uuid) on commit drop;
grant select on aulas_t to authenticated;
insert into aulas_t values ('a1', pg_temp.aula('t1', 5)), ('a2', pg_temp.aula('t1', 4)),
  ('antiga', pg_temp.aula('t1', 12));
insert into diario.aulas (turma_id, data) values (pg_temp.id('t1'), pg_temp.hoje() + 3);
create temp table aval_t (chave text primary key, id uuid) on commit drop;
grant select on aval_t to authenticated;
insert into aval_t values ('p1', pg_temp.avaliacao('t1', 'Prova 1', 1)), ('p2', pg_temp.avaliacao('t1', 'Prova 2', 3));

-- Chamada: o professor da turma registra; aula futura e prazo vencido são recusados.
select pg_temp.como('prof1');
select lives_ok($$insert into diario.presencas (aula_id, matricula_id, presente, registrada_por)
  select (select id from aulas_t where chave = 'a1'), pg_temp.mat('al1', 't1'), true, auth.uid()$$,
  'professor registra a presença de uma aula recente');
select throws_like($$insert into diario.presencas (aula_id, matricula_id, presente, registrada_por)
  select a.id, pg_temp.mat('al1', 't1'), true, auth.uid() from diario.aulas a
  where a.turma_id = 'e3000000-0000-4000-8000-000000000001' and a.data > current_date + 1$$,
  '%futura%', 'chamada de aula futura é recusada');
select throws_like($$insert into diario.presencas (aula_id, matricula_id, presente, registrada_por)
  select (select id from aulas_t where chave = 'antiga'), pg_temp.mat('al1', 't1'), true, auth.uid()$$,
  '%prazo%', 'chamada de aula com mais de 7 dias é recusada para o professor');
select throws_ok($$select diario.liberar_chamada((select id from aulas_t where chave = 'antiga'))$$,
  'P0001', null, 'professor não libera a própria chamada fora do prazo');
select pg_temp.volta();
select pg_temp.como('coord');
select lives_ok($$select diario.liberar_chamada((select id from aulas_t where chave = 'antiga'))$$,
  'coordenação libera a chamada de uma aula fora do prazo');
select pg_temp.volta();
select pg_temp.como('prof1');
select lives_ok($$insert into diario.presencas (aula_id, matricula_id, presente, registrada_por)
  select (select id from aulas_t where chave = 'antiga'), pg_temp.mat('al1', 't1'), true, auth.uid()$$,
  'depois da liberação, o professor faz a chamada fora do prazo');
select pg_temp.volta();

-- Quem não é da turma não mexe no diário.
select pg_temp.como('prof2');
select throws_like($$insert into diario.aulas (turma_id, data) values ('e3000000-0000-4000-8000-000000000001', current_date)$$,
  '%gerenciar o diário%', 'professor de outra turma não cria aula');
select throws_like($$insert into diario.avaliacoes (turma_id, titulo, peso, ordem) values ('e3000000-0000-4000-8000-000000000001', 'Invasora', 1, 9)$$,
  '%gerenciar o diário%', 'professor de outra turma não cria avaliação');
select pg_temp.volta();
select pg_temp.como('al1');
select throws_ok($$insert into diario.presencas (aula_id, matricula_id, presente, registrada_por)
  select (select id from aulas_t where chave = 'a1'), pg_temp.mat('al1', 't1'), true, auth.uid()$$,
  '42501', null, 'aluno não registra a própria presença');
select throws_ok($$insert into diario.notas (avaliacao_id, matricula_id, valor, lancada_por)
  select (select id from aval_t where chave = 'p1'), pg_temp.mat('al1', 't1'), 10, auth.uid()$$,
  '42501', null, 'aluno não lança a própria nota');
select pg_temp.volta();

-- Nota: faixa de 0 a 10, uma por avaliação e só para matrícula ativa da turma.
select pg_temp.como('prof1');
select lives_ok($$insert into diario.notas (avaliacao_id, matricula_id, valor, lancada_por)
  select (select id from aval_t where chave = 'p1'), pg_temp.mat('al1', 't1'), 10, auth.uid()$$,
  'professor lança nota 10');
select throws_ok($$insert into diario.notas (avaliacao_id, matricula_id, valor, lancada_por)
  select (select id from aval_t where chave = 'p1'), pg_temp.mat('al4', 't1'), 10.5, auth.uid()$$,
  '23514', null, 'nota acima de 10 é recusada');
select throws_ok($$insert into diario.notas (avaliacao_id, matricula_id, valor, lancada_por)
  select (select id from aval_t where chave = 'p1'), pg_temp.mat('al4', 't1'), -1, auth.uid()$$,
  '23514', null, 'nota negativa é recusada');
select throws_ok($$insert into diario.notas (avaliacao_id, matricula_id, valor, lancada_por)
  select (select id from aval_t where chave = 'p1'), pg_temp.mat('al4', 't1'), 100, auth.uid()$$,
  '22003', null, 'nota de três dígitos estoura o tipo numérico antes do check (a interface traduz esse erro)');
select throws_ok($$insert into diario.notas (avaliacao_id, matricula_id, valor, lancada_por)
  select (select id from aval_t where chave = 'p1'), pg_temp.mat('al1', 't1'), 9, auth.uid()$$,
  '23505', null, 'segunda nota para a mesma avaliação e matrícula é recusada');
select throws_like($$insert into diario.notas (avaliacao_id, matricula_id, valor, lancada_por)
  select (select id from aval_t where chave = 'p1'), pg_temp.mat('al3', 't1'), 7, auth.uid()$$,
  '%matrícula ativa%', 'nota para matrícula apenas inscrita é recusada');
select pg_temp.volta();
select pg_temp.matricular('al2', 't3');
insert into diario.avaliacoes (id, turma_id, titulo, peso, ordem)
  values ('e3000000-0000-4000-8000-0000000000b1', pg_temp.id('t3'), 'Prova da outra turma', 1, 1);
select pg_temp.como('prof1');
select throws_like($$insert into diario.notas (avaliacao_id, matricula_id, valor, lancada_por)
  select 'e3000000-0000-4000-8000-0000000000b1', pg_temp.mat('al1', 't1'), 5, auth.uid()$$,
  '%não pertence à turma%', 'nota de matrícula em avaliação de outra turma é recusada');
select throws_ok($$insert into diario.notas (avaliacao_id, matricula_id, valor, lancada_por)
  select 'e3000000-0000-4000-8000-0000000000b1', pg_temp.mat('al2', 't3'), 5, auth.uid()$$,
  '42501', null, 'professor não lança nota em turma que não leciona');
select pg_temp.volta();

-- Média ponderada e frequência (funções abertas ao professor e ao aluno da matrícula).
select pg_temp.nota((select id from aval_t where chave = 'p2'), pg_temp.mat('al1', 't1'), 6);
select pg_temp.como('prof1');
select is(diario.media_ponderada(pg_temp.mat('al1', 't1')), 7.00::numeric,
  'média ponderada de 10 (peso 1) e 6 (peso 3) é 7,00');
select pg_temp.volta();
select pg_temp.como('al1');
select is(diario.media_ponderada(pg_temp.mat('al1', 't1')), 7.00::numeric,
  'o aluno consulta a própria média');
select pg_temp.volta();
select pg_temp.como('al4');
select throws_like($$select diario.media_ponderada(pg_temp.mat('al1', 't1'))$$, '%permiss%',
  'aluno não consulta a média de outro aluno');
select pg_temp.volta();

-- Prontidão para encerrar: exige nota em toda avaliação e chamada em toda aula.
select pg_temp.como('prof1');
select is(diario.pronto_para_encerrar(pg_temp.mat('al4', 't1')), false,
  'matrícula sem notas nem chamadas não está pronta para encerrar');
select throws_like($$select diario.encerrar_matricula(pg_temp.mat('al4', 't1'))$$, '%ainda há%',
  'encerrar matrícula incompleta é recusado');
select pg_temp.volta();
select pg_temp.como('al1');
select throws_like($$select diario.encerrar_matricula(pg_temp.mat('al1', 't1'))$$, '%apenas o professor%',
  'aluno não encerra a própria matrícula');
select pg_temp.volta();

select * from finish();
rollback;
