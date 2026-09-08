-- MS4 — RLS de diario. Reaproveita diario.pode_gerenciar_turma() (só
-- professor da turma ou coordenação) pra INSERT/UPDATE/DELETE nas
-- quatro tabelas; SELECT varia por tabela porque aluno só pode ver o
-- que é seu (nota/presença própria), não a turma inteira.

alter table diario.avaliacoes enable row level security;
alter table diario.notas enable row level security;
alter table diario.aulas enable row level security;
alter table diario.presencas enable row level security;

grant usage on schema diario to authenticated;
grant select, insert, update, delete on diario.avaliacoes to authenticated;
grant select, insert, update, delete on diario.notas to authenticated;
grant select, insert, update, delete on diario.aulas to authenticated;
grant select, insert, update, delete on diario.presencas to authenticated;

-- "status in (matriculada, concluida, reprovada)" exclui inscrita
-- (pendente) e cancelada/rejeitada: aluno só vê o diário de turma onde
-- de fato chegou a cursar, não de inscrição em análise.
drop policy if exists avaliacoes_select on diario.avaliacoes;
create policy avaliacoes_select
  on diario.avaliacoes
  for select
  to authenticated
  using (
    identidade.usuario_e_coordenacao()
    or exists (select 1 from selecao.turmas t where t.id = avaliacoes.turma_id and t.professor_id = auth.uid())
    or exists (
      select 1 from selecao.matriculas m
      where m.turma_id = avaliacoes.turma_id
        and m.aluno_id = auth.uid()
        and m.status in ('matriculada', 'concluida', 'reprovada')
    )
  );

drop policy if exists avaliacoes_insert on diario.avaliacoes;
create policy avaliacoes_insert
  on diario.avaliacoes
  for insert
  to authenticated
  with check (diario.pode_gerenciar_turma(turma_id));

drop policy if exists avaliacoes_update on diario.avaliacoes;
create policy avaliacoes_update
  on diario.avaliacoes
  for update
  to authenticated
  using (diario.pode_gerenciar_turma(turma_id))
  with check (diario.pode_gerenciar_turma(turma_id));

drop policy if exists avaliacoes_delete on diario.avaliacoes;
create policy avaliacoes_delete
  on diario.avaliacoes
  for delete
  to authenticated
  using (diario.pode_gerenciar_turma(turma_id));

drop policy if exists aulas_select on diario.aulas;
create policy aulas_select
  on diario.aulas
  for select
  to authenticated
  using (
    identidade.usuario_e_coordenacao()
    or exists (select 1 from selecao.turmas t where t.id = aulas.turma_id and t.professor_id = auth.uid())
    or exists (
      select 1 from selecao.matriculas m
      where m.turma_id = aulas.turma_id
        and m.aluno_id = auth.uid()
        and m.status in ('matriculada', 'concluida', 'reprovada')
    )
  );

drop policy if exists aulas_insert on diario.aulas;
create policy aulas_insert
  on diario.aulas
  for insert
  to authenticated
  with check (diario.pode_gerenciar_turma(turma_id));

drop policy if exists aulas_update on diario.aulas;
create policy aulas_update
  on diario.aulas
  for update
  to authenticated
  using (diario.pode_gerenciar_turma(turma_id))
  with check (diario.pode_gerenciar_turma(turma_id));

drop policy if exists aulas_delete on diario.aulas;
create policy aulas_delete
  on diario.aulas
  for delete
  to authenticated
  using (diario.pode_gerenciar_turma(turma_id));

-- notas/presencas não têm turma_id direto — o caminho até
-- pode_gerenciar_turma passa por avaliacao_id/aula_id.
drop policy if exists notas_select on diario.notas;
create policy notas_select
  on diario.notas
  for select
  to authenticated
  using (
    identidade.usuario_e_coordenacao()
    or exists (select 1 from selecao.matriculas m where m.id = notas.matricula_id and m.aluno_id = auth.uid())
    or exists (
      select 1 from diario.avaliacoes a
      join selecao.turmas t on t.id = a.turma_id
      where a.id = notas.avaliacao_id and t.professor_id = auth.uid()
    )
  );

drop policy if exists notas_insert on diario.notas;
create policy notas_insert
  on diario.notas
  for insert
  to authenticated
  with check (
    exists (select 1 from diario.avaliacoes a where a.id = avaliacao_id and diario.pode_gerenciar_turma(a.turma_id))
  );

drop policy if exists notas_update on diario.notas;
create policy notas_update
  on diario.notas
  for update
  to authenticated
  using (
    exists (select 1 from diario.avaliacoes a where a.id = avaliacao_id and diario.pode_gerenciar_turma(a.turma_id))
  )
  with check (
    exists (select 1 from diario.avaliacoes a where a.id = avaliacao_id and diario.pode_gerenciar_turma(a.turma_id))
  );

drop policy if exists notas_delete on diario.notas;
create policy notas_delete
  on diario.notas
  for delete
  to authenticated
  using (
    exists (select 1 from diario.avaliacoes a where a.id = avaliacao_id and diario.pode_gerenciar_turma(a.turma_id))
  );

drop policy if exists presencas_select on diario.presencas;
create policy presencas_select
  on diario.presencas
  for select
  to authenticated
  using (
    identidade.usuario_e_coordenacao()
    or exists (select 1 from selecao.matriculas m where m.id = presencas.matricula_id and m.aluno_id = auth.uid())
    or exists (
      select 1 from diario.aulas au
      join selecao.turmas t on t.id = au.turma_id
      where au.id = presencas.aula_id and t.professor_id = auth.uid()
    )
  );

drop policy if exists presencas_insert on diario.presencas;
create policy presencas_insert
  on diario.presencas
  for insert
  to authenticated
  with check (
    exists (select 1 from diario.aulas au where au.id = aula_id and diario.pode_gerenciar_turma(au.turma_id))
  );

drop policy if exists presencas_update on diario.presencas;
create policy presencas_update
  on diario.presencas
  for update
  to authenticated
  using (
    exists (select 1 from diario.aulas au where au.id = aula_id and diario.pode_gerenciar_turma(au.turma_id))
  )
  with check (
    exists (select 1 from diario.aulas au where au.id = aula_id and diario.pode_gerenciar_turma(au.turma_id))
  );

drop policy if exists presencas_delete on diario.presencas;
create policy presencas_delete
  on diario.presencas
  for delete
  to authenticated
  using (
    exists (select 1 from diario.aulas au where au.id = aula_id and diario.pode_gerenciar_turma(au.turma_id))
  );
