-- MS3 expôs um gap em identidade: profiles_select só deixa cada um ler o
-- próprio perfil (ou coordenação ler todos). Isso quebra qualquer tela que
-- precise mostrar o nome de OUTRA pessoa numa relação legítima — aluno
-- vendo o nome do professor da turma, professor vendo o nome dos alunos
-- matriculados na própria turma. Ampliar a policy de SELECT abriria papel,
-- e-mail (se existisse) e qualquer outra coluna futura de profiles para
-- todo mundo; em vez disso, expõe uma função somente-leitura, só com id e
-- nome_completo, como um "diretório" mínimo — mesmo padrão de função
-- SECURITY DEFINER já usado em selecao para leituras entre papéis.
create or replace function identidade.nomes_completos(p_ids uuid[])
returns table (id uuid, nome_completo text)
language sql
security definer
stable
set search_path = ''
as $$
  select id, nome_completo
  from identidade.profiles
  where id = any(p_ids);
$$;

grant execute on function identidade.nomes_completos(uuid[]) to authenticated;
