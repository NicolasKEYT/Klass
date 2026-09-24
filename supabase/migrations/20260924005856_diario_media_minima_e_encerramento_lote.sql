-- MS4 — dois ajustes no encerramento:
--   * a média mínima de aprovação passa a vir da trilha (catalogo.trilhas
--     .media_minima), não mais do literal 6.0 embutido.
--   * encerramento e reativação em LOTE (turma inteira), reaproveitando a
--     mesma lógica por aluno em vez de duplicá-la.

-- Núcleo compartilhado do encerramento de UMA matrícula: calcula média/
-- frequência, compara com os mínimos (média da trilha, frequência da
-- turma) e grava status + motivo. Retorna o status resultante para o
-- chamador em lote contabilizar. NÃO checa se está "pronto para encerrar"
-- — quem chama decide (o encerramento individual exige; o lote pula).
-- SECURITY DEFINER (como as demais funções de cálculo do diário) para ler
-- media_minima mesmo de trilha despublicada; a guarda de autorização por
-- auth.uid() abaixo mantém a chamada segura mesmo exposta.
create or replace function diario.aplicar_encerramento(p_matricula_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_turma_id uuid;
  v_media numeric;
  v_freq numeric;
  v_freq_min smallint;
  v_media_min numeric;
  v_novo_status selecao.status_matricula;
  v_motivo text;
begin
  select turma_id into v_turma_id from selecao.matriculas where id = p_matricula_id;
  if v_turma_id is null then
    raise exception 'matrícula não encontrada';
  end if;

  -- auth.uid() vale mesmo em SECURITY DEFINER: bloqueia chamada direta de
  -- quem não gerencia a turma (o UPDATE ainda seria barrado pelo trigger
  -- de selecao, mas guardar aqui é defesa em profundidade).
  if not diario.pode_gerenciar_turma(v_turma_id) then
    raise exception 'apenas o professor da turma ou a coordenação podem encerrar esta matrícula';
  end if;

  v_media := diario.media_ponderada(p_matricula_id);
  v_freq := diario.frequencia_percentual(p_matricula_id);
  select frequencia_minima_percentual into v_freq_min from selecao.turmas where id = v_turma_id;

  -- Média mínima da trilha do módulo desta turma (turma -> modulo -> trilha).
  select tr.media_minima into v_media_min
  from selecao.turmas t
  join catalogo.modulos mo on mo.id = t.modulo_id
  join catalogo.trilhas tr on tr.id = mo.trilha_id
  where t.id = v_turma_id;

  if v_media >= v_media_min and v_freq >= v_freq_min then
    v_novo_status := 'concluida';
    v_motivo := 'Aprovado por média e frequência.';
  else
    v_novo_status := 'reprovada';
    if v_media < v_media_min and v_freq < v_freq_min then
      v_motivo := format(
        'Média %s abaixo do mínimo %s e frequência %s%% abaixo do mínimo %s%%.',
        v_media, v_media_min, v_freq, v_freq_min
      );
    elsif v_media < v_media_min then
      v_motivo := format('Média %s abaixo do mínimo %s.', v_media, v_media_min);
    else
      v_motivo := format('Frequência %s%% abaixo do mínimo %s%%.', v_freq, v_freq_min);
    end if;
  end if;

  update selecao.matriculas
  set status = v_novo_status,
      motivo_conclusao = v_motivo,
      encerrada_em = now(),
      encerrada_por = auth.uid()
  where id = p_matricula_id;

  return v_novo_status;
end;
$$;

grant execute on function diario.aplicar_encerramento(uuid) to authenticated;

-- Encerramento individual: mantém o contrato externo (checa autorização e
-- prontidão com mensagens específicas), delegando o cálculo/gravação à
-- função compartilhada.
create or replace function diario.encerrar_matricula(p_matricula_id uuid)
returns void
language plpgsql
security invoker
as $$
declare
  v_turma_id uuid;
begin
  select turma_id into v_turma_id from selecao.matriculas where id = p_matricula_id;
  if v_turma_id is null then
    raise exception 'matrícula não encontrada';
  end if;

  if not diario.pode_gerenciar_turma(v_turma_id) then
    raise exception 'apenas o professor da turma pode encerrar esta matrícula';
  end if;

  if not diario.pronto_para_encerrar(p_matricula_id) then
    raise exception 'ainda há avaliação sem nota ou aula sem chamada para esta matrícula';
  end if;

  perform diario.aplicar_encerramento(p_matricula_id);
end;
$$;

grant execute on function diario.encerrar_matricula(uuid) to authenticated;

-- Encerramento em LOTE da turma. Cada aluno é avaliado pelos próprios
-- critérios; quem não está pronto (falta nota/chamada) é PULADO, não trava
-- o restante. Retorna um resumo estruturado.
create or replace function diario.encerrar_turma(p_turma_id uuid)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_matricula_id uuid;
  v_status text;
  v_aprovadas integer := 0;
  v_reprovadas integer := 0;
  v_puladas integer := 0;
begin
  if not diario.pode_gerenciar_turma(p_turma_id) then
    raise exception 'apenas o professor da turma ou a coordenação podem encerrar esta turma';
  end if;

  for v_matricula_id in
    select id from selecao.matriculas
    where turma_id = p_turma_id and status = 'matriculada'
  loop
    if diario.pronto_para_encerrar(v_matricula_id) then
      v_status := diario.aplicar_encerramento(v_matricula_id);
      if v_status = 'concluida' then
        v_aprovadas := v_aprovadas + 1;
      else
        v_reprovadas := v_reprovadas + 1;
      end if;
    else
      v_puladas := v_puladas + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'aprovadas', v_aprovadas,
    'reprovadas', v_reprovadas,
    'puladas', v_puladas,
    'total', v_aprovadas + v_reprovadas + v_puladas,
    'motivo_puladas', 'Faltam notas ou chamadas para encerrar.'
  );
end;
$$;

grant execute on function diario.encerrar_turma(uuid) to authenticated;

-- Reativação em LOTE: coordenação devolve todas as matrículas encerradas
-- (concluída/reprovada) da turma para 'matriculada'. Mesma lógica do
-- desfazer_encerramento por aluno, aplicada de uma vez.
create or replace function diario.reativar_turma(p_turma_id uuid)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_reativadas integer;
begin
  if not identidade.usuario_e_coordenacao() then
    raise exception 'apenas a coordenação pode reativar a turma';
  end if;

  with atualizadas as (
    update selecao.matriculas
    set status = 'matriculada',
        motivo_conclusao = null,
        encerrada_em = null,
        encerrada_por = null
    where turma_id = p_turma_id and status in ('concluida', 'reprovada')
    returning 1
  )
  select count(*) into v_reativadas from atualizadas;

  return jsonb_build_object('reativadas', v_reativadas);
end;
$$;

grant execute on function diario.reativar_turma(uuid) to authenticated;
