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


select plan(36);

-- Contexto Certificação: emissão por trigger, três modos, verificação pública e revogação.

-- Cenário: cada turma (T1 do módulo 1, T2 do módulo 2) tem uma aula e uma avaliação;
-- pg_temp.concluir matricula, lança chamada e nota e encerra como o professor da turma.
update selecao.turmas set vagas_total = 6 where id in (pg_temp.id('t1'), pg_temp.id('t2'));
select pg_temp.aula('t1', 2);
select pg_temp.aula('t2', 2);
select pg_temp.avaliacao('t1', 'Prova', 1);
select pg_temp.avaliacao('t2', 'Prova', 1);
create function pg_temp.concluir(p_aluno text, p_turma text, p_nota numeric) returns void
language plpgsql security definer as $$
declare v_mat uuid;
begin
  v_mat := pg_temp.matricular(p_aluno, p_turma);
  perform pg_temp.presenca((select id from diario.aulas where turma_id = pg_temp.id(p_turma)), v_mat, true);
  perform pg_temp.nota((select id from diario.avaliacoes where turma_id = pg_temp.id(p_turma)), v_mat, p_nota);
  perform set_config('request.jwt.claims', json_build_object('sub', pg_temp.id('prof1'))::text, true);
  perform diario.aplicar_encerramento(v_mat);
  perform set_config('request.jwt.claims', '', true);
end $$;

create function pg_temp.cert_al1() returns table (hash_publico text)
language sql security definer as $$
  select c.hash_publico from certificacao.certificados c where c.aluno_id = pg_temp.id('al1') order by c.emitido_em limit 1
$$;

-- Modo "módulo" (o da trilha do cenário): concluir o módulo emite o certificado do módulo.
select pg_temp.concluir('al1', 't1', 9);
select is((select count(*)::int from certificacao.certificados where aluno_id = pg_temp.id('al1')), 1,
  'concluir o módulo emite um certificado');
select is((select modulo_id from certificacao.certificados where aluno_id = pg_temp.id('al1')), pg_temp.id('m1'),
  'o certificado é do módulo concluído');
select is((select modulo_nome from certificacao.certificados where aluno_id = pg_temp.id('al1')), 'Modulo Um',
  'o certificado guarda o nome do módulo no momento da emissão');
select is((select turma_codigo from certificacao.certificados where aluno_id = pg_temp.id('al1')), 'PGT-A1',
  'o certificado guarda o código da turma');
select is((select nota_final from certificacao.certificados where aluno_id = pg_temp.id('al1')), 9.00::numeric,
  'o certificado guarda a nota final');
select is((select aluno_nome from certificacao.certificados where aluno_id = pg_temp.id('al1')), 'Pessoa al1',
  'o certificado guarda o nome do aluno');
select matches((select hash_publico from certificacao.certificados where aluno_id = pg_temp.id('al1')),
  '^KLASS-\d{4}-[A-Z0-9]{8}$', 'o código público segue o formato KLASS-AAAA-XXXXXXXX');
select is((select count(*)::int from certificacao.certificados where aluno_id = pg_temp.id('al1') and modulo_id is null), 0,
  'no modo módulo, nada é emitido para a trilha');

-- Reprovação não emite certificado.
select pg_temp.concluir('al4', 't1', 3);
select is((select status::text from selecao.matriculas where id = pg_temp.mat('al4', 't1')), 'reprovada',
  'nota 3 com média mínima 7 reprova');
select is((select count(*)::int from certificacao.certificados where aluno_id = pg_temp.id('al4')), 0,
  'matrícula reprovada não gera certificado');

-- Verificação pública, sem login.
select pg_temp.como_anon();
select is((select count(*)::int from certificacao.verificar_por_hash((select hash_publico from pg_temp.cert_al1()))), 1,
  'qualquer pessoa verifica um certificado pelo código, sem login');
select is((select aluno_nome from certificacao.verificar_por_hash((select hash_publico from pg_temp.cert_al1()))), 'Pessoa al1',
  'a verificação pública mostra o nome do titular');
select is((select revogado from certificacao.verificar_por_hash((select hash_publico from pg_temp.cert_al1()))), false,
  'a verificação pública informa que o certificado não está revogado');
select is((select count(*)::int from certificacao.verificar_por_hash('KLASS-2026-INEXISTE')), 0,
  'código inexistente não devolve nada');
select pg_temp.volta();

-- Quem lê e quem escreve na tabela de certificados.
select pg_temp.como('al1');
select is((select count(*)::int from certificacao.certificados), 1, 'aluno vê só os próprios certificados');
select throws_ok($$insert into certificacao.certificados (hash_publico, aluno_id, trilha_id, aluno_nome, trilha_nome)
  values ('KLASS-2026-FALSO001', 'b1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 'Pessoa al1', 'Trilha')$$,
  '42501', null, 'aluno não emite certificado por conta própria');
select throws_ok($$update certificacao.certificados set aluno_nome = 'Outro Nome'$$, '42501', null,
  'aluno não altera certificado');
select throws_ok($$delete from certificacao.certificados$$, '42501', null, 'aluno não apaga certificado');
select pg_temp.volta();
select pg_temp.como('al4');
select is((select count(*)::int from certificacao.certificados), 0, 'aluno sem certificado não vê o de outro');
select pg_temp.volta();
select pg_temp.como('prof1');
select throws_ok($$insert into certificacao.certificados (hash_publico, aluno_id, trilha_id, aluno_nome, trilha_nome)
  values ('KLASS-2026-FALSO002', 'b1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 'Pessoa al1', 'Trilha')$$,
  '42501', null, 'professor não emite certificado');
select pg_temp.volta();
select pg_temp.como('coord');
select throws_ok($$insert into certificacao.certificados (hash_publico, aluno_id, trilha_id, aluno_nome, trilha_nome)
  values ('KLASS-2026-FALSO003', 'b1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 'Pessoa al1', 'Trilha')$$,
  '42501', null, 'nem a coordenação emite certificado direto pela API');
select cmp_ok((select count(*)::int from certificacao.certificados), '>=', 1, 'coordenação vê os certificados emitidos');
select pg_temp.volta();

-- Unicidade: um certificado válido por aluno e módulo.
select throws_ok($$insert into certificacao.certificados (hash_publico, aluno_id, trilha_id, modulo_id, aluno_nome, trilha_nome)
  values ('KLASS-2026-DUPLICA1', 'b1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000001', 'Pessoa al1', 'Trilha')$$,
  '23505', null, 'não existem dois certificados válidos do mesmo aluno para o mesmo módulo');

-- Revogação: desfazer o encerramento revoga o certificado e a verificação pública informa.
select pg_temp.como('coord');
select is((select (diario.desfazer_encerramento(pg_temp.mat('al1', 't1'), 'Nota lançada para o aluno errado') ->> 'certificados_revogados')::int), 1,
  'desfazer o encerramento revoga o certificado e informa quantos');
select pg_temp.volta();
select isnt((select revogado_em from certificacao.certificados where aluno_id = pg_temp.id('al1')), null,
  'o certificado revogado guarda a data');
select alike((select motivo_revogacao from certificacao.certificados where aluno_id = pg_temp.id('al1')), '%Nota lançada para o aluno errado',
  'o certificado revogado guarda o motivo informado pela coordenação');
select pg_temp.como_anon();
select is((select revogado from certificacao.verificar_por_hash((select hash_publico from pg_temp.cert_al1()))), true,
  'a verificação pública informa que o certificado foi revogado');
select pg_temp.volta();

-- Depois de reencerrar, um novo certificado é emitido e o revogado continua revogado.
select pg_temp.como('prof1');
select lives_ok($$select diario.encerrar_matricula(pg_temp.mat('al1', 't1'))$$, 'matrícula reaberta é encerrada de novo');
select pg_temp.volta();
select is((select count(*)::int from certificacao.certificados where aluno_id = pg_temp.id('al1') and revogado_em is null), 1,
  'o novo encerramento emite um novo certificado válido');
select is((select count(*)::int from certificacao.certificados where aluno_id = pg_temp.id('al1')), 2,
  'o certificado revogado é mantido ao lado do novo');

-- Modo "trilha": só quando todos os módulos fecham, e sem certificado de módulo.
update catalogo.trilhas set tipo_certificacao = 'trilha' where id = pg_temp.id('tr1');
select pg_temp.concluir('al2', 't1', 8);
select is((select count(*)::int from certificacao.certificados where aluno_id = pg_temp.id('al2')), 0,
  'modo trilha: concluir só o primeiro módulo não emite nada');
select pg_temp.concluir('al2', 't2', 8);
select is((select count(*)::int from certificacao.certificados where aluno_id = pg_temp.id('al2')), 1,
  'modo trilha: concluir todos os módulos emite um único certificado');
select is((select modulo_id from certificacao.certificados where aluno_id = pg_temp.id('al2')), null,
  'modo trilha: o certificado é da trilha, não de um módulo');

-- Modo "módulo e trilha": cada módulo emite o seu, e o último emite também o da trilha.
update catalogo.trilhas set tipo_certificacao = 'modulo_e_trilha' where id = pg_temp.id('tr1');
select pg_temp.concluir('al3', 't1', 8);
select is((select count(*)::int from certificacao.certificados where aluno_id = pg_temp.id('al3')), 1,
  'modo módulo e trilha: o primeiro módulo emite o certificado do módulo');
select pg_temp.concluir('al3', 't2', 8);
select is((select count(*)::int from certificacao.certificados where aluno_id = pg_temp.id('al3')), 3,
  'modo módulo e trilha: ao fechar a trilha há dois de módulo e um de trilha');
select is((select count(*)::int from certificacao.certificados where aluno_id = pg_temp.id('al3') and modulo_id is null), 1,
  'modo módulo e trilha: exatamente um certificado é da trilha');

select * from finish();
rollback;
