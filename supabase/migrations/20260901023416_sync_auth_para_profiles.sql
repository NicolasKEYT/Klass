-- MS1 — cria o profile automaticamente quando um usuário se cadastra em
-- auth.users, para o cadastro no frontend não precisar de duas chamadas
-- (signUp + insert manual em profiles).
--
-- Decisão: o papel NUNCA vem do metadata do signup. `raw_user_meta_data`
-- é preenchido por `options.data` em `supabase.auth.signUp()`, uma
-- chamada pública feita com a publishable key — se o trigger confiasse
-- num `papel` vindo de lá, qualquer chamada direta à API de signup
-- (sem passar pela tela /cadastrar) poderia se autopromover a
-- coordenação na criação da conta, e nenhuma policy impede isso antes de
-- o profile existir. Todo profile novo nasce `aluno` (default da
-- coluna); promoção é sempre um UPDATE feito depois, por uma coordenação
-- já autenticada (ou, no seed abaixo, por uma migration rodando com
-- privilégio total).
create or replace function identidade.criar_profile_para_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into identidade.profiles (id, nome_completo)
  values (new.id, new.raw_user_meta_data ->> 'nome_completo');
  return new;
end;
$$;
comment on function identidade.criar_profile_para_novo_usuario() is
  'SECURITY DEFINER porque quem insere em auth.users (GoTrue) não tem privilégio no schema identidade — a função precisa escrever em nome do sistema. Qualquer mudança no formato do metadata enviado por /cadastrar precisa ser refletida aqui.';

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function identidade.criar_profile_para_novo_usuario();
