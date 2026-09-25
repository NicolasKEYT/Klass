-- D7 (klass-uikit.pdf, Início da coordenação) — as duas views de
-- relatório/BI já previstas no artigo do TCC1 (mesmos nomes citados lá):
-- vw_desempenho_por_trilha (taxa de aprovação nos módulos já encerrados,
-- por trilha) e vw_taxa_evasao (proporção de matrículas canceladas ou
-- reprovadas por período). Leitura só, aditivas — nenhuma tabela ou regra
-- de negócio muda.
--
-- Views não têm RLS própria em Postgres (RLS é das TABELAS; uma view por
-- padrão roda com o privilégio do dono, então uma policy nas tabelas de
-- baixo não protegeria a view sozinha). A garantia "leitura só para
-- coordenação" fica embutida na própria definição: um WHERE chamando
-- identidade.usuario_e_coordenacao() (SECURITY DEFINER, lê o papel de
-- quem está autenticado na sessão) — para qualquer outro papel, a
-- condição é falsa e a viagem devolve zero linhas, nunca erro.

create view catalogo.vw_desempenho_por_trilha as
select
  tr.id as trilha_id,
  tr.nome as trilha_nome,
  count(*) filter (where m.status = 'concluida') as total_aprovados,
  count(*) filter (where m.status in ('concluida', 'reprovada')) as total_encerrados,
  round(
    100.0 * count(*) filter (where m.status = 'concluida')
      / nullif(count(*) filter (where m.status in ('concluida', 'reprovada')), 0),
    1
  ) as taxa_aprovacao_percentual
from catalogo.trilhas tr
join catalogo.modulos mo on mo.trilha_id = tr.id
join selecao.turmas t on t.modulo_id = mo.id
join selecao.matriculas m on m.turma_id = t.id
where identidade.usuario_e_coordenacao()
group by tr.id, tr.nome;

comment on view catalogo.vw_desempenho_por_trilha is
  'Taxa de aprovação (concluída / (concluída + reprovada)) nos módulos já encerrados, por trilha. Só coordenação lê (ver comentário da migration).';

-- Período = semestre letivo, derivado de periodo_inicio da turma (mesma
-- convenção já usada no código da turma, ex.: "CDA-2026-1" = 2026, 1º
-- semestre). "Evadidos" segue literalmente o pedido do kit: cancelada OU
-- reprovada contam como saída do módulo sem concluir.
create view catalogo.vw_taxa_evasao as
select
  (
    extract(year from t.periodo_inicio)::text || '/' ||
    case when extract(month from t.periodo_inicio) <= 6 then '1' else '2' end
  ) as periodo,
  count(*) filter (where m.status in ('cancelada', 'reprovada')) as total_evadidos,
  count(*) filter (where m.status in ('concluida', 'reprovada', 'cancelada')) as total_encerrados,
  round(
    100.0 * count(*) filter (where m.status in ('cancelada', 'reprovada'))
      / nullif(count(*) filter (where m.status in ('concluida', 'reprovada', 'cancelada')), 0),
    1
  ) as taxa_evasao_percentual
from selecao.turmas t
join selecao.matriculas m on m.turma_id = t.id
where identidade.usuario_e_coordenacao()
group by periodo
order by periodo desc;

comment on view catalogo.vw_taxa_evasao is
  'Proporção de matrículas canceladas/reprovadas sobre matrículas encerradas, por semestre (derivado de periodo_inicio da turma). Só coordenação lê.';

-- catalogo já está exposto ao PostgREST (config.toml schemas) e
-- authenticated já tem usage no schema — só falta o select nas views.
grant select on catalogo.vw_desempenho_por_trilha to authenticated;
grant select on catalogo.vw_taxa_evasao to authenticated;
