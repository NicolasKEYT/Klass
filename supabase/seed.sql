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

  -- Concluída: turma de um semestre passado (fevereiro a junho), pra
  -- "concluida" fazer sentido cronologicamente antes da turma atual de
  -- Programação (agosto). O MS4 pendura o histórico de notas/aulas nesta
  -- mesma matrícula.
  insert into selecao.matriculas (
    id, aluno_id, turma_id, status, deferido_em, deferido_por, criado_em, atualizado_em
  )
  values (
    'f1000000-0000-4000-8000-000000000001', v_aluno_id, v_turma_estatistica_id, 'concluida',
    '2026-06-20 12:00:00+00', v_coordenacao_id, '2026-01-15 12:00:00+00', '2026-06-20 12:00:00+00'
  )
  on conflict (id) do nothing;

  -- Matriculada: turma em andamento agora — é nela que o MS4 lança
  -- avaliações/aulas ainda sem nota/chamada, pro professor preencher
  -- durante a validação end-to-end.
  insert into selecao.matriculas (
    id, aluno_id, turma_id, status, deferido_em, deferido_por
  )
  values (
    'f1000000-0000-4000-8000-000000000002', v_aluno_id, v_turma_programacao_id, 'matriculada',
    '2026-08-05 12:00:00+00', v_coordenacao_id
  )
  on conflict (id) do nothing;

  -- Em análise: dá à coordenação algo para aprovar/rejeitar no teste.
  insert into selecao.matriculas (id, aluno_id, turma_id, status)
  values ('f1000000-0000-4000-8000-000000000003', v_aluno_id, v_turma_calculo_id, 'inscrita')
  on conflict (id) do nothing;
end
$$;
