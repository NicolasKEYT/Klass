-- Corrige identidade.impedir_troca_de_papel_por_usuario_comum: a versão
-- original checava só identidade.usuario_e_coordenacao(), que por sua vez
-- depende de auth.uid() — e auth.uid() também é null fora de um request
-- autenticado via PostgREST (migration, seed, sessão de superusuário).
-- Resultado: o trigger bloqueava QUALQUER troca de papel feita por SQL
-- direto, inclusive a promoção dos usuários de seed logo abaixo. A
-- checagem só faz sentido quando existe de fato um usuário comum logado
-- tentando se autopromover — daí o "auth.uid() is not null" a mais.
create or replace function identidade.impedir_troca_de_papel_por_usuario_comum()
returns trigger
language plpgsql
as $$
begin
  if new.papel is distinct from old.papel
     and auth.uid() is not null
     and not identidade.usuario_e_coordenacao() then
    raise exception 'apenas coordenação pode alterar o papel de um usuário';
  end if;
  return new;
end;
$$;
