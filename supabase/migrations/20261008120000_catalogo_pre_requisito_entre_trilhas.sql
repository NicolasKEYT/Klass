-- A15 (QA): pré-requisito de módulo pode vir de OUTRA trilha.
--
-- Revoga a decisão de escopo da migration criar_schema_catalogo ("só entre
-- módulos da mesma trilha"): a coordenação precisa exigir, por exemplo,
-- "Aprendizado de Máquina" (Nível 1) antes de "Aprendizado de Máquina
-- Avançado" (Nível 2). Não é desvio do artigo — ele pede "verificação
-- automática de pré-requisitos no momento da inscrição" sem restringir a
-- trilha; a restrição era nossa.
--
-- O que muda:
-- 1. O trigger da mesma trilha sai. No lugar, um que recusa auto-referência
--    com mensagem clara e só aceita módulo de outra trilha se essa trilha
--    estiver publicada (o aluno precisa conseguir ver e cursar o módulo
--    exigido). Entre módulos da mesma trilha nada muda: a trilha em
--    rascunho continua montando sua sequência antes de publicar.
-- 2. O anti-ciclo passa a valer também no UPDATE, diz quais módulos fecham
--    o ciclo e serializa as gravações (dois cadastros simultâneos, cada um
--    válido sozinho, não fecham um ciclo entre si).
-- 3. catalogo.pre_requisitos_detalhados(): nome, trilha e slug de cada
--    pré-requisito, para a tela mostrar "Trilha · Módulo" e linkar — sem
--    isso o pré-requisito de outra trilha aparecia como "—".
--
-- selecao.validar_pre_requisitos_modulo() não muda: já é SECURITY DEFINER
-- e lê catalogo.pre_requisitos_de_modulo() sem filtro de trilha, então
-- confere a matrícula concluída do aluno no módulo exigido, em qualquer
-- trilha.

drop trigger if exists pre_requisitos_validar_mesma_trilha on catalogo.pre_requisitos_modulo;
drop function if exists catalogo.validar_pre_requisito_mesma_trilha();

create or replace function catalogo.validar_pre_requisito()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trilha_modulo uuid;
  v_trilha_pre_requisito uuid;
  v_publicada boolean;
begin
  -- A check constraint também barra, mas com o nome técnico da regra.
  if new.modulo_id = new.pre_requisito_id then
    raise exception 'Um módulo não pode ser pré-requisito de si mesmo.';
  end if;

  select trilha_id into v_trilha_modulo from catalogo.modulos where id = new.modulo_id;
  select m.trilha_id, t.publicada
  into v_trilha_pre_requisito, v_publicada
  from catalogo.modulos m
  join catalogo.trilhas t on t.id = m.trilha_id
  where m.id = new.pre_requisito_id;

  if v_trilha_modulo is distinct from v_trilha_pre_requisito and not coalesce(v_publicada, false) then
    raise exception 'Pré-requisito de outra trilha precisa ser um módulo de trilha publicada.';
  end if;

  return new;
end;
$$;

drop trigger if exists pre_requisitos_validar on catalogo.pre_requisitos_modulo;
create trigger pre_requisitos_validar
  before insert or update of modulo_id, pre_requisito_id on catalogo.pre_requisitos_modulo
  for each row
  execute function catalogo.validar_pre_requisito();

-- Mesma busca de antes (a cadeia de pré-requisitos que o módulo exigido já
-- tem; se o módulo que exige aparecer nela, fecha um ciclo), agora sem
-- depender da RLS de quem grava e cruzando trilhas.
create or replace function catalogo.impedir_ciclo_pre_requisito()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nome_modulo text;
  v_nome_pre_requisito text;
begin
  -- Serializa só as gravações desta tabela (raras): o segundo cadastro
  -- espera o primeiro terminar e enxerga a linha dele na busca abaixo.
  perform pg_advisory_xact_lock(hashtext('catalogo.pre_requisitos_modulo'));

  if exists (
    with recursive cadeia as (
      select pre_requisito_id as modulo
      from catalogo.pre_requisitos_modulo
      where modulo_id = new.pre_requisito_id
        and (tg_op = 'INSERT' or (modulo_id, pre_requisito_id) <> (old.modulo_id, old.pre_requisito_id))
      union
      select p.pre_requisito_id
      from catalogo.pre_requisitos_modulo p
      join cadeia c on p.modulo_id = c.modulo
      where tg_op = 'INSERT' or (p.modulo_id, p.pre_requisito_id) <> (old.modulo_id, old.pre_requisito_id)
    )
    select 1 from cadeia where modulo = new.modulo_id
  ) then
    select nome into v_nome_modulo from catalogo.modulos where id = new.modulo_id;
    select nome into v_nome_pre_requisito from catalogo.modulos where id = new.pre_requisito_id;
    raise exception 'Isso criaria um ciclo: "%" já depende, direta ou indiretamente, de "%".',
      v_nome_pre_requisito, v_nome_modulo;
  end if;

  return new;
end;
$$;

drop trigger if exists pre_requisitos_impedir_ciclo on catalogo.pre_requisitos_modulo;
create trigger pre_requisitos_impedir_ciclo
  before insert or update of modulo_id, pre_requisito_id on catalogo.pre_requisitos_modulo
  for each row
  execute function catalogo.impedir_ciclo_pre_requisito();

revoke execute on function catalogo.validar_pre_requisito() from public, anon, authenticated;
revoke execute on function catalogo.impedir_ciclo_pre_requisito() from public, anon, authenticated;

-- SECURITY DEFINER de propósito: o módulo exigido pode estar numa trilha
-- que o aluno não enxerga pela RLS (despublicada depois do cadastro), e
-- mesmo assim ele precisa saber o nome do que falta. Só devolve
-- pré-requisitos de módulos que o próprio chamador pode ver — mesma regra
-- da policy pre_requisitos_select — e só nome/trilha, nada além.
create or replace function catalogo.pre_requisitos_detalhados(p_modulo_ids uuid[])
returns table (
  modulo_id uuid,
  pre_requisito_id uuid,
  nome text,
  trilha_id uuid,
  trilha_nome text,
  trilha_slug text
)
language sql
stable
security definer
set search_path = ''
as $$
  select pr.modulo_id, m.id, m.nome, t.id, t.nome, t.slug
  from catalogo.pre_requisitos_modulo pr
  join catalogo.modulos dependente on dependente.id = pr.modulo_id
  join catalogo.trilhas trilha_dependente on trilha_dependente.id = dependente.trilha_id
  join catalogo.modulos m on m.id = pr.pre_requisito_id
  join catalogo.trilhas t on t.id = m.trilha_id
  where pr.modulo_id = any (p_modulo_ids)
    and (trilha_dependente.publicada or identidade.usuario_e_coordenacao())
  -- Os da mesma trilha primeiro, na ordem da trilha; depois os de fora.
  order by pr.modulo_id, (t.id <> dependente.trilha_id), t.nome, m.ordem;
$$;

revoke execute on function catalogo.pre_requisitos_detalhados(uuid[]) from public, anon;
grant execute on function catalogo.pre_requisitos_detalhados(uuid[]) to authenticated;
