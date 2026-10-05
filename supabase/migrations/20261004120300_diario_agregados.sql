-- MS4 — agregados calculados no banco, para tirar o peso do navegador:
--   * progresso de uma turma inteira numa chamada só (antes: três RPCs por
--     aluno — média, frequência e prontidão);
--   * indicadores por turma para o painel da coordenação (antes: todas as
--     matrículas, aulas e presenças vinham para o navegador, que agregava e
--     truncava em 1000 linhas).
-- As regras são as mesmas de diario.calcular_* (aula sem nenhuma presença
-- não conta; avaliação sem nota não entra na média).

-- Progresso de todas as matrículas que aparecem no diário da turma
-- (matriculada, concluída, reprovada). Só o professor da turma ou a
-- coordenação.
create or replace function diario.progresso_da_turma(p_turma_id uuid)
returns table (matricula_id uuid, media numeric, frequencia numeric, pronto_para_encerrar boolean)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if diario.chamada_pela_api() and not diario.pode_gerenciar_turma(p_turma_id) then
    raise exception 'apenas o professor da turma ou a coordenação podem ver o progresso da turma';
  end if;

  return query
  with
  mats as (
    select m.id
    from selecao.matriculas m
    where m.turma_id = p_turma_id and m.status in ('matriculada', 'concluida', 'reprovada')
  ),
  avals as (select a.id, a.peso from diario.avaliacoes a where a.turma_id = p_turma_id),
  aulas_turma as (select au.id from diario.aulas au where au.turma_id = p_turma_id),
  aulas_com_chamada as (
    select au.id from aulas_turma au
    where exists (select 1 from diario.presencas p where p.aula_id = au.id)
  ),
  notas_mat as (
    select n.matricula_id, sum(n.valor * av.peso) as soma, sum(av.peso) as pesos, count(*) as qtd
    from diario.notas n
    join avals av on av.id = n.avaliacao_id
    group by n.matricula_id
  ),
  pres_mat as (
    select p.matricula_id,
           count(*) filter (where p.presente and p.aula_id in (select id from aulas_com_chamada)) as presentes,
           count(*) as registradas
    from diario.presencas p
    where p.aula_id in (select id from aulas_turma)
    group by p.matricula_id
  )
  select
    mats.id,
    case when coalesce(nm.pesos, 0) = 0 then null else round(nm.soma / nm.pesos, 2) end,
    case
      when (select count(*) from aulas_com_chamada) = 0 then null
      else round(coalesce(pm.presentes, 0) * 100.0 / (select count(*) from aulas_com_chamada), 2)
    end,
    -- Mesma regra de calcular_pronto_para_encerrar: ao menos uma avaliação
    -- e uma aula, nota em todas e presença registrada em todas.
    (select count(*) from avals) > 0
      and (select count(*) from aulas_turma) > 0
      and coalesce(nm.qtd, 0) = (select count(*) from avals)
      and coalesce(pm.registradas, 0) = (select count(*) from aulas_turma)
  from mats
  left join notas_mat nm on nm.matricula_id = mats.id
  left join pres_mat pm on pm.matricula_id = mats.id;
end;
$$;

revoke execute on function diario.progresso_da_turma(uuid) from public, anon;
grant execute on function diario.progresso_da_turma(uuid) to authenticated, service_role;

-- Indicadores por turma (coordenação): aulas cadastradas e frequência dos
-- alunos cursando (status matriculada). Uma linha por turma; o painel
-- soma/pondera no navegador sobre poucas linhas.
--   alunos_com_frequencia  — cursando com ao menos uma aula com chamada;
--   frequencia_media       — média simples das frequências desses alunos;
--   alunos_abaixo_minimo_legal — frequência abaixo de 75% (LDB, art. 24),
--     o mesmo corte que o painel já usava (não a mínima de cada turma).
create or replace function diario.indicadores_por_turma()
returns table (
  turma_id uuid,
  total_aulas integer,
  alunos_com_frequencia integer,
  frequencia_media numeric,
  alunos_abaixo_minimo_legal integer
)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if diario.chamada_pela_api() and not identidade.usuario_e_coordenacao() then
    raise exception 'apenas a coordenação pode ver os indicadores das turmas';
  end if;

  return query
  with
  aulas_com_chamada as (
    select au.id, au.turma_id from diario.aulas au
    where exists (select 1 from diario.presencas p where p.aula_id = au.id)
  ),
  freq_aluno as (
    select m.turma_id,
           count(p.id) filter (where p.presente) * 100.0 / count(ac.id) as freq
    from selecao.matriculas m
    join aulas_com_chamada ac on ac.turma_id = m.turma_id
    left join diario.presencas p on p.aula_id = ac.id and p.matricula_id = m.id
    where m.status = 'matriculada'
    group by m.id, m.turma_id
  ),
  por_turma as (
    select f.turma_id,
           count(*)::integer as alunos,
           avg(f.freq) as media,
           count(*) filter (where f.freq < 75)::integer as abaixo
    from freq_aluno f
    group by f.turma_id
  )
  select t.id,
         (select count(*)::integer from diario.aulas au where au.turma_id = t.id),
         coalesce(pt.alunos, 0),
         pt.media,
         coalesce(pt.abaixo, 0)
  from selecao.turmas t
  left join por_turma pt on pt.turma_id = t.id;
end;
$$;

revoke execute on function diario.indicadores_por_turma() from public, anon;
grant execute on function diario.indicadores_por_turma() to authenticated, service_role;
