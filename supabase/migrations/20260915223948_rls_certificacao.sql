-- MS5 — RLS de certificacao.certificados e verificação pública sem expor
-- a tabela.
--
-- Resumo do modelo de acesso:
--   SELECT  aluno vê os próprios certificados; coordenação vê todos.
--   INSERT  ninguém via PostgREST — só o motor certificacao.verificar_e_emitir
--           (SECURITY DEFINER), disparado pelo trigger de conclusão.
--   UPDATE  ninguém — certificado é imutável.
--   DELETE  ninguém — certificado é imutável.
-- A verificação PÚBLICA (sem login) não lê a tabela direto: sai por uma
-- função SECURITY DEFINER que devolve só dados mínimos por hash exato,
-- sem permitir enumerar a tabela inteira.

alter table certificacao.certificados enable row level security;

grant usage on schema certificacao to authenticated;
-- Sem grant de insert/update/delete: mesmo com policy, o PostgREST exige o
-- privilégio de tabela. Só select, e ainda filtrado pela policy abaixo.
grant select on certificacao.certificados to authenticated;

drop policy if exists certificados_select on certificacao.certificados;
create policy certificados_select
  on certificacao.certificados
  for select
  to authenticated
  using (
    identidade.usuario_e_coordenacao()
    or aluno_id = auth.uid()
  );

-- Verificação pública: role anon precisa consultar por hash sem login e
-- sem enxergar a tabela. A função roda como owner (definer), então lê a
-- linha ignorando a RLS, mas devolve apenas nome do aluno, nome da trilha
-- e data — nada de id, aluno_id ou metadata. Filtra por hash exato, então
-- não dá pra listar/enumerar certificados.
create or replace function certificacao.verificar_por_hash(p_hash text)
returns table (aluno_nome text, trilha_nome text, emitido_em timestamptz)
language sql
security definer
stable
set search_path = ''
as $$
  select c.aluno_nome, c.trilha_nome, c.emitido_em
  from certificacao.certificados c
  where c.hash_publico = p_hash;
$$;

-- anon (visitante sem login) e authenticated podem verificar por hash.
grant usage on schema certificacao to anon;
grant execute on function certificacao.verificar_por_hash(text) to anon, authenticated;
