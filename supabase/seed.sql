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
