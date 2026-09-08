-- MS4 — validações de professor/matrícula e as quatro funções de
-- cálculo/decisão do diário. SECURITY DEFINER onde a checagem precisa
-- enxergar linha de outro usuário (turma de outro professor, matrícula
-- de outro aluno) sem depender da RLS de quem chamou.

create or replace function diario.pode_gerenciar_turma(p_turma_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select
    identidade.usuario_e_coordenacao()
    or exists (select 1 from selecao.turmas where id = p_turma_id and professor_id = auth.uid());
$$;

grant execute on function diario.pode_gerenciar_turma(uuid) to authenticated;

create or replace function diario.validar_professor_da_turma_diario()
returns trigger
language plpgsql
as $$
begin
  if not diario.pode_gerenciar_turma(new.turma_id) then
    raise exception 'apenas o professor da turma ou a coordenação podem gerenciar o diário desta turma';
  end if;
  return new;
end;
$$;

drop trigger if exists avaliacoes_valida_professor on diario.avaliacoes;
create trigger avaliacoes_valida_professor
  before insert or update on diario.avaliacoes
  for each row
  execute function diario.validar_professor_da_turma_diario();

drop trigger if exists aulas_valida_professor on diario.aulas;
create trigger aulas_valida_professor
  before insert or update on diario.aulas
  for each row
  execute function diario.validar_professor_da_turma_diario();

-- Autorização de QUEM pode lançar nota/presença fica pra RLS (mesmo
-- padrão do resto do projeto); o trigger aqui garante só os invariantes
-- de dado — evita lançar nota do aluno X na turma Y por confusão de FK,
-- e trava lançamento pra matrícula que não está ativa.
create or replace function diario.validar_lancamento_nota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_turma_avaliacao uuid;
  v_turma_matricula uuid;
  v_status selecao.status_matricula;
begin
  select turma_id into v_turma_avaliacao from diario.avaliacoes where id = new.avaliacao_id;
  select turma_id, status into v_turma_matricula, v_status from selecao.matriculas where id = new.matricula_id;

  if v_turma_avaliacao is distinct from v_turma_matricula then
    raise exception 'a matrícula não pertence à turma desta avaliação';
  end if;

  if v_status <> 'matriculada' then
    raise exception 'só é possível lançar nota para matrícula ativa (matriculada)';
  end if;

  return new;
end;
$$;

drop trigger if exists notas_valida_lancamento on diario.notas;
create trigger notas_valida_lancamento
  before insert or update on diario.notas
  for each row
  execute function diario.validar_lancamento_nota();

create or replace function diario.bloquear_nota_pos_encerramento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status selecao.status_matricula;
begin
  select status into v_status
  from selecao.matriculas
  where id = coalesce(new.matricula_id, old.matricula_id);

  if v_status in ('concluida', 'reprovada') then
    raise exception 'Matrícula já encerrada. Não é possível alterar notas.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists notas_bloqueia_pos_encerramento on diario.notas;
create trigger notas_bloqueia_pos_encerramento
  before insert or update or delete on diario.notas
  for each row
  execute function diario.bloquear_nota_pos_encerramento();

create or replace function diario.validar_registro_presenca()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_turma_aula uuid;
  v_turma_matricula uuid;
  v_status selecao.status_matricula;
begin
  select turma_id into v_turma_aula from diario.aulas where id = new.aula_id;
  select turma_id, status into v_turma_matricula, v_status from selecao.matriculas where id = new.matricula_id;

  if v_turma_aula is distinct from v_turma_matricula then
    raise exception 'a matrícula não pertence à turma desta aula';
  end if;

  if v_status <> 'matriculada' then
    raise exception 'só é possível registrar presença para matrícula ativa (matriculada)';
  end if;

  return new;
end;
$$;

drop trigger if exists presencas_valida_registro on diario.presencas;
create trigger presencas_valida_registro
  before insert or update on diario.presencas
  for each row
  execute function diario.validar_registro_presenca();

create or replace function diario.bloquear_presenca_pos_encerramento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status selecao.status_matricula;
begin
  select status into v_status
  from selecao.matriculas
  where id = coalesce(new.matricula_id, old.matricula_id);

  if v_status in ('concluida', 'reprovada') then
    raise exception 'Matrícula já encerrada. Não é possível alterar presenças.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists presencas_bloqueia_pos_encerramento on diario.presencas;
create trigger presencas_bloqueia_pos_encerramento
  before insert or update or delete on diario.presencas
  for each row
  execute function diario.bloquear_presenca_pos_encerramento();

-- Avaliação sem nota lançada NÃO entra no cálculo (fica incompleta, não
-- zerada) — só normaliza pela soma dos pesos das avaliações que têm nota.
create or replace function diario.media_ponderada(p_matricula_id uuid)
returns numeric
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_turma_id uuid;
  v_soma_ponderada numeric;
  v_soma_pesos numeric;
begin
  select turma_id into v_turma_id from selecao.matriculas where id = p_matricula_id;

  select sum(n.valor * a.peso), sum(a.peso)
  into v_soma_ponderada, v_soma_pesos
  from diario.avaliacoes a
  join diario.notas n on n.avaliacao_id = a.id and n.matricula_id = p_matricula_id
  where a.turma_id = v_turma_id;

  if v_soma_pesos is null or v_soma_pesos = 0 then
    return null;
  end if;

  return round(v_soma_ponderada / v_soma_pesos, 2);
end;
$$;

grant execute on function diario.media_ponderada(uuid) to authenticated;

-- Aula sem NENHUMA presença registrada (nem presente, nem ausente) quer
-- dizer que a chamada não foi feita ainda — não conta no denominador.
create or replace function diario.frequencia_percentual(p_matricula_id uuid)
returns numeric
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_turma_id uuid;
  v_total_com_chamada integer;
  v_presencas integer;
begin
  select turma_id into v_turma_id from selecao.matriculas where id = p_matricula_id;

  select count(*)
  into v_total_com_chamada
  from diario.aulas au
  where au.turma_id = v_turma_id
    and exists (select 1 from diario.presencas p where p.aula_id = au.id);

  if v_total_com_chamada = 0 then
    return null;
  end if;

  select count(*)
  into v_presencas
  from diario.presencas p
  join diario.aulas au on au.id = p.aula_id
  where au.turma_id = v_turma_id
    and p.matricula_id = p_matricula_id
    and p.presente = true;

  return round(v_presencas * 100.0 / v_total_com_chamada, 2);
end;
$$;

grant execute on function diario.frequencia_percentual(uuid) to authenticated;

-- Decisão própria: além do que o prompt pede, exige que a turma tenha
-- pelo menos uma avaliação e uma aula cadastrada. Sem essa guarda, uma
-- turma vazia (0 avaliações, 0 aulas) passaria "pronto pra encerrar" por
-- vacuidade lógica (nenhuma avaliação sem nota é verdade quando não há
-- avaliação nenhuma) — reprovar/aprovar sem nenhum dado não faz sentido.
create or replace function diario.pronto_para_encerrar(p_matricula_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_turma_id uuid;
  v_avaliacoes_sem_nota integer;
  v_aulas_sem_presenca integer;
begin
  select turma_id into v_turma_id from selecao.matriculas where id = p_matricula_id;

  if not exists (select 1 from diario.avaliacoes where turma_id = v_turma_id) then
    return false;
  end if;
  if not exists (select 1 from diario.aulas where turma_id = v_turma_id) then
    return false;
  end if;

  select count(*) into v_avaliacoes_sem_nota
  from diario.avaliacoes a
  where a.turma_id = v_turma_id
    and not exists (
      select 1 from diario.notas n where n.avaliacao_id = a.id and n.matricula_id = p_matricula_id
    );

  select count(*) into v_aulas_sem_presenca
  from diario.aulas au
  where au.turma_id = v_turma_id
    and not exists (
      select 1 from diario.presencas p where p.aula_id = au.id and p.matricula_id = p_matricula_id
    );

  return v_avaliacoes_sem_nota = 0 and v_aulas_sem_presenca = 0;
end;
$$;

grant execute on function diario.pronto_para_encerrar(uuid) to authenticated;

-- O coração do MS4 — SECURITY INVOKER de propósito: precisa respeitar a
-- RLS/checagem de quem está chamando (só o professor da turma).
create or replace function diario.encerrar_matricula(p_matricula_id uuid)
returns void
language plpgsql
security invoker
as $$
declare
  v_turma_id uuid;
  v_media numeric;
  v_freq numeric;
  v_freq_min smallint;
  v_novo_status selecao.status_matricula;
  v_motivo text;
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

  v_media := diario.media_ponderada(p_matricula_id);
  v_freq := diario.frequencia_percentual(p_matricula_id);
  select frequencia_minima_percentual into v_freq_min from selecao.turmas where id = v_turma_id;

  if v_media >= 6.0 and v_freq >= v_freq_min then
    v_novo_status := 'concluida';
    v_motivo := 'Aprovado por média e frequência.';
  else
    v_novo_status := 'reprovada';
    if v_media < 6.0 and v_freq < v_freq_min then
      v_motivo := format(
        'Média %s abaixo do mínimo 6.0 e frequência %s%% abaixo do mínimo %s%%.',
        v_media, v_freq, v_freq_min
      );
    elsif v_media < 6.0 then
      v_motivo := format('Média %s abaixo do mínimo 6.0.', v_media);
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
end;
$$;

grant execute on function diario.encerrar_matricula(uuid) to authenticated;

-- Só desfaz — reencerrar é ato pedagógico do professor, coordenação não
-- assume esse papel, só corrige erro voltando pra 'matriculada'.
create or replace function diario.desfazer_encerramento(p_matricula_id uuid)
returns void
language plpgsql
security invoker
as $$
begin
  if not identidade.usuario_e_coordenacao() then
    raise exception 'apenas a coordenação pode desfazer um encerramento';
  end if;

  update selecao.matriculas
  set status = 'matriculada',
      motivo_conclusao = null,
      encerrada_em = null,
      encerrada_por = null
  where id = p_matricula_id
    and status in ('concluida', 'reprovada');

  if not found then
    raise exception 'matrícula não encontrada ou não está encerrada';
  end if;
end;
$$;

grant execute on function diario.desfazer_encerramento(uuid) to authenticated;

-- Correção obrigatória de MS3: restringir_alteracoes_matricula só
-- reconhecia UMA transição pra quem não é coordenação (aluno cancelando
-- a própria inscrição pendente) — qualquer outra mudança de status caía
-- na exceção genérica. diario.encerrar_matricula() é chamada pelo
-- PROFESSOR (não a coordenação), então sem este ajuste o próprio MS4
-- ficaria bloqueado por uma regra do MS3 que nunca previa essa segunda
-- transição existir. Adiciona a transição matriculada -> concluida/
-- reprovada, só quando quem chama pode gerenciar aquela turma, com os
-- mesmos campos "não pode mudar" de antes.
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
     or new.motivo_rejeicao is distinct from old.motivo_rejeicao then
    raise exception 'você não tem permissão para alterar esta matrícula desta forma';
  end if;

  if old.status = 'inscrita' and new.status = 'cancelada' then
    return new;
  end if;

  if old.status = 'matriculada'
     and new.status in ('concluida', 'reprovada')
     and diario.pode_gerenciar_turma(new.turma_id) then
    return new;
  end if;

  raise exception 'você não tem permissão para alterar esta matrícula desta forma';
end;
$$;
