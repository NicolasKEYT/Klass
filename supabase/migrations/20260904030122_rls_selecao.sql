-- MS3 — RLS de selecao. Reaproveita identidade.usuario_e_coordenacao()
-- (MS1), mesmo padrão do MS2.

alter table selecao.turmas enable row level security;
alter table selecao.pre_requisitos_trilha enable row level security;
alter table selecao.matriculas enable row level security;

grant usage on schema selecao to authenticated;
grant select, insert, update, delete on selecao.turmas to authenticated;
grant select, insert, update, delete on selecao.pre_requisitos_trilha to authenticated;
-- Sem delete de propósito — matrícula é histórico, ninguém apaga pelo app.
grant select, insert, update on selecao.matriculas to authenticated;

-- turmas: segue a trilha-mãe, mesmo padrão de catalogo.modulos no MS2.
drop policy if exists turmas_select on selecao.turmas;
create policy turmas_select
  on selecao.turmas
  for select
  to authenticated
  using (
    identidade.usuario_e_coordenacao()
    or exists (select 1 from catalogo.trilhas t where t.id = turmas.trilha_id and t.publicada)
  );

drop policy if exists turmas_insert on selecao.turmas;
create policy turmas_insert
  on selecao.turmas
  for insert
  to authenticated
  with check (identidade.usuario_e_coordenacao());

drop policy if exists turmas_update on selecao.turmas;
create policy turmas_update
  on selecao.turmas
  for update
  to authenticated
  using (identidade.usuario_e_coordenacao())
  with check (identidade.usuario_e_coordenacao());

drop policy if exists turmas_delete on selecao.turmas;
create policy turmas_delete
  on selecao.turmas
  for delete
  to authenticated
  using (identidade.usuario_e_coordenacao());

-- pre_requisitos_trilha: leitura aberta a qualquer autenticado (não
-- depende de trilha publicada — coordenação monta isso antes de publicar).
drop policy if exists pre_requisitos_trilha_select on selecao.pre_requisitos_trilha;
create policy pre_requisitos_trilha_select
  on selecao.pre_requisitos_trilha
  for select
  to authenticated
  using (true);

drop policy if exists pre_requisitos_trilha_insert on selecao.pre_requisitos_trilha;
create policy pre_requisitos_trilha_insert
  on selecao.pre_requisitos_trilha
  for insert
  to authenticated
  with check (identidade.usuario_e_coordenacao());

drop policy if exists pre_requisitos_trilha_update on selecao.pre_requisitos_trilha;
create policy pre_requisitos_trilha_update
  on selecao.pre_requisitos_trilha
  for update
  to authenticated
  using (identidade.usuario_e_coordenacao())
  with check (identidade.usuario_e_coordenacao());

drop policy if exists pre_requisitos_trilha_delete on selecao.pre_requisitos_trilha;
create policy pre_requisitos_trilha_delete
  on selecao.pre_requisitos_trilha
  for delete
  to authenticated
  using (identidade.usuario_e_coordenacao());

-- matriculas: aluno vê a própria; professor vê as da turma dele;
-- coordenação vê tudo.
drop policy if exists matriculas_select on selecao.matriculas;
create policy matriculas_select
  on selecao.matriculas
  for select
  to authenticated
  using (
    aluno_id = auth.uid()
    or identidade.usuario_e_coordenacao()
    or exists (
      select 1 from selecao.turmas t
      where t.id = matriculas.turma_id and t.professor_id = auth.uid()
    )
  );

-- Só existe um caminho de escrita real (selecao.inscrever_aluno, que
-- força aluno_id = auth.uid()) — esta policy é o que faz esse INSERT
-- funcionar sob SECURITY INVOKER, e também cobre um INSERT direto.
drop policy if exists matriculas_insert on selecao.matriculas;
create policy matriculas_insert
  on selecao.matriculas
  for insert
  to authenticated
  with check (aluno_id = auth.uid());

drop policy if exists matriculas_update_aluno on selecao.matriculas;
create policy matriculas_update_aluno
  on selecao.matriculas
  for update
  to authenticated
  using (aluno_id = auth.uid() and status = 'inscrita')
  with check (aluno_id = auth.uid());

drop policy if exists matriculas_update_coordenacao on selecao.matriculas;
create policy matriculas_update_coordenacao
  on selecao.matriculas
  for update
  to authenticated
  using (identidade.usuario_e_coordenacao())
  with check (identidade.usuario_e_coordenacao());

-- RLS por si só limita QUAIS LINHAS um update alcança, não QUAIS
-- COLUNAS mudam dentro da linha — sem isso, um aluno cancelando a
-- própria inscrição (permitido pela policy acima) poderia, na mesma
-- escrita, tentar trocar turma_id ou se auto-deferir. Mesma lógica do
-- trigger de papel no MS1, aplicada aqui.
create or replace function selecao.restringir_alteracoes_matricula()
returns trigger
language plpgsql
as $$
begin
  if identidade.usuario_e_coordenacao() then
    return new;
  end if;

  if new.aluno_id is distinct from old.aluno_id
     or new.turma_id is distinct from old.turma_id
     or new.deferido_por is distinct from old.deferido_por
     or new.motivo_rejeicao is distinct from old.motivo_rejeicao
     or old.status is distinct from 'inscrita'
     or new.status is distinct from 'cancelada' then
    raise exception 'você só pode cancelar a própria inscrição pendente';
  end if;

  return new;
end;
$$;

drop trigger if exists matriculas_restringir_alteracoes on selecao.matriculas;
create trigger matriculas_restringir_alteracoes
  before update on selecao.matriculas
  for each row
  execute function selecao.restringir_alteracoes_matricula();
