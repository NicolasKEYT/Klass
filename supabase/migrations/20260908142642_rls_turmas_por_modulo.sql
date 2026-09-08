-- turmas_select seguia trilha_id direto; agora precisa mais um salto
-- (turma -> módulo -> trilha) para checar se a trilha está publicada.
-- As policies de pre_requisitos_trilha não precisam de DROP explícito
-- aqui — a tabela já saiu inteira (com suas policies) na migration
-- anterior.
drop policy if exists turmas_select on selecao.turmas;
create policy turmas_select
  on selecao.turmas
  for select
  to authenticated
  using (
    identidade.usuario_e_coordenacao()
    or exists (
      select 1
      from catalogo.modulos m
      join catalogo.trilhas t on t.id = m.trilha_id
      where m.id = turmas.modulo_id and t.publicada
    )
  );
