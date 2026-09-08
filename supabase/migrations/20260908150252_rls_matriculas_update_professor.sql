-- Gap descoberto testando diario.encerrar_matricula(): a função é
-- SECURITY INVOKER de propósito (respeita RLS de quem chama), mas as
-- policies de UPDATE em selecao.matriculas (MS3) só cobriam aluno
-- cancelando a própria inscrição e coordenação — nenhuma cobria
-- professor. O UPDATE dentro da função não dava erro nenhum, só
-- afetava zero linhas silenciosamente (RLS filtra, não lança exceção
-- num UPDATE que não bate com nenhuma linha visível). A trigger
-- restringir_alteracoes_matricula (MS4) já limita qual transição é
-- essa (matriculada -> concluida/reprovada, via
-- diario.pode_gerenciar_turma); esta policy só abre a linha pra ele
-- alcançar o UPDATE.
drop policy if exists matriculas_update_professor on selecao.matriculas;
create policy matriculas_update_professor
  on selecao.matriculas
  for update
  to authenticated
  using (exists (select 1 from selecao.turmas t where t.id = turma_id and t.professor_id = auth.uid()))
  with check (exists (select 1 from selecao.turmas t where t.id = turma_id and t.professor_id = auth.uid()));
