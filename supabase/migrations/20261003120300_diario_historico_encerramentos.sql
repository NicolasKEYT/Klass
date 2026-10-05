-- MS4 — encerramento com responsabilidade (itens S2-a e G6 da auditoria):
--   * aplicar_encerramento passa a exigir matrícula ativa e diário completo
--     (antes, o lote e uma chamada direta encerravam sem checar prontidão);
--   * desfazer o encerramento de um aluno e reativar a turma inteira exigem
--     motivo (mínimo 10 caracteres);
--   * toda ação fica num histórico (quem, quando, por quê, como estava);
--   * desfazer de quem tinha certificado REVOGA o certificado (função do
--     MS5), e reabrir revalida vaga e "uma matrícula ativa por módulo".

create type diario.acao_encerramento as enum ('encerrar', 'desfazer', 'reativar_turma');

-- Escrito só pelas funções definer abaixo (não há grant de escrita).
-- turma_id é guardado para a RLS do professor não precisar passar pela
-- matrícula (e para o histórico sobreviver a mudanças de turma).
create table diario.historico_encerramentos (
  id uuid primary key default gen_random_uuid(),
  matricula_id uuid not null references selecao.matriculas (id) on delete restrict,
  turma_id uuid not null references selecao.turmas (id) on delete restrict,
  acao diario.acao_encerramento not null,
  status_anterior selecao.status_matricula not null,
  status_novo selecao.status_matricula not null,
  -- Média/frequência no momento da ação (antes de reabrir, ou as que
  -- decidiram o encerramento).
  media numeric(4, 2) null,
  frequencia numeric(5, 2) null,
  -- Encerrar: o motivo automático (aprovado/reprovado por quê). Desfazer
  -- e reativar: o motivo informado pela coordenação, obrigatório.
  motivo text null,
  certificados_revogados integer not null default 0,
  realizado_por uuid null references identidade.profiles (id) on delete restrict,
  realizado_em timestamptz not null default now(),
  constraint historico_motivo_obrigatorio check (
    acao = 'encerrar' or char_length(btrim(coalesce(motivo, ''))) >= 10
  )
);
comment on table diario.historico_encerramentos is
  'Auditoria de encerrar / desfazer / reativar turma. Só as funções do diário escrevem; leitura pela coordenação e pelo professor da turma.';

create index historico_encerramentos_matricula_idx on diario.historico_encerramentos (matricula_id, realizado_em desc);
create index historico_encerramentos_turma_idx on diario.historico_encerramentos (turma_id, realizado_em desc);

alter table diario.historico_encerramentos enable row level security;

grant select on diario.historico_encerramentos to authenticated;

create policy historico_encerramentos_select
  on diario.historico_encerramentos
  for select
  to authenticated
  using (identidade.usuario_e_coordenacao() or diario.pode_gerenciar_turma(turma_id));

-- ---------------------------------------------------------------------------
-- MS3 — o que impede devolver uma matrícula encerrada para 'matriculada'.
-- null = pode reabrir. A regra de vaga e de "uma ativa por módulo" é do
-- motor de seleção; o diário só pergunta.
create or replace function selecao.bloqueio_para_reabrir(p_matricula_id uuid)
returns text
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_aluno_id uuid;
  v_turma_id uuid;
  v_modulo_id uuid;
  v_ocupadas integer;
  v_vagas smallint;
  v_outra_turma text;
begin
  select m.aluno_id, m.turma_id, t.modulo_id, t.vagas_total
  into v_aluno_id, v_turma_id, v_modulo_id, v_vagas
  from selecao.matriculas m
  join selecao.turmas t on t.id = m.turma_id
  where m.id = p_matricula_id;

  if v_turma_id is null then
    return 'matrícula não encontrada';
  end if;

  select t.codigo into v_outra_turma
  from selecao.matriculas m
  join selecao.turmas t on t.id = m.turma_id
  where m.aluno_id = v_aluno_id
    and t.modulo_id = v_modulo_id
    and m.id <> p_matricula_id
    and m.status in ('inscrita', 'matriculada')
  limit 1;
  if v_outra_turma is not null then
    return format('o aluno já tem matrícula ativa neste módulo na turma %s', v_outra_turma);
  end if;

  -- Mesma conta de checar_vaga_disponivel: inscrita + matriculada ocupam
  -- vaga. A matrícula encerrada não está contada, então reabrir precisa de
  -- uma vaga livre.
  select count(*) into v_ocupadas
  from selecao.matriculas
  where turma_id = v_turma_id and status in ('inscrita', 'matriculada');
  if v_ocupadas >= v_vagas then
    return format('a turma está sem vaga (%s de %s ocupadas); aumente as vagas para reabrir', v_ocupadas, v_vagas);
  end if;

  return null;
end;
$$;

revoke execute on function selecao.bloqueio_para_reabrir(uuid) from public, anon, authenticated;
grant execute on function selecao.bloqueio_para_reabrir(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- S2 (a) — núcleo do encerramento de UMA matrícula. Recriada a partir de
-- 20260924005856. Mudanças: exige status 'matriculada' e diário completo
-- logo depois da checagem de quem gerencia a turma (antes o encerramento
-- em lote pulava a prontidão por conta própria, mas uma chamada direta
-- encerrava sem nota); usa o cálculo sem guarda (já autorizado) e grava o
-- histórico. O grant a authenticated continua: encerrar_matricula e
-- encerrar_turma são INVOKER e a chamam com o papel do usuário.
create or replace function diario.aplicar_encerramento(p_matricula_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_turma_id uuid;
  v_status selecao.status_matricula;
  v_media numeric;
  v_freq numeric;
  v_freq_min smallint;
  v_media_min numeric;
  v_novo_status selecao.status_matricula;
  v_motivo text;
begin
  select turma_id, status into v_turma_id, v_status
  from selecao.matriculas where id = p_matricula_id
  for update;
  if v_turma_id is null then
    raise exception 'matrícula não encontrada';
  end if;

  if not diario.pode_gerenciar_turma(v_turma_id) then
    raise exception 'apenas o professor da turma ou a coordenação podem encerrar esta matrícula';
  end if;

  if v_status <> 'matriculada' then
    raise exception 'só é possível encerrar uma matrícula ativa (matriculada)';
  end if;

  if not diario.calcular_pronto_para_encerrar(p_matricula_id) then
    raise exception 'ainda há avaliação sem nota ou aula sem chamada para esta matrícula';
  end if;

  v_media := diario.calcular_media_ponderada(p_matricula_id);
  v_freq := diario.calcular_frequencia_percentual(p_matricula_id);
  select frequencia_minima_percentual into v_freq_min from selecao.turmas where id = v_turma_id;

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

  insert into diario.historico_encerramentos (
    matricula_id, turma_id, acao, status_anterior, status_novo, media, frequencia, motivo, realizado_por
  ) values (
    p_matricula_id, v_turma_id, 'encerrar', v_status, v_novo_status, v_media, v_freq, v_motivo, auth.uid()
  );

  return v_novo_status;
end;
$$;

-- ---------------------------------------------------------------------------
-- Núcleo compartilhado de "reabrir" (desfazer um aluno / reativar turma).
-- Interno: quem chama já checou que é a coordenação. o_bloqueio = null
-- quando reabriu, ou o motivo pelo qual não pôde (o lote usa para listar
-- os pulados; o individual transforma em erro). o_revogados = quantos
-- certificados caíram.
create or replace function diario.reabrir_matricula(
  p_matricula_id uuid,
  p_motivo text,
  p_acao diario.acao_encerramento,
  out o_bloqueio text,
  out o_revogados integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_turma_id uuid;
  v_status selecao.status_matricula;
  v_media numeric;
  v_freq numeric;
begin
  o_revogados := 0;

  select turma_id, status into v_turma_id, v_status
  from selecao.matriculas where id = p_matricula_id
  for update;

  if v_turma_id is null then
    o_bloqueio := 'matrícula não encontrada';
    return;
  end if;
  if v_status not in ('concluida', 'reprovada') then
    o_bloqueio := 'matrícula não está encerrada';
    return;
  end if;

  o_bloqueio := selecao.bloqueio_para_reabrir(p_matricula_id);
  if o_bloqueio is not null then
    return;
  end if;

  v_media := diario.calcular_media_ponderada(p_matricula_id);
  v_freq := diario.calcular_frequencia_percentual(p_matricula_id);

  -- Antes de mudar o status: a revogação usa o status 'concluida' para
  -- saber que o certificado da trilha também cai.
  o_revogados := certificacao.revogar_certificados_da_matricula(
    p_matricula_id,
    'Encerramento desfeito pela coordenação: ' || btrim(p_motivo)
  );

  update selecao.matriculas
  set status = 'matriculada',
      motivo_conclusao = null,
      encerrada_em = null,
      encerrada_por = null
  where id = p_matricula_id;

  insert into diario.historico_encerramentos (
    matricula_id, turma_id, acao, status_anterior, status_novo, media, frequencia,
    motivo, certificados_revogados, realizado_por
  ) values (
    p_matricula_id, v_turma_id, p_acao, v_status, 'matriculada', v_media, v_freq,
    btrim(p_motivo), o_revogados, auth.uid()
  );
end;
$$;

revoke execute on function diario.reabrir_matricula(uuid, text, diario.acao_encerramento) from public, anon, authenticated;
grant execute on function diario.reabrir_matricula(uuid, text, diario.acao_encerramento) to service_role;

-- ---------------------------------------------------------------------------
-- Desfazer encerramento de UM aluno. Assinatura nova (com motivo): a
-- antiga, sem motivo, sai — o frontend é atualizado junto (aplicar esta
-- migration ANTES de publicar o frontend). Passa a ser SECURITY DEFINER
-- porque escreve no histórico e revoga certificado; a checagem de
-- coordenação é explícita.
drop function if exists diario.desfazer_encerramento(uuid);

create function diario.desfazer_encerramento(p_matricula_id uuid, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bloqueio text;
  v_revogados integer;
begin
  if not identidade.usuario_e_coordenacao() then
    raise exception 'apenas a coordenação pode desfazer um encerramento';
  end if;

  if p_motivo is null or char_length(btrim(p_motivo)) < 10 then
    raise exception 'informe o motivo para desfazer o encerramento (mínimo 10 caracteres)';
  end if;

  select r.o_bloqueio, r.o_revogados into v_bloqueio, v_revogados
  from diario.reabrir_matricula(p_matricula_id, p_motivo, 'desfazer') r;
  if v_bloqueio is not null then
    raise exception 'Não foi possível desfazer o encerramento: %.', v_bloqueio;
  end if;

  return jsonb_build_object('certificados_revogados', coalesce(v_revogados, 0));
end;
$$;

revoke execute on function diario.desfazer_encerramento(uuid, text) from public, anon;
grant execute on function diario.desfazer_encerramento(uuid, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Reativar a turma inteira: cada encerrada é reaberta pelas mesmas regras;
-- quem não pode (sem vaga, matrícula ativa em outra turma) é PULADO e
-- volta no resumo com o motivo, sem travar os demais.
drop function if exists diario.reativar_turma(uuid);

create function diario.reativar_turma(p_turma_id uuid, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_matricula record;
  v_bloqueio text;
  v_reativadas jsonb := '[]'::jsonb;
  v_puladas jsonb := '[]'::jsonb;
  v_revogados integer := 0;
  v_n integer;
begin
  if not identidade.usuario_e_coordenacao() then
    raise exception 'apenas a coordenação pode reativar a turma';
  end if;

  if p_motivo is null or char_length(btrim(p_motivo)) < 10 then
    raise exception 'informe o motivo para reativar a turma (mínimo 10 caracteres)';
  end if;

  for v_matricula in
    select m.id, m.aluno_id, n.nome_completo
    from selecao.matriculas m
    left join identidade.nomes_completos(
      array(select aluno_id from selecao.matriculas where turma_id = p_turma_id)
    ) n on n.id = m.aluno_id
    where m.turma_id = p_turma_id and m.status in ('concluida', 'reprovada')
    order by n.nome_completo
  loop
    select r.o_bloqueio, r.o_revogados into v_bloqueio, v_n
    from diario.reabrir_matricula(v_matricula.id, p_motivo, 'reativar_turma') r;
    if v_bloqueio is null then
      v_reativadas := v_reativadas || jsonb_build_object(
        'matricula_id', v_matricula.id, 'aluno_nome', v_matricula.nome_completo
      );
      v_revogados := v_revogados + v_n;
    else
      v_puladas := v_puladas || jsonb_build_object(
        'matricula_id', v_matricula.id, 'aluno_nome', v_matricula.nome_completo, 'motivo', v_bloqueio
      );
    end if;
  end loop;

  return jsonb_build_object(
    'reativadas', jsonb_array_length(v_reativadas),
    'puladas', jsonb_array_length(v_puladas),
    'alunos_reativados', v_reativadas,
    'alunos_pulados', v_puladas,
    'certificados_revogados', v_revogados
  );
end;
$$;

revoke execute on function diario.reativar_turma(uuid, text) from public, anon;
grant execute on function diario.reativar_turma(uuid, text) to authenticated, service_role;
