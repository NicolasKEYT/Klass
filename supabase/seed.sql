-- Usuários de DEMONSTRAÇÃO — para desenvolvimento local e para a
-- avaliação SUS do TCC. Os endereços @klass.dev são deliberadamente
-- reservados (o domínio pode nem existir). Nenhum destes usuários passa
-- pelo fluxo público de cadastro: são inseridos direto no banco, já com
-- e-mail confirmado, para estarem prontos para login desde o primeiro
-- `db reset`/seed.
--
-- IDs fixos (não gen_random_uuid()) de propósito, para o script poder
-- rodar mais de uma vez sem duplicar usuário — ver "on conflict" abaixo.
--
-- O papel de cada um é setado por UPDATE em identidade.profiles DEPOIS
-- do insert, não via raw_user_meta_data no signup: o trigger
-- on_auth_user_created (ver migration sync_auth_para_profiles) nunca
-- confia em papel vindo de fora, então todo profile novo nasce aluno. Um
-- seed rodando direto contra o banco tem privilégio total e não passa
-- por RLS, então promover depois é só um UPDATE comum.

create extension if not exists pgcrypto with schema extensions;

do $$
declare
  v_aluno_id uuid := 'a1000000-0000-4000-8000-000000000001';
  v_professor_id uuid := 'a1000000-0000-4000-8000-000000000002';
  v_coordenacao_id uuid := 'a1000000-0000-4000-8000-000000000003';
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token,
    email_change_token_new, email_change
  ) values
    (
      '00000000-0000-0000-0000-000000000000', v_aluno_id, 'authenticated', 'authenticated',
      'aluno.teste@klass.dev', extensions.crypt('klass-aluno-2026', extensions.gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}',
      jsonb_build_object('nome_completo', 'Aluno de Teste'),
      now(), now(), '', '', '', ''
    ),
    (
      '00000000-0000-0000-0000-000000000000', v_professor_id, 'authenticated', 'authenticated',
      'professor.teste@klass.dev', extensions.crypt('klass-prof-2026', extensions.gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}',
      jsonb_build_object('nome_completo', 'Professor de Teste'),
      now(), now(), '', '', '', ''
    ),
    (
      '00000000-0000-0000-0000-000000000000', v_coordenacao_id, 'authenticated', 'authenticated',
      'coordenacao.teste@klass.dev', extensions.crypt('klass-coord-2026', extensions.gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}',
      jsonb_build_object('nome_completo', 'Coordenação de Teste'),
      now(), now(), '', '', '', ''
    )
  on conflict (id) do nothing;

  -- Sem uma linha correspondente em auth.identities, o GoTrue recusa o
  -- login por senha de usuários inseridos direto via SQL (ele resolve o
  -- usuário pela identity, não só pela linha de auth.users).
  insert into auth.identities (
    id, provider_id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values
    (
      'b1000000-0000-4000-8000-000000000001', v_aluno_id::text, v_aluno_id,
      jsonb_build_object('sub', v_aluno_id::text, 'email', 'aluno.teste@klass.dev'),
      'email', now(), now(), now()
    ),
    (
      'b1000000-0000-4000-8000-000000000002', v_professor_id::text, v_professor_id,
      jsonb_build_object('sub', v_professor_id::text, 'email', 'professor.teste@klass.dev'),
      'email', now(), now(), now()
    ),
    (
      'b1000000-0000-4000-8000-000000000003', v_coordenacao_id::text, v_coordenacao_id,
      jsonb_build_object('sub', v_coordenacao_id::text, 'email', 'coordenacao.teste@klass.dev'),
      'email', now(), now(), now()
    )
  on conflict (id) do nothing;

  update identidade.profiles set papel = 'professor' where id = v_professor_id;
  update identidade.profiles set papel = 'coordenacao' where id = v_coordenacao_id;
end
$$;

-- MS2 — trilha e módulos de demonstração, extraídos do design (nome da
-- trilha e das 4 disciplinas aparecem em 01/02/03/04-*.svg; carga
-- horária total, 280h, vem de 03-aluno-painel.svg). "Introdução a Bancos
-- de Dados" também aparece como nome de trilha no design, mas nenhum SVG
-- mostra seus módulos — fica de fora até existir conteúdo real pra ela.
--
-- Carga horária POR módulo e nível de cada um não aparecem em nenhum
-- SVG (só o total da trilha existe) — a distribuição abaixo (60/80/60/80,
-- somando os 280h reais) e o nível de cada módulo são suposição minha,
-- documentada aqui, não extração do design.
--
-- IDs fixos, mesmo motivo do bloco de usuários acima: o script precisa
-- poder rodar mais de uma vez sem duplicar trilha/módulo.
do $$
declare
  v_trilha_id uuid := 'c1000000-0000-4000-8000-000000000001';
  v_modulo_1_id uuid := 'c1000000-0000-4000-8000-000000000011'; -- Fundamentos de Estatística
  v_modulo_2_id uuid := 'c1000000-0000-4000-8000-000000000012'; -- Programação para Dados
  v_modulo_3_id uuid := 'c1000000-0000-4000-8000-000000000013'; -- Cálculo Aplicado
  v_modulo_4_id uuid := 'c1000000-0000-4000-8000-000000000014'; -- Aprendizado de Máquina
begin
  insert into catalogo.trilhas (id, slug, nome, descricao, descricao_curta, publicada)
  values (
    v_trilha_id,
    'ciencia-de-dados-aplicada',
    'Ciência de Dados Aplicada',
    'Trilha voltada a formar profissionais capazes de coletar, tratar e extrair valor de ' ||
    'dados: parte da base estatística, passa por programação aplicada a dados e cálculo, ' ||
    'e termina em aprendizado de máquina.',
    'Da estatística ao aprendizado de máquina, com programação e cálculo no meio do caminho.',
    true
  )
  on conflict (id) do nothing;

  insert into catalogo.modulos (id, trilha_id, ordem, nome, descricao, nivel, carga_horaria_horas)
  values
    (
      v_modulo_1_id, v_trilha_id, 1, 'Fundamentos de Estatística',
      'Estatística descritiva, probabilidade e inferência — a base para interpretar dados ' ||
      'com rigor antes de qualquer modelagem.',
      'iniciante', 60
    ),
    (
      v_modulo_2_id, v_trilha_id, 2, 'Programação para Dados',
      'Manipulação, limpeza e transformação de dados em código — a ferramenta de trabalho ' ||
      'do dia a dia de quem lida com dados.',
      'iniciante', 80
    ),
    (
      v_modulo_3_id, v_trilha_id, 3, 'Cálculo Aplicado',
      'Cálculo diferencial e otimização com foco no que sustenta os algoritmos de ' ||
      'aprendizado de máquina do próximo módulo.',
      'intermediario', 60
    ),
    (
      v_modulo_4_id, v_trilha_id, 4, 'Aprendizado de Máquina',
      'Algoritmos supervisionados e não supervisionados, aplicados sobre o que foi ' ||
      'construído nos três módulos anteriores.',
      'avancado', 80
    )
  on conflict (id) do nothing;

  insert into catalogo.pre_requisitos_modulo (modulo_id, pre_requisito_id)
  values
    (v_modulo_2_id, v_modulo_1_id),
    (v_modulo_4_id, v_modulo_2_id),
    (v_modulo_4_id, v_modulo_3_id)
  on conflict (modulo_id, pre_requisito_id) do nothing;
end
$$;

-- Segunda trilha — conteúdo de catálogo adicional (sem turma própria
-- ainda). Existia originalmente para demonstrar pré-requisito ENTRE
-- trilhas inteiras; esse conceito saiu do MS3 (turma passou a ser oferta
-- de um módulo, não de uma trilha — ver comentário da migration
-- selecao_turma_por_modulo), então o vínculo de pré-requisito com a
-- trilha de Nível 1 foi removido. Os módulos continuam de pé como
-- catálogo válido, dando conteúdo pra testar inscrição em módulos de
-- trilhas diferentes ao mesmo tempo.
do $$
declare
  v_trilha_id uuid := 'd1000000-0000-4000-8000-000000000001';
  v_modulo_1_id uuid := 'd1000000-0000-4000-8000-000000000011'; -- Aprendizado de Máquina Avançado
  v_modulo_2_id uuid := 'd1000000-0000-4000-8000-000000000012'; -- Engenharia de Dados e Pipelines
  v_modulo_3_id uuid := 'd1000000-0000-4000-8000-000000000013'; -- Visualização e Comunicação de Dados
  v_modulo_4_id uuid := 'd1000000-0000-4000-8000-000000000014'; -- Tópicos Especiais em Inteligência Artificial
begin
  insert into catalogo.trilhas (id, slug, nome, descricao, descricao_curta, publicada)
  values (
    v_trilha_id,
    'ciencia-de-dados-aplicada-nivel-2',
    'Ciência de Dados Aplicada — Nível 2',
    'Continuação da trilha de Ciência de Dados Aplicada para quem já cursou o nível 1: ' ||
    'aprofunda aprendizado de máquina, cobre engenharia de dados em produção e como ' ||
    'comunicar resultados, fechando com tópicos avançados de inteligência artificial.',
    'A continuação avançada de Ciência de Dados Aplicada — exige o nível 1 concluído.',
    true
  )
  on conflict (id) do nothing;

  insert into catalogo.modulos (id, trilha_id, ordem, nome, descricao, nivel, carga_horaria_horas)
  values
    (
      v_modulo_1_id, v_trilha_id, 1, 'Aprendizado de Máquina Avançado',
      'Ensemble methods, tuning de hiperparâmetros e redes neurais — aprofunda o que o ' ||
      'nível 1 encerrou.',
      'avancado', 90
    ),
    (
      v_modulo_2_id, v_trilha_id, 2, 'Engenharia de Dados e Pipelines',
      'Como levar um modelo do notebook para produção: pipelines de dados, versionamento ' ||
      'e automação.',
      'intermediario', 70
    ),
    (
      v_modulo_3_id, v_trilha_id, 3, 'Visualização e Comunicação de Dados',
      'Traduzir resultado técnico em decisão de negócio — storytelling com dados para ' ||
      'quem não é da área.',
      'intermediario', 60
    ),
    (
      v_modulo_4_id, v_trilha_id, 4, 'Tópicos Especiais em Inteligência Artificial',
      'Panorama de fronteira: LLMs, ética em IA e as próximas direções do campo.',
      'avancado', 100
    )
  on conflict (id) do nothing;
end
$$;

-- MS3 — turmas e matrículas de demonstração, uma por MÓDULO da trilha
-- Ciência de Dados Aplicada (turma passou a ser oferta de um módulo, não
-- de uma trilha inteira — ver comentário da migration
-- selecao_turma_por_modulo). Os códigos (EST/PROG/CALC/ML-2026-1) não
-- vêm de nenhum SVG — nenhum design mostra turma por disciplina desta
-- trilha especificamente — mas seguem o mesmo padrão SIGLA-ANO-SEQUÊNCIA
-- de 02-gestor-turmas.svg, aplicado a cada disciplina.
--
-- Cenário de aluno.teste, pensado para exercitar os três estados de uma
-- vez: concluiu Fundamentos de Estatística (libera a inscrição em
-- Programação para Dados, que exige Estatística via
-- catalogo.pre_requisitos_modulo); está cursando Programação para Dados
-- agora (matriculada — turma "ativa" que o MS4 usa pra lançar nota e
-- chamada durante o teste); tem uma inscrição em Cálculo Aplicado ainda
-- em análise (dá à coordenação algo pra aprovar). Aprendizado de Máquina
-- fica sem matrícula nenhuma — exige Programação E Cálculo concluídos,
-- nenhum dos dois ainda está `concluida`, então serve pra testar o
-- bloqueio de pré-requisito.
do $$
declare
  v_turma_estatistica_id uuid := 'e1000000-0000-4000-8000-000000000001'; -- EST-2026-1
  v_turma_programacao_id uuid := 'e1000000-0000-4000-8000-000000000002'; -- PROG-2026-1
  v_turma_calculo_id uuid := 'e1000000-0000-4000-8000-000000000003'; -- CALC-2026-1
  v_turma_ml_id uuid := 'e1000000-0000-4000-8000-000000000004'; -- ML-2026-1
  v_modulo_estatistica_id uuid := 'c1000000-0000-4000-8000-000000000011';
  v_modulo_programacao_id uuid := 'c1000000-0000-4000-8000-000000000012';
  v_modulo_calculo_id uuid := 'c1000000-0000-4000-8000-000000000013';
  v_modulo_ml_id uuid := 'c1000000-0000-4000-8000-000000000014';
  v_professor_id uuid := 'a1000000-0000-4000-8000-000000000002';
  v_coordenacao_id uuid := 'a1000000-0000-4000-8000-000000000003';
  v_aluno_id uuid := 'a1000000-0000-4000-8000-000000000001';
begin
  insert into selecao.turmas (id, modulo_id, codigo, professor_id, periodo_inicio, periodo_fim, vagas_total)
  values
    (v_turma_estatistica_id, v_modulo_estatistica_id, 'EST-2026-1', v_professor_id, '2026-02-01', '2026-06-20', 40),
    (v_turma_programacao_id, v_modulo_programacao_id, 'PROG-2026-1', v_professor_id, '2026-08-01', '2026-12-20', 40),
    (v_turma_calculo_id, v_modulo_calculo_id, 'CALC-2026-1', v_professor_id, '2026-08-01', '2026-12-20', 35),
    (v_turma_ml_id, v_modulo_ml_id, 'ML-2026-1', v_professor_id, '2026-08-01', '2026-12-20', 30)
  on conflict (id) do nothing;

  -- "on conflict (id) do nothing" não basta aqui: o trigger de negócio
  -- (before INSERT) roda ANTES do Postgres resolver o conflito, então
  -- re-rodar este seed contra um banco que já tem a linha dispara
  -- "matrícula ativa" mesmo a inserção sendo um no-op. Guarda por
  -- existência em vez de depender só do ON CONFLICT.

  -- Concluída: turma de um semestre passado (fevereiro a junho), pra
  -- "concluida" fazer sentido cronologicamente antes da turma atual de
  -- Programação (agosto). O MS4 pendura o histórico de notas/aulas nesta
  -- mesma matrícula.
  if not exists (select 1 from selecao.matriculas where id = 'f1000000-0000-4000-8000-000000000001') then
    insert into selecao.matriculas (
      id, aluno_id, turma_id, status, deferido_em, deferido_por, criado_em, atualizado_em
    )
    values (
      'f1000000-0000-4000-8000-000000000001', v_aluno_id, v_turma_estatistica_id, 'concluida',
      '2026-06-20 12:00:00+00', v_coordenacao_id, '2026-01-15 12:00:00+00', '2026-06-20 12:00:00+00'
    );
  end if;

  -- Matriculada: turma em andamento agora — é nela que o MS4 lança
  -- avaliações/aulas ainda sem nota/chamada, pro professor preencher
  -- durante a validação end-to-end.
  if not exists (select 1 from selecao.matriculas where id = 'f1000000-0000-4000-8000-000000000002') then
    insert into selecao.matriculas (
      id, aluno_id, turma_id, status, deferido_em, deferido_por
    )
    values (
      'f1000000-0000-4000-8000-000000000002', v_aluno_id, v_turma_programacao_id, 'matriculada',
      '2026-08-05 12:00:00+00', v_coordenacao_id
    );
  end if;

  -- Em análise: dá à coordenação algo para aprovar/rejeitar no teste.
  if not exists (select 1 from selecao.matriculas where id = 'f1000000-0000-4000-8000-000000000003') then
    insert into selecao.matriculas (id, aluno_id, turma_id, status)
    values ('f1000000-0000-4000-8000-000000000003', v_aluno_id, v_turma_calculo_id, 'inscrita');
  end if;
end
$$;

-- MS4 — diário de classe. Duas situações, como pede o prompt: histórico
-- completo (3 avaliações com nota, 10 aulas com 9 presenças), terminando
-- em diario.encerrar_matricula() de verdade, na matrícula que o MS3
-- seed deixou 'concluida' em Fundamentos de Estatística; e avaliações/
-- aulas SEM lançamento na matrícula ativa ('matriculada') em Programação
-- para Dados, pro professor preencher durante a validação end-to-end.
--
-- diario.avaliacoes/aulas/notas/presencas e diario.encerrar_matricula()
-- são as primeiras coisas do projeto cujo trigger/função de autorização
-- olham auth.uid() em vez de só validar a LINHA sendo escrita — então,
-- ao contrário do resto deste seed, essa parte não roda como o role de
-- serviço puro: precisa personificar professor/coordenação via
-- request.jwt.claims pra auth.uid() resolver certo.
set local role authenticated;

-- Reabre a matrícula pra poder lançar nota/presença nela (os triggers
-- do MS4 travam lançamento em matrícula que já não está 'matriculada')
-- — só coordenação passa livre por restringir_alteracoes_matricula pra
-- fazer essa transição "de trás pra frente" que não existe no fluxo normal.
set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000003","role":"authenticated"}';

do $$
begin
  update selecao.matriculas
  set status = 'matriculada'
  where id = 'f1000000-0000-4000-8000-000000000001' and status = 'concluida';
end
$$;

set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated"}';

do $$
declare
  v_turma_estatistica_id uuid := 'e1000000-0000-4000-8000-000000000001';
  v_turma_programacao_id uuid := 'e1000000-0000-4000-8000-000000000002';
  v_matricula_concluida_id uuid := 'f1000000-0000-4000-8000-000000000001';
  v_professor_id uuid := 'a1000000-0000-4000-8000-000000000002';
  v_avaliacao_prova1_id uuid := '10000000-0000-4000-8000-000000000001';
  v_avaliacao_trabalho_id uuid := '10000000-0000-4000-8000-000000000002';
  v_avaliacao_final_id uuid := '10000000-0000-4000-8000-000000000003';
  v_aula_id uuid;
  v_data date;
  i integer;
begin
  insert into diario.avaliacoes (id, turma_id, titulo, peso, ordem)
  values
    (v_avaliacao_prova1_id, v_turma_estatistica_id, 'Prova 1', 2, 1),
    (v_avaliacao_trabalho_id, v_turma_estatistica_id, 'Trabalho', 3, 2),
    (v_avaliacao_final_id, v_turma_estatistica_id, 'Prova Final', 5, 3)
  on conflict (id) do nothing;

  -- Média ponderada: (7*2 + 7*3 + 8*5) / 10 = 7.5 — acima do mínimo 6.0.
  insert into diario.notas (avaliacao_id, matricula_id, valor, lancada_por)
  values
    (v_avaliacao_prova1_id, v_matricula_concluida_id, 7.0, v_professor_id),
    (v_avaliacao_trabalho_id, v_matricula_concluida_id, 7.0, v_professor_id),
    (v_avaliacao_final_id, v_matricula_concluida_id, 8.0, v_professor_id)
  on conflict (avaliacao_id, matricula_id) do nothing;

  -- 10 aulas dentro do período real da turma (2026-02-01 a 2026-06-20).
  -- Presença em 9, ausência na última (i = 10) — 90% de frequência,
  -- acima do mínimo padrão de 75%.
  for i in 1..10 loop
    v_data := date '2026-02-10' + (i - 1) * interval '10 days';
    v_aula_id := ('20000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid;

    insert into diario.aulas (id, turma_id, data)
    values (v_aula_id, v_turma_estatistica_id, v_data)
    on conflict (id) do nothing;

    insert into diario.presencas (aula_id, matricula_id, presente, registrada_por)
    values (v_aula_id, v_matricula_concluida_id, i <> 10, v_professor_id)
    on conflict (aula_id, matricula_id) do nothing;
  end loop;

  -- Turma ativa (matriculada): avaliações e aulas criadas, mas SEM nota
  -- nem chamada ainda — é nelas que o professor lança durante o teste.
  insert into diario.avaliacoes (id, turma_id, titulo, peso, ordem)
  values
    ('10000000-0000-4000-8000-000000000011', v_turma_programacao_id, 'Prova 1', 4, 1),
    ('10000000-0000-4000-8000-000000000012', v_turma_programacao_id, 'Trabalho', 6, 2)
  on conflict (id) do nothing;

  for i in 1..4 loop
    v_data := date '2026-08-25' + (i - 1) * interval '7 days';
    v_aula_id := ('20000000-0000-4000-8000-' || lpad((10 + i)::text, 12, '0'))::uuid;

    insert into diario.aulas (id, turma_id, data)
    values (v_aula_id, v_turma_programacao_id, v_data)
    on conflict (id) do nothing;
  end loop;
end
$$;

-- Encerra de verdade, pelo mesmo caminho que o professor usaria na UI:
-- diario.encerrar_matricula() calcula média/frequência sozinho e decide
-- o status — não escrevemos 'concluida'/motivo_conclusao à mão.
do $$
begin
  if (select status from selecao.matriculas where id = 'f1000000-0000-4000-8000-000000000001') = 'matriculada' then
    perform diario.encerrar_matricula('f1000000-0000-4000-8000-000000000001');
  end if;
end
$$;

reset role;

-- MS5 — Certificação. Completa artificialmente os outros três módulos da
-- trilha "Ciência de Dados Aplicada" para aluno.teste, pelo mesmo caminho
-- real do MS4 (lançar notas/presenças + diario.encerrar_matricula). Ao
-- encerrar o QUARTO e último módulo, o trigger matriculas_emitir_certificado
-- dispara certificacao.verificar_e_emitir e o certificado é EMITIDO como
-- SIDE EFFECT — não há (nem deve haver) insert explícito em
-- certificacao.certificados neste seed.
--
-- Efeito colateral consciente: isso consome os estados que o MS3/MS4
-- deixavam para demonstrar lançamento (Programação, 'matriculada') e
-- aprovação (Cálculo, 'inscrita'). O fluxo segue demonstrável ao vivo —
-- 'concluida' não é matrícula ativa, então aluno.teste pode se reinscrever
-- num módulo já concluído para gerar uma nova inscrição pendente.
--
-- Mesma observação do bloco MS4: encerrar/lançar dependem de auth.uid(),
-- então esta parte personifica professor/coordenação via request.jwt.claims.

-- 1) Programação para Dados (módulo 2): matrícula f...0002 já está
--    'matriculada', com as avaliações (Prova 1 peso 4, Trabalho peso 6) e
--    4 aulas criadas pelo MS4, mas sem nota/chamada. Como professor,
--    preenche e encerra: média (8*4 + 8*6)/10 = 8.0, frequência 100%.
set local role authenticated;
set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated"}';

do $$
declare
  v_matricula_id uuid := 'f1000000-0000-4000-8000-000000000002';
  v_professor_id uuid := 'a1000000-0000-4000-8000-000000000002';
  v_aula_id uuid;
  i integer;
begin
  if (select status from selecao.matriculas where id = v_matricula_id) = 'matriculada' then
    insert into diario.notas (avaliacao_id, matricula_id, valor, lancada_por)
    values
      ('10000000-0000-4000-8000-000000000011', v_matricula_id, 8.0, v_professor_id),
      ('10000000-0000-4000-8000-000000000012', v_matricula_id, 8.0, v_professor_id)
    on conflict (avaliacao_id, matricula_id) do nothing;

    for i in 1..4 loop
      v_aula_id := ('20000000-0000-4000-8000-' || lpad((10 + i)::text, 12, '0'))::uuid;
      insert into diario.presencas (aula_id, matricula_id, presente, registrada_por)
      values (v_aula_id, v_matricula_id, true, v_professor_id)
      on conflict (aula_id, matricula_id) do nothing;
    end loop;

    perform diario.encerrar_matricula(v_matricula_id);
  end if;
end
$$;

-- 2) Cálculo Aplicado (módulo 3): matrícula f...0003 está 'inscrita'.
--    Como coordenação, aprova (inscrita -> matriculada) para o professor
--    poder lançar o diário.
set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000003","role":"authenticated"}';

do $$
begin
  update selecao.matriculas
  set status = 'matriculada', deferido_por = 'a1000000-0000-4000-8000-000000000003'
  where id = 'f1000000-0000-4000-8000-000000000003' and status = 'inscrita';
end
$$;

-- 3) Cálculo Aplicado: como professor, cria avaliações/aulas, lança e
--    encerra. Média (7*5 + 7*5)/10 = 7.0, frequência 100%.
set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated"}';

do $$
declare
  v_matricula_id uuid := 'f1000000-0000-4000-8000-000000000003';
  v_turma_id uuid := 'e1000000-0000-4000-8000-000000000003';
  v_professor_id uuid := 'a1000000-0000-4000-8000-000000000002';
  v_aula_id uuid;
  v_data date;
  i integer;
begin
  -- "not exists avaliação" além do status: num banco que já divergiu do
  -- seed (ex.: produção com dados de teste), a turma pode já ter avaliações
  -- em outra ordem — recriar aqui colidiria em unique(turma_id, ordem) e
  -- abortaria o seed inteiro. O guard torna o bloco um no-op nesse caso.
  if (select status from selecao.matriculas where id = v_matricula_id) = 'matriculada'
     and not exists (select 1 from diario.avaliacoes where turma_id = v_turma_id) then
    insert into diario.avaliacoes (id, turma_id, titulo, peso, ordem)
    values
      ('10000000-0000-4000-8000-000000000021', v_turma_id, 'Prova 1', 5, 1),
      ('10000000-0000-4000-8000-000000000022', v_turma_id, 'Prova Final', 5, 2)
    on conflict (id) do nothing;

    insert into diario.notas (avaliacao_id, matricula_id, valor, lancada_por)
    values
      ('10000000-0000-4000-8000-000000000021', v_matricula_id, 7.0, v_professor_id),
      ('10000000-0000-4000-8000-000000000022', v_matricula_id, 7.0, v_professor_id)
    on conflict (avaliacao_id, matricula_id) do nothing;

    for i in 1..4 loop
      v_data := date '2026-08-25' + (i - 1) * interval '7 days';
      v_aula_id := ('20000000-0000-4000-8000-' || lpad((20 + i)::text, 12, '0'))::uuid;
      insert into diario.aulas (id, turma_id, data)
      values (v_aula_id, v_turma_id, v_data)
      on conflict (id) do nothing;
      insert into diario.presencas (aula_id, matricula_id, presente, registrada_por)
      values (v_aula_id, v_matricula_id, true, v_professor_id)
      on conflict (aula_id, matricula_id) do nothing;
    end loop;

    perform diario.encerrar_matricula(v_matricula_id);
  end if;
end
$$;

-- 4) Aprendizado de Máquina (módulo 4): ainda sem matrícula. Agora que
--    Programação e Cálculo (pré-requisitos deste módulo) estão 'concluida',
--    o insert passa pela validação de pré-requisito do MS3. Insere direto
--    (role de seed, sem RLS) como fez o bloco MS3 com Programação — o
--    trigger BEFORE de regras de negócio ainda roda e valida.
reset role;

do $$
begin
  if not exists (select 1 from selecao.matriculas where id = 'f1000000-0000-4000-8000-000000000004') then
    insert into selecao.matriculas (id, aluno_id, turma_id, status, deferido_em, deferido_por)
    values (
      'f1000000-0000-4000-8000-000000000004',
      'a1000000-0000-4000-8000-000000000001',
      'e1000000-0000-4000-8000-000000000004',
      'matriculada', now(), 'a1000000-0000-4000-8000-000000000003'
    );
  end if;
end
$$;

-- 5) Aprendizado de Máquina: como professor, lança e encerra. Média
--    (9*5 + 9*5)/10 = 9.0, frequência 100%. Este é o quarto módulo — ao
--    virar 'concluida', o trigger emite o certificado da trilha.
set local role authenticated;
set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated"}';

do $$
declare
  v_matricula_id uuid := 'f1000000-0000-4000-8000-000000000004';
  v_turma_id uuid := 'e1000000-0000-4000-8000-000000000004';
  v_professor_id uuid := 'a1000000-0000-4000-8000-000000000002';
  v_aula_id uuid;
  v_data date;
  i integer;
begin
  -- Mesmo guard de "not exists avaliação" do bloco de Cálculo, pelo mesmo
  -- motivo (idempotência num banco divergido do seed).
  if (select status from selecao.matriculas where id = v_matricula_id) = 'matriculada'
     and not exists (select 1 from diario.avaliacoes where turma_id = v_turma_id) then
    insert into diario.avaliacoes (id, turma_id, titulo, peso, ordem)
    values
      ('10000000-0000-4000-8000-000000000031', v_turma_id, 'Projeto', 5, 1),
      ('10000000-0000-4000-8000-000000000032', v_turma_id, 'Prova Final', 5, 2)
    on conflict (id) do nothing;

    insert into diario.notas (avaliacao_id, matricula_id, valor, lancada_por)
    values
      ('10000000-0000-4000-8000-000000000031', v_matricula_id, 9.0, v_professor_id),
      ('10000000-0000-4000-8000-000000000032', v_matricula_id, 9.0, v_professor_id)
    on conflict (avaliacao_id, matricula_id) do nothing;

    for i in 1..4 loop
      v_data := date '2026-08-25' + (i - 1) * interval '7 days';
      v_aula_id := ('20000000-0000-4000-8000-' || lpad((30 + i)::text, 12, '0'))::uuid;
      insert into diario.aulas (id, turma_id, data)
      values (v_aula_id, v_turma_id, v_data)
      on conflict (id) do nothing;
      insert into diario.presencas (aula_id, matricula_id, presente, registrada_por)
      values (v_aula_id, v_matricula_id, true, v_professor_id)
      on conflict (aula_id, matricula_id) do nothing;
    end loop;

    perform diario.encerrar_matricula(v_matricula_id);
  end if;
end
$$;

reset role;

-- Confirmação (não emite nada — só avisa): o certificado da trilha
-- Ciência de Dados Aplicada deve existir para aluno.teste após o passo 5.
do $$
begin
  if exists (
    select 1 from certificacao.certificados
    where aluno_id = 'a1000000-0000-4000-8000-000000000001'
      and trilha_id = 'c1000000-0000-4000-8000-000000000001'
  ) then
    raise notice 'MS5: certificado de aluno.teste emitido com sucesso pelo trigger.';
  else
    raise warning 'MS5: certificado NÃO foi emitido — verifique se os 4 módulos ficaram concluida.';
  end if;
end
$$;
