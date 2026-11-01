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

-- Contexto Motor de Seleção: inscrição, regras de matrícula e deferimento.

-- Inscrição pelo aluno: a matrícula nasce "inscrita" e em nome de quem chamou.
select pg_temp.como('al1');
select lives_ok($$select selecao.inscrever_aluno('e3000000-0000-4000-8000-000000000001')$$,
  'aluno se inscreve em uma turma com vaga');
select is((select status::text from selecao.matriculas where turma_id = pg_temp.id('t1')), 'inscrita',
  'a matrícula nasce com status inscrita');
select is((select aluno_id from selecao.matriculas where turma_id = pg_temp.id('t1')), pg_temp.id('al1'),
  'a matrícula fica em nome do aluno autenticado');
select throws_like($$select selecao.inscrever_aluno('e3000000-0000-4000-8000-000000000001')$$,
  '%matrícula ativa neste módulo%', 'inscrição repetida na mesma turma é recusada');
select throws_like($$select selecao.inscrever_aluno('e3000000-0000-4000-8000-000000000003')$$,
  '%matrícula ativa neste módulo%', 'segunda inscrição ativa no mesmo módulo, em outra turma, é recusada');
select pg_temp.volta();

-- Quem se inscreve não consegue se aprovar nem inscrever outra pessoa.
select pg_temp.como('al1');
select throws_like($$insert into selecao.matriculas (aluno_id, turma_id) values ('b1000000-0000-4000-8000-000000000002', 'e3000000-0000-4000-8000-000000000001')$$,
  '%outro aluno%', 'aluno não inscreve outro aluno');
select throws_like($$update selecao.matriculas set status = 'matriculada', deferido_por = auth.uid() where turma_id = 'e3000000-0000-4000-8000-000000000001'$$,
  '%permissão%', 'aluno não se defere sozinho, nem registrando a si mesmo como quem deferiu');
select throws_like($$update selecao.matriculas set status = 'concluida' where turma_id = 'e3000000-0000-4000-8000-000000000001'$$,
  '%encerramento%', 'aluno não se declara concluído');
select pg_temp.volta();

-- Vagas, período e pré-requisitos.
select pg_temp.matricular('al2', 't3');
select pg_temp.como('al3');
select throws_like($$select selecao.inscrever_aluno('e3000000-0000-4000-8000-000000000003')$$,
  '%sem vagas%', 'turma lotada recusa nova inscrição');
select throws_like($$select selecao.inscrever_aluno('e3000000-0000-4000-8000-000000000004')$$,
  '%encerradas%', 'turma com período encerrado recusa inscrição');
select throws_like($$select selecao.inscrever_aluno('e3000000-0000-4000-8000-000000000002')$$,
  '%precisa concluir%Modulo Um%', 'módulo com pré-requisito não concluído recusa inscrição');
select pg_temp.volta();
-- Com o pré-requisito concluído, a inscrição passa.
insert into selecao.matriculas (aluno_id, turma_id, status, deferido_por, deferido_em, encerrada_em)
  values (pg_temp.id('al3'), pg_temp.id('t4'), 'concluida', pg_temp.id('coord'), now(), now());
select pg_temp.como('al3');
select lives_ok($$select selecao.inscrever_aluno('e3000000-0000-4000-8000-000000000002')$$,
  'com o pré-requisito concluído, a inscrição no módulo seguinte é aceita');
select pg_temp.volta();

-- Cancelamento pelo aluno.
select pg_temp.como('al1');
select lives_ok($$select selecao.cancelar_inscricao((select id from selecao.matriculas where turma_id = 'e3000000-0000-4000-8000-000000000001'))$$,
  'aluno cancela a própria inscrição');
select is((select status::text from selecao.matriculas where turma_id = pg_temp.id('t1')), 'cancelada',
  'a matrícula passa a cancelada');
select pg_temp.volta();

-- Deferimento pela coordenação.
select pg_temp.como('al4');
select selecao.inscrever_aluno('e3000000-0000-4000-8000-000000000001');
select pg_temp.volta();
select pg_temp.como('coord');
select throws_like($$update selecao.matriculas set status = 'matriculada' where turma_id = 'e3000000-0000-4000-8000-000000000001' and aluno_id = 'b1000000-0000-4000-8000-000000000004'$$,
  '%informe quem aprovou%', 'deferir exige registrar quem deferiu');
select lives_ok($$update selecao.matriculas set status = 'matriculada', deferido_por = auth.uid() where turma_id = 'e3000000-0000-4000-8000-000000000001' and aluno_id = 'b1000000-0000-4000-8000-000000000004'$$,
  'coordenação defere a inscrição');
select isnt((select deferido_em from selecao.matriculas where turma_id = pg_temp.id('t1') and aluno_id = pg_temp.id('al4')), null,
  'o deferimento registra a data');
select pg_temp.volta();

-- Rejeição exige motivo.
select pg_temp.como('al3');
select selecao.inscrever_aluno('e3000000-0000-4000-8000-000000000001');
select pg_temp.volta();
select pg_temp.como('coord');
select throws_like($$update selecao.matriculas set status = 'rejeitada', deferido_por = auth.uid() where turma_id = 'e3000000-0000-4000-8000-000000000001' and aluno_id = 'b1000000-0000-4000-8000-000000000003'$$,
  '%motivo da rejeição%', 'rejeitar sem motivo é recusado');
select lives_ok($$update selecao.matriculas set status = 'rejeitada', deferido_por = auth.uid(), motivo_rejeicao = 'Vaga destinada a outro perfil' where turma_id = 'e3000000-0000-4000-8000-000000000001' and aluno_id = 'b1000000-0000-4000-8000-000000000003'$$,
  'rejeitar com motivo é aceito');
select pg_temp.volta();

-- Visibilidade das matrículas.
select pg_temp.como('al4');
select is((select count(distinct aluno_id)::int from selecao.matriculas), 1, 'aluno vê só as próprias matrículas');
select pg_temp.volta();
select pg_temp.como('prof2');
select is((select count(*)::int from selecao.matriculas where turma_id <> pg_temp.id('t3')), 0,
  'professor vê só matrículas das turmas que leciona');
select cmp_ok((select count(*)::int from selecao.matriculas where turma_id = pg_temp.id('t3')), '>=', 1,
  'professor vê as matrículas da própria turma');
select pg_temp.volta();
select pg_temp.como('coord');
select cmp_ok((select count(distinct aluno_id)::int from selecao.matriculas where turma_id in (pg_temp.id('t1'), pg_temp.id('t3'), pg_temp.id('t4'))), '>=', 3,
  'coordenação vê as matrículas de todos');
select pg_temp.volta();

-- Turmas: invariantes e visibilidade.
select pg_temp.como('coord');
select throws_ok($$insert into selecao.turmas (modulo_id, codigo, professor_id, periodo_inicio, periodo_fim, vagas_total)
  values ('e2000000-0000-4000-8000-000000000001', 'codigo ruim', 'a1000000-0000-4000-8000-000000000002', current_date, current_date + 10, 5)$$,
  '23514', null, 'código de turma fora do formato é recusado');
select throws_ok($$insert into selecao.turmas (modulo_id, codigo, professor_id, periodo_inicio, periodo_fim, vagas_total)
  values ('e2000000-0000-4000-8000-000000000001', 'PGT-X1', 'a1000000-0000-4000-8000-000000000002', current_date + 10, current_date, 5)$$,
  '23514', null, 'período com fim antes do início é recusado');
select throws_ok($$insert into selecao.turmas (modulo_id, codigo, professor_id, periodo_inicio, periodo_fim, vagas_total)
  values ('e2000000-0000-4000-8000-000000000001', 'PGT-X2', 'a1000000-0000-4000-8000-000000000002', current_date, current_date + 10, 0)$$,
  '23514', null, 'turma sem vagas é recusada');
select throws_like($$insert into selecao.turmas (modulo_id, codigo, professor_id, periodo_inicio, periodo_fim, vagas_total)
  values ('e2000000-0000-4000-8000-000000000001', 'PGT-X3', 'b1000000-0000-4000-8000-000000000001', current_date, current_date + 10, 5)$$,
  '%professor%', 'a turma só aceita como docente quem tem papel de professor');
select pg_temp.volta();
insert into selecao.turmas (id, modulo_id, codigo, professor_id, periodo_inicio, periodo_fim, vagas_total)
  values ('e3000000-0000-4000-8000-0000000000a3', pg_temp.id('m3'), 'PGT-VAGAS', pg_temp.id('prof1'), pg_temp.hoje(), pg_temp.hoje() + 30, 3);
insert into selecao.matriculas (aluno_id, turma_id, status, deferido_por, deferido_em) values
  (pg_temp.id('al1'), 'e3000000-0000-4000-8000-0000000000a3', 'matriculada', pg_temp.id('coord'), now()),
  (pg_temp.id('al2'), 'e3000000-0000-4000-8000-0000000000a3', 'matriculada', pg_temp.id('coord'), now());
select pg_temp.como('coord');
select throws_like($$update selecao.turmas set vagas_total = 1 where id = 'e3000000-0000-4000-8000-0000000000a3'$$,
  '%vagas%', 'não se reduzem as vagas abaixo do número de matriculados');
select pg_temp.volta();
select pg_temp.como('prof1');
select throws_ok($$insert into selecao.turmas (modulo_id, codigo, professor_id, periodo_inicio, periodo_fim, vagas_total)
  values ('e2000000-0000-4000-8000-000000000001', 'PGT-X4', 'a1000000-0000-4000-8000-000000000002', current_date, current_date + 10, 5)$$,
  '42501', null, 'professor não cria turma');
select pg_temp.volta();
select pg_temp.como('al1');
select is((select count(*)::int from selecao.turmas where modulo_id = pg_temp.id('m3')), 0,
  'aluno não vê turmas de trilha em rascunho');
select cmp_ok((select count(*)::int from selecao.turmas where modulo_id = pg_temp.id('m1')), '>=', 3,
  'aluno vê as turmas de trilha publicada');
select pg_temp.volta();

-- Ocupação: conta inscritas e matriculadas por turma.
select pg_temp.como('coord');
select is((select matriculadas::int from selecao.ocupacao_turmas(array[pg_temp.id('t3')])), 1,
  'ocupacao_turmas conta a matriculada da turma lotada');
select pg_temp.volta();

select * from finish();
rollback;
