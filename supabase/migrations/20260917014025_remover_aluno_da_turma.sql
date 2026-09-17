-- Coordenação desliga um aluno JÁ MATRICULADO de uma turma. Até aqui só
-- existia cancelamento pelo próprio aluno (inscrição pendente) e rejeição
-- pela coordenação (também antes da aprovação) — nada removia quem já
-- estava cursando.
--
-- Decisão de schema (documentada como o prompt pede): reaproveita os
-- campos de encerramento do MS4 — encerrada_em / encerrada_por para
-- auditoria e motivo_conclusao para o motivo — porque remover é uma forma
-- de ENCERRAR a matrícula. O status vai para 'cancelada' (não 'concluida'
-- nem 'reprovada', que são resultado acadêmico), reusando um valor que já
-- existe no enum. Nenhuma coluna nova.
create or replace function selecao.remover_aluno_da_turma(p_matricula_id uuid, p_motivo text)
returns void
language plpgsql
security invoker
as $$
declare
  v_status selecao.status_matricula;
begin
  -- Autorização no servidor (o prompt exige "só coordenação"); a RLS de
  -- UPDATE de matriculas também já restringe, isto é a garantia explícita.
  if not identidade.usuario_e_coordenacao() then
    raise exception 'apenas a coordenação pode remover um aluno da turma';
  end if;

  if p_motivo is null or char_length(btrim(p_motivo)) < 10 then
    raise exception 'informe o motivo da remoção (mínimo 10 caracteres)';
  end if;

  select status into v_status from selecao.matriculas where id = p_matricula_id;
  if v_status is null then
    raise exception 'matrícula não encontrada';
  end if;
  if v_status <> 'matriculada' then
    raise exception 'só é possível remover um aluno com matrícula ativa (matriculada)';
  end if;

  update selecao.matriculas
  set status = 'cancelada',
      motivo_conclusao = p_motivo,
      encerrada_em = now(),
      encerrada_por = auth.uid()
  where id = p_matricula_id;
end;
$$;

grant execute on function selecao.remover_aluno_da_turma(uuid, text) to authenticated;
