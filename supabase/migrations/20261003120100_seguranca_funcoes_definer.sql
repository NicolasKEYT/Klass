-- Segurança das funções SECURITY DEFINER expostas pela API (itens S1, S2 e
-- achado 9 da auditoria de 02/10/2026).
--
-- Contexto: no Postgres toda função nasce com EXECUTE para PUBLIC. Como os
-- schemas de domínio estão expostos no PostgREST, qualquer função definer
-- sem REVOKE vira um endpoint `rpc` que roda com os privilégios do dono,
-- ignorando a RLS. Esta migration fecha o que não deve ser chamado de fora
-- e põe guarda de "quem chama" nas leituras que o frontend precisa.
--
-- O service_role mantém o EXECUTE concedido em 20260917002613 (Workers,
-- operações sem usuário). Funções de trigger não aparecem aqui: o Postgres
-- não deixa chamá-las fora de um trigger, e o privilégio só é checado ao
-- criar o trigger.

-- ---------------------------------------------------------------------------
-- S1 — emissão de certificado fechada para a API.
-- Antes, um aluno logado chamava
--   supabase.schema('certificacao').rpc('emitir_certificado_modulo', …)
-- e ganhava um certificado "autêntico". A emissão só acontece pelo trigger
-- certificacao.ao_concluir_matricula (definer, dono postgres), que segue
-- podendo chamar as três. verificar_por_hash continua pública (página
-- /verificar, role anon) e é tratada na migration de certificação.
revoke execute on function certificacao.emitir_certificado_modulo(uuid) from public, anon, authenticated;
revoke execute on function certificacao.verificar_e_emitir(uuid, uuid) from public, anon, authenticated;
revoke execute on function certificacao.gerar_hash_publico() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Achado 9 — cálculos do diário legíveis por qualquer usuário logado.
-- media_ponderada, frequencia_percentual e pronto_para_encerrar recebiam
-- qualquer id de matrícula e devolviam nota/frequência de outro aluno.
--
-- Separação em duas camadas:
--   * diario.calcular_* — o cálculo puro, SEM guarda, fechado para a API.
--     Usado por quem já autorizou a operação (encerramento, emissão do
--     certificado). A emissão do certificado da trilha precisa da média de
--     módulos de OUTROS professores; com a guarda ela falharia quando o
--     professor do último módulo encerra a matrícula.
--   * diario.media_ponderada / frequencia_percentual / pronto_para_encerrar
--     — mesmos nomes e assinaturas que o frontend já chama; checam quem
--     chama e delegam ao cálculo.

create or replace function diario.calcular_media_ponderada(p_matricula_id uuid)
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

  -- Avaliação sem nota não entra (fica incompleta, não zerada): normaliza
  -- só pela soma dos pesos das avaliações que têm nota.
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

create or replace function diario.calcular_frequencia_percentual(p_matricula_id uuid)
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

  -- Aula sem NENHUMA presença registrada = chamada ainda não feita; não
  -- conta no denominador.
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

create or replace function diario.calcular_pronto_para_encerrar(p_matricula_id uuid)
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

  -- Turma sem avaliação ou sem aula não fica "pronta" por vacuidade.
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

revoke execute on function diario.calcular_media_ponderada(uuid) from public, anon, authenticated;
revoke execute on function diario.calcular_frequencia_percentual(uuid) from public, anon, authenticated;
revoke execute on function diario.calcular_pronto_para_encerrar(uuid) from public, anon, authenticated;
grant execute on function diario.calcular_media_ponderada(uuid) to service_role;
grant execute on function diario.calcular_frequencia_percentual(uuid) to service_role;
grant execute on function diario.calcular_pronto_para_encerrar(uuid) to service_role;

-- Chamada vinda da API com papel de usuário (authenticated/anon)? O
-- PostgREST faz `set local role`, e o GUC role continua visível dentro de
-- uma função definer (onde current_user já virou o dono). Fora disso —
-- seed rodando como postgres, service role dos Workers, chamadas internas
-- — não há usuário a restringir.
create or replace function diario.chamada_pela_api()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(current_setting('role', true), 'none') in ('authenticated', 'anon');
$$;

grant execute on function diario.chamada_pela_api() to authenticated, service_role;
revoke execute on function diario.chamada_pela_api() from public, anon;

-- Quem pode ver os números de uma matrícula: o aluno dono, o professor da
-- turma ou a coordenação; chamada interna (fora da API) também pode — o
-- anon nunca chega aqui porque não tem EXECUTE.
create or replace function diario.pode_ver_matricula(p_matricula_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select
    not diario.chamada_pela_api()
    or identidade.usuario_e_coordenacao()
    or exists (
      select 1
      from selecao.matriculas m
      join selecao.turmas t on t.id = m.turma_id
      where m.id = p_matricula_id
        and (m.aluno_id = auth.uid() or t.professor_id = auth.uid())
    );
$$;

revoke execute on function diario.pode_ver_matricula(uuid) from public, anon;
grant execute on function diario.pode_ver_matricula(uuid) to authenticated, service_role;

create or replace function diario.media_ponderada(p_matricula_id uuid)
returns numeric
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if not diario.pode_ver_matricula(p_matricula_id) then
    raise exception 'sem permissão para consultar esta matrícula';
  end if;
  return diario.calcular_media_ponderada(p_matricula_id);
end;
$$;

create or replace function diario.frequencia_percentual(p_matricula_id uuid)
returns numeric
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if not diario.pode_ver_matricula(p_matricula_id) then
    raise exception 'sem permissão para consultar esta matrícula';
  end if;
  return diario.calcular_frequencia_percentual(p_matricula_id);
end;
$$;

create or replace function diario.pronto_para_encerrar(p_matricula_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if not diario.pode_ver_matricula(p_matricula_id) then
    raise exception 'sem permissão para consultar esta matrícula';
  end if;
  return diario.calcular_pronto_para_encerrar(p_matricula_id);
end;
$$;

-- authenticated mantém o grant (o frontend e as funções INVOKER
-- encerrar_matricula/encerrar_turma chamam com o papel do usuário).
revoke execute on function diario.media_ponderada(uuid) from public, anon;
revoke execute on function diario.frequencia_percentual(uuid) from public, anon;
revoke execute on function diario.pronto_para_encerrar(uuid) from public, anon;

-- aplicar_encerramento já checa pode_gerenciar_turma; o corpo ganha as
-- checagens de status/prontidão na migration de auditoria do diário (que
-- a recria com o registro do histórico). Aqui só sai do anon/PUBLIC.
-- authenticated continua: encerrar_matricula/encerrar_turma são INVOKER.
revoke execute on function diario.aplicar_encerramento(uuid) from public, anon;

-- ---------------------------------------------------------------------------
-- Demais definer expostas que só falam de QUEM CHAMA (ou só devolvem
-- sim/não sem dado de terceiros): continuam para authenticated, saem do
-- PUBLIC/anon. O anon não tem USAGE nesses schemas, então isto é higiene —
-- deixa explícito quem pode chamar.
revoke execute on function diario.pode_gerenciar_turma(uuid) from public, anon;
revoke execute on function identidade.papel_do_usuario_atual() from public, anon;
revoke execute on function identidade.usuario_e_coordenacao() from public, anon;
-- Diretório id → nome, de propósito (ver 20260904034000).
revoke execute on function identidade.nomes_completos(uuid[]) from public, anon;
-- Usadas pelos triggers INVOKER de selecao (rodam com o papel de quem
-- grava), por isso authenticated precisa do EXECUTE.
revoke execute on function selecao.professor_da_turma(uuid) from public, anon;
revoke execute on function selecao.aluno_da_matricula(uuid) from public, anon;
revoke execute on function selecao.checar_vaga_disponivel(uuid) from public, anon;

-- Estas duas recebiam QUALQUER aluno_id: um aluno descobria se outro aluno
-- tinha matrícula ativa num módulo ou já concluiu um pré-requisito. Agora
-- só para o próprio aluno (o caso da inscrição e da tela do catálogo), a
-- coordenação ou chamada interna (fora da API — mesma leitura do GUC role
-- de diario.chamada_pela_api, repetida aqui para o MS3 não depender do MS4).
create or replace function selecao.validar_pre_requisitos_modulo(p_aluno_id uuid, p_modulo_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_faltantes text;
begin
  if coalesce(current_setting('role', true), 'none') in ('authenticated', 'anon')
     and p_aluno_id is distinct from auth.uid()
     and not identidade.usuario_e_coordenacao() then
    raise exception 'sem permissão para consultar outro aluno';
  end if;

  select string_agg(pr.nome, ', ')
  into v_faltantes
  from catalogo.pre_requisitos_de_modulo(p_modulo_id) pr
  where not exists (
    select 1
    from selecao.matriculas m
    join selecao.turmas t on t.id = m.turma_id
    where m.aluno_id = p_aluno_id
      and t.modulo_id = pr.id
      and m.status = 'concluida'
  );

  if v_faltantes is not null then
    raise exception 'Você precisa concluir o módulo % antes de se inscrever neste.', v_faltantes;
  end if;
end;
$$;

create or replace function selecao.checar_matricula_ativa_no_modulo(p_aluno_id uuid, p_modulo_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('role', true), 'none') in ('authenticated', 'anon')
     and p_aluno_id is distinct from auth.uid()
     and not identidade.usuario_e_coordenacao() then
    raise exception 'sem permissão para consultar outro aluno';
  end if;

  if exists (
    select 1
    from selecao.matriculas m
    join selecao.turmas t on t.id = m.turma_id
    where m.aluno_id = p_aluno_id
      and t.modulo_id = p_modulo_id
      and m.status in ('inscrita', 'matriculada')
  ) then
    raise exception 'Você já tem uma matrícula ativa neste módulo em outra turma.';
  end if;
end;
$$;

revoke execute on function selecao.validar_pre_requisitos_modulo(uuid, uuid) from public, anon;
revoke execute on function selecao.checar_matricula_ativa_no_modulo(uuid, uuid) from public, anon;

-- ---------------------------------------------------------------------------
-- S2 (b) — status final só pelo encerramento do diário.
-- Antes, professor (policy matriculas_update_professor) e coordenação
-- gravavam 'concluida' direto por UPDATE, sem média/frequência, e o trigger
-- de certificação emitia o certificado. As duas guardas abaixo valem só
-- para quem fala pela API (current_user authenticated/anon):
--   * entrar num status final: só diario.aplicar_encerramento (definer,
--     roda como postgres) passa;
--   * sair de um status final: só diario.desfazer_encerramento /
--     reativar_turma (definer), que exigem motivo, registram o histórico e
--     revogam o certificado. Sem esta segunda guarda a coordenação
--     "desfaria" por UPDATE direto, sem motivo e com o certificado válido.
-- NÃO pode virar SECURITY DEFINER: dentro de uma definer o current_user
-- seria sempre o dono e a guarda nunca dispararia.
-- A policy matriculas_update_professor fica redundante para status final
-- (o professor não tem mais transição direta que passe por aqui), mas é
-- mantida: removê-la não ganha segurança e mexe em RLS sem necessidade.
create or replace function selecao.restringir_alteracoes_matricula()
returns trigger
language plpgsql
as $$
begin
  if new.status in ('concluida', 'reprovada')
     and old.status is distinct from new.status
     and current_user in ('authenticated', 'anon') then
    raise exception 'o status final da matrícula só é definido pelo encerramento do diário';
  end if;

  if old.status in ('concluida', 'reprovada')
     and old.status is distinct from new.status
     and current_user in ('authenticated', 'anon') then
    raise exception 'para reabrir uma matrícula encerrada use "Desfazer encerramento", que pede o motivo';
  end if;

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

  -- Caminho do encerramento (aplicar_encerramento roda como postgres, já
  -- liberado pela guarda acima): continua exigindo quem gerencia a turma.
  if old.status = 'matriculada'
     and new.status in ('concluida', 'reprovada')
     and diario.pode_gerenciar_turma(new.turma_id) then
    return new;
  end if;

  raise exception 'você não tem permissão para alterar esta matrícula desta forma';
end;
$$;
