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

-- MS3 — segunda trilha, para demonstrar pré-requisito ENTRE trilhas
-- (diferente do pré-requisito entre módulos do MS2). Nenhum SVG mostra
-- uma trilha de nível 2 — o próprio prompt do MS3 pede este exemplo
-- nomeado explicitamente, então o conteúdo dos módulos abaixo é meu,
-- continuando o tema de Nível 1 (que termina em Aprendizado de
-- Máquina), não uma invenção sem direção.
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

  -- Nível 2 exige Nível 1 concluído — é isso que selecao.validar_pre_requisitos_trilha() consulta.
  insert into selecao.pre_requisitos_trilha (trilha_id, trilha_requisito_id)
  values (v_trilha_id, 'c1000000-0000-4000-8000-000000000001')
  on conflict (trilha_id, trilha_requisito_id) do nothing;
end
$$;

-- MS3 — turmas e matrículas de demonstração. Os códigos CDA-2026-1 e
-- CDA-2025-2 são reais, extraídos de 01-gestor-visao-geral.svg e
-- 02-gestor-turmas.svg (mesma trilha Ciência de Dados Aplicada). O
-- código da turma de Nível 2 (CDA2-2026-1) segue o mesmo padrão real,
-- mas não vem do design — Nível 2 não existe em nenhum SVG.
--
-- Datas escolhidas para o cenário de teste fazer sentido "agora"
-- (setembro de 2026): CDA-2025-2 já terminou (turma da matrícula
-- concluída), CDA-2026-1 está em andamento (turma da matrícula em
-- análise e disponível para nova inscrição), CDA2-2026-1 é a turma nova
-- de Nível 2 — não literalmente os semestres que os códigos sugerem.
do $$
declare
  v_turma_nivel1_atual_id uuid := 'e1000000-0000-4000-8000-000000000001'; -- CDA-2026-1
  v_turma_nivel1_passada_id uuid := 'e1000000-0000-4000-8000-000000000002'; -- CDA-2025-2
  v_turma_nivel2_id uuid := 'e1000000-0000-4000-8000-000000000003'; -- CDA2-2026-1
  v_trilha_nivel1_id uuid := 'c1000000-0000-4000-8000-000000000001';
  v_trilha_nivel2_id uuid := 'd1000000-0000-4000-8000-000000000001';
  v_professor_id uuid := 'a1000000-0000-4000-8000-000000000002';
  v_coordenacao_id uuid := 'a1000000-0000-4000-8000-000000000003';
  v_aluno_id uuid := 'a1000000-0000-4000-8000-000000000001';
begin
  insert into selecao.turmas (id, trilha_id, codigo, professor_id, periodo_inicio, periodo_fim, vagas_total)
  values
    (v_turma_nivel1_atual_id, v_trilha_nivel1_id, 'CDA-2026-1', v_professor_id, '2026-08-01', '2026-12-20', 40),
    (v_turma_nivel1_passada_id, v_trilha_nivel1_id, 'CDA-2025-2', v_professor_id, '2025-08-01', '2025-12-20', 35),
    (v_turma_nivel2_id, v_trilha_nivel2_id, 'CDA2-2026-1', v_professor_id, '2026-09-15', '2027-02-15', 30)
  on conflict (id) do nothing;

  -- Matrícula concluída simulada: aluno.teste já terminou Nível 1 (na
  -- turma passada) — é o que libera a inscrição em Nível 2 no primeiro
  -- teste, sem precisar mexer no banco manualmente.
  insert into selecao.matriculas (
    id, aluno_id, turma_id, status, deferido_em, deferido_por, criado_em, atualizado_em
  )
  values (
    'f1000000-0000-4000-8000-000000000001', v_aluno_id, v_turma_nivel1_passada_id, 'concluida',
    '2025-12-20 12:00:00+00', v_coordenacao_id, '2025-07-15 12:00:00+00', '2025-12-20 12:00:00+00'
  )
  on conflict (id) do nothing;

  -- Matrícula em análise: aluno.teste inscrito na turma atual de Nível 1
  -- — dá à coordenação algo para aprovar no primeiro teste.
  insert into selecao.matriculas (id, aluno_id, turma_id, status)
  values ('f1000000-0000-4000-8000-000000000002', v_aluno_id, v_turma_nivel1_atual_id, 'inscrita')
  on conflict (id) do nothing;
end
$$;
