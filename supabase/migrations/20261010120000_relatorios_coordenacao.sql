-- Relatórios da coordenação: base da tela de exports e do dashboard de
-- indicadores. Os dados saem do servidor, por função nomeada, em vez do cache
-- do navegador (que só tem o que alguma tela já leu e trunca em 1000 linhas).
--
-- Duas camadas, como em diario.calcular_* / diario.media_ponderada:
--   * <schema>.fonte_* — leitura crua do que o schema é dono, SEM guarda e
--     FECHADA para a API. É por elas que um contexto lê dado de outro, para
--     nenhum relatório consultar tabela alheia.
--   * <schema>.relatorio_* — abertas só a authenticated, e a primeira coisa
--     que fazem é recusar quem não é coordenação (erro 42501, não lista vazia:
--     a tela precisa distinguir "sem permissão" de "sem dados").
--
-- A RLS de leitura já cobria a coordenação em identidade.profiles, selecao,
-- diario e certificacao (auditado nesta fase) — nenhuma policy muda. As funções
-- são SECURITY DEFINER porque o e-mail vem de auth.users e as fontes são
-- fechadas; a autorização é a guarda, não a RLS.
--
-- Conteúdo: nenhum export traz CPF ou dado sensível (o banco nem tem essas
-- colunas). Se um dia existirem, não entram nestas funções.
--
-- Filtros, todos opcionais (null = sem filtro), sempre em data local:
--   p_inicio/p_fim — o que "período" significa está em cada função;
--   p_trilha_id    — trilha do módulo da turma;
--   p_status       — valor do status daquele conjunto, como texto.

-- ---------------------------------------------------------------------------
-- Fontes (fechadas para a API)

-- O e-mail só sai daqui, e só a pedido: entra na lista e no export de alunos
-- (decisão do Gabriel, 30/10) e em nenhum outro relatório.
create or replace function identidade.fonte_pessoas(
  p_papel identidade.papel,
  p_incluir_email boolean
)
returns table (id uuid, nome_completo text, criado_em timestamptz, email text)
language sql
security definer
stable
set search_path = ''
as $$
  select p.id,
         p.nome_completo,
         p.criado_em,
         case when p_incluir_email then u.email::text end
  from identidade.profiles p
  join auth.users u on u.id = p.id
  where p_papel is null or p.papel = p_papel;
$$;

-- Dia no fuso da instituição: um filtro "até 31/12" tem de incluir o que
-- entrou às 22h de 31/12 em São Paulo (já 1º/1 em UTC).
create or replace function identidade.data_local(p_instante timestamptz)
returns date
language sql
immutable
set search_path = ''
as $$
  select (p_instante at time zone 'America/Sao_Paulo')::date;
$$;

create or replace function catalogo.fonte_modulos()
returns table (
  modulo_id uuid,
  modulo_nome text,
  trilha_id uuid,
  trilha_nome text
)
language sql
security definer
stable
set search_path = ''
as $$
  select mo.id, mo.nome, tr.id, tr.nome
  from catalogo.modulos mo
  join catalogo.trilhas tr on tr.id = mo.trilha_id;
$$;

create or replace function selecao.fonte_turmas()
returns table (
  turma_id uuid,
  codigo text,
  turno text,
  modulo_id uuid,
  professor_id uuid,
  periodo_inicio date,
  periodo_fim date,
  vagas_total smallint,
  frequencia_minima_percentual smallint
)
language sql
security definer
stable
set search_path = ''
as $$
  select t.id, t.codigo, t.turno, t.modulo_id, t.professor_id, t.periodo_inicio,
         t.periodo_fim, t.vagas_total, t.frequencia_minima_percentual
  from selecao.turmas t;
$$;

create or replace function selecao.fonte_matriculas()
returns table (
  matricula_id uuid,
  aluno_id uuid,
  turma_id uuid,
  status text,
  criado_em timestamptz,
  deferido_em timestamptz,
  encerrada_em timestamptz
)
language sql
security definer
stable
set search_path = ''
as $$
  select m.id, m.aluno_id, m.turma_id, m.status::text, m.criado_em, m.deferido_em, m.encerrada_em
  from selecao.matriculas m;
$$;

-- Média e frequência de cada matrícula que aparece no diário. Mesmas regras de
-- diario.progresso_da_turma (aula sem nenhuma presença não conta; avaliação sem
-- nota não entra na média), para toda a instituição numa consulta só.
create or replace function diario.fonte_desempenho()
returns table (matricula_id uuid, media numeric, frequencia numeric)
language sql
security definer
stable
set search_path = ''
as $$
  with
  mats as (
    select f.matricula_id, f.turma_id
    from selecao.fonte_matriculas() f
    where f.status in ('matriculada', 'concluida', 'reprovada')
  ),
  aulas_com_chamada as (
    select au.id, au.turma_id
    from diario.aulas au
    where exists (select 1 from diario.presencas p where p.aula_id = au.id)
  ),
  aulas_por_turma as (
    select ac.turma_id, count(*) as total from aulas_com_chamada ac group by ac.turma_id
  ),
  presentes as (
    select p.matricula_id, count(*) filter (where p.presente) as total
    from diario.presencas p
    join aulas_com_chamada ac on ac.id = p.aula_id
    group by p.matricula_id
  ),
  notas as (
    select n.matricula_id, sum(n.valor * av.peso) as soma, sum(av.peso) as pesos
    from diario.notas n
    join diario.avaliacoes av on av.id = n.avaliacao_id
    group by n.matricula_id
  )
  select mats.matricula_id,
         case when coalesce(n.pesos, 0) = 0 then null else round(n.soma / n.pesos, 2) end,
         case
           when apt.total is null then null
           else round(coalesce(pr.total, 0) * 100.0 / apt.total, 2)
         end
  from mats
  left join aulas_por_turma apt on apt.turma_id = mats.turma_id
  left join presentes pr on pr.matricula_id = mats.matricula_id
  left join notas n on n.matricula_id = mats.matricula_id;
$$;

create or replace function certificacao.fonte_certificados()
returns table (certificado_id uuid, trilha_id uuid, emitido_em timestamptz, revogado_em timestamptz)
language sql
security definer
stable
set search_path = ''
as $$
  select c.id, c.trilha_id, c.emitido_em, c.revogado_em
  from certificacao.certificados c;
$$;

revoke execute on function identidade.fonte_pessoas(identidade.papel, boolean) from public, anon, authenticated;
revoke execute on function identidade.data_local(timestamptz) from public, anon, authenticated;
revoke execute on function catalogo.fonte_modulos() from public, anon, authenticated;
revoke execute on function selecao.fonte_turmas() from public, anon, authenticated;
revoke execute on function selecao.fonte_matriculas() from public, anon, authenticated;
revoke execute on function diario.fonte_desempenho() from public, anon, authenticated;
revoke execute on function certificacao.fonte_certificados() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Alunos. Período = data de cadastro. Trilha limita os números ao que o aluno
-- fez nela (e tira da lista quem não tem matrícula nela). Status = alunos com
-- ao menos uma matrícula naquele status.
create or replace function identidade.relatorio_alunos(
  p_inicio date default null,
  p_fim date default null,
  p_trilha_id uuid default null,
  p_status text default null
)
returns table (
  aluno_id uuid,
  nome text,
  email text,
  cadastrado_em timestamptz,
  matriculas_ativas integer,
  trilhas_concluidas integer,
  frequencia_media numeric,
  nota_media numeric
)
language plpgsql
security definer
stable
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not identidade.usuario_e_coordenacao() then
    raise exception 'apenas a coordenação pode ver este relatório' using errcode = '42501';
  end if;

  return query
  with
  modulos as (select * from catalogo.fonte_modulos()),
  mats as (
    select f.matricula_id, f.aluno_id, f.status, t.modulo_id, mo.trilha_id
    from selecao.fonte_matriculas() f
    join selecao.fonte_turmas() t on t.turma_id = f.turma_id
    join modulos mo on mo.modulo_id = t.modulo_id
    where p_trilha_id is null or mo.trilha_id = p_trilha_id
  ),
  -- Trilha concluída = todos os módulos dela com matrícula concluída.
  trilhas_feitas as (
    select feitos.aluno_id, count(*)::integer as total
    from (
      select m.aluno_id, m.trilha_id, count(distinct m.modulo_id) as concluidos
      from mats m
      where m.status = 'concluida'
      group by m.aluno_id, m.trilha_id
    ) feitos
    join (
      select mo.trilha_id, count(*) as total from modulos mo group by mo.trilha_id
    ) exigidos on exigidos.trilha_id = feitos.trilha_id
    where feitos.concluidos = exigidos.total
    group by feitos.aluno_id
  ),
  numeros as (
    select m.aluno_id,
           count(*) filter (where m.status = 'matriculada')::integer as ativas,
           round(avg(d.frequencia), 2) as frequencia,
           round(avg(d.media), 2) as media,
           bool_or(m.status = p_status) as tem_status
    from mats m
    left join diario.fonte_desempenho() d on d.matricula_id = m.matricula_id
    group by m.aluno_id
  )
  select p.id,
         p.nome_completo,
         p.email,
         p.criado_em,
         coalesce(n.ativas, 0),
         coalesce(tf.total, 0),
         n.frequencia,
         n.media
  from identidade.fonte_pessoas('aluno', true) p
  left join numeros n on n.aluno_id = p.id
  left join trilhas_feitas tf on tf.aluno_id = p.id
  where (p_inicio is null or identidade.data_local(p.criado_em) >= p_inicio)
    and (p_fim is null or identidade.data_local(p.criado_em) <= p_fim)
    and (p_trilha_id is null or n.aluno_id is not null)
    and (p_status is null or coalesce(n.tem_status, false))
  -- Ordem total: a tela lê em páginas (PostgREST corta em max_rows). Vale para
  -- todos os relatórios: sem ela, uma linha pode repetir ou sumir entre páginas.
  order by p.nome_completo, p.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Docentes. Período e trilha limitam as turmas contadas (período = turma com
-- dias dentro do intervalo); com algum dos dois, docente sem turma nele sai da
-- lista. Status = situação da turma (ver relatorio_turmas).
create or replace function identidade.relatorio_docentes(
  p_inicio date default null,
  p_fim date default null,
  p_trilha_id uuid default null,
  p_status text default null
)
returns table (
  docente_id uuid,
  nome text,
  cadastrado_em timestamptz,
  turmas integer,
  turmas_em_andamento integer,
  alunos_ativos integer
)
language plpgsql
security definer
stable
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not identidade.usuario_e_coordenacao() then
    raise exception 'apenas a coordenação pode ver este relatório' using errcode = '42501';
  end if;

  return query
  with
  turmas as (
    select r.docente_id, r.status, r.matriculadas
    from selecao.relatorio_turmas(p_inicio, p_fim, p_trilha_id, p_status) r
  ),
  numeros as (
    select t.docente_id,
           count(*)::integer as total,
           count(*) filter (where t.status = 'em_andamento')::integer as em_andamento,
           sum(t.matriculadas)::integer as ativos
    from turmas t
    group by t.docente_id
  )
  select p.id,
         p.nome_completo,
         p.criado_em,
         coalesce(n.total, 0),
         coalesce(n.em_andamento, 0),
         coalesce(n.ativos, 0)
  from identidade.fonte_pessoas('professor', false) p
  left join numeros n on n.docente_id = p.id
  where (p_inicio is null and p_fim is null and p_trilha_id is null and p_status is null)
     or n.docente_id is not null
  order by p.nome_completo, p.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Trilhas e módulos: uma linha por módulo; trilha sem módulo aparece com os
-- campos do módulo vazios. Status = 'publicada' ou 'rascunho'. Período limita
-- as turmas contadas, não o catálogo.
create or replace function catalogo.relatorio_trilhas(
  p_inicio date default null,
  p_fim date default null,
  p_trilha_id uuid default null,
  p_status text default null
)
returns table (
  trilha_id uuid,
  trilha_nome text,
  status_publicacao text,
  carga_horaria_trilha integer,
  modulo_id uuid,
  modulo_ordem smallint,
  modulo_nome text,
  modulo_nivel text,
  carga_horaria_modulo smallint,
  pre_requisitos text,
  turmas integer
)
language plpgsql
security definer
stable
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not identidade.usuario_e_coordenacao() then
    raise exception 'apenas a coordenação pode ver este relatório' using errcode = '42501';
  end if;

  return query
  with
  requisitos as (
    select pr.modulo_id,
           string_agg(tr_req.nome || ' · ' || req.nome, '; ' order by tr_req.nome, req.ordem) as lista
    from catalogo.pre_requisitos_modulo pr
    join catalogo.modulos req on req.id = pr.pre_requisito_id
    join catalogo.trilhas tr_req on tr_req.id = req.trilha_id
    group by pr.modulo_id
  ),
  turmas_modulo as (
    select t.modulo_id, count(*)::integer as total
    from selecao.fonte_turmas() t
    where (p_inicio is null or t.periodo_fim >= p_inicio)
      and (p_fim is null or t.periodo_inicio <= p_fim)
    group by t.modulo_id
  )
  select tr.id,
         tr.nome,
         case when tr.publicada then 'publicada' else 'rascunho' end,
         tr.carga_horaria_total,
         mo.id,
         mo.ordem,
         mo.nome,
         mo.nivel::text,
         mo.carga_horaria_horas,
         rq.lista,
         coalesce(tm.total, 0)
  from catalogo.trilhas tr
  left join catalogo.modulos mo on mo.trilha_id = tr.id
  left join requisitos rq on rq.modulo_id = mo.id
  left join turmas_modulo tm on tm.modulo_id = mo.id
  where (p_trilha_id is null or tr.id = p_trilha_id)
    and (p_status is null or p_status = case when tr.publicada then 'publicada' else 'rascunho' end)
  order by tr.nome, tr.id, mo.ordem nulls first;
end;
$$;

-- ---------------------------------------------------------------------------
-- Turmas. Período = turma com dias dentro do intervalo. Status = situação,
-- com a mesma regra de situacaoDaTurma (apps/web/src/lib/selecao.ts); não há
-- coluna de estado da turma no banco.
-- Ocupação conta quem ocupou lugar (inscrita, matriculada, concluída,
-- reprovada), não só as vagas tomadas agora: quem concluiu libera a vaga, e
-- turma encerrada apareceria vazia.
create or replace function selecao.relatorio_turmas(
  p_inicio date default null,
  p_fim date default null,
  p_trilha_id uuid default null,
  p_status text default null
)
returns table (
  turma_id uuid,
  codigo text,
  turno text,
  trilha_id uuid,
  trilha_nome text,
  modulo_nome text,
  docente_id uuid,
  docente_nome text,
  periodo_inicio date,
  periodo_fim date,
  vagas_total smallint,
  inscritas integer,
  matriculadas integer,
  concluidas integer,
  reprovadas integer,
  ocupacao_percentual numeric,
  status text
)
language plpgsql
security definer
stable
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_hoje date := diario.hoje();
begin
  if not identidade.usuario_e_coordenacao() then
    raise exception 'apenas a coordenação pode ver este relatório' using errcode = '42501';
  end if;

  return query
  select linhas.*
  from (
    select t.turma_id,
           t.codigo,
           t.turno,
           mo.trilha_id,
           mo.trilha_nome,
           mo.modulo_nome,
           t.professor_id,
           p.nome_completo,
           t.periodo_inicio,
           t.periodo_fim,
           t.vagas_total,
           o.inscritas,
           o.matriculadas,
           o.concluidas,
           o.reprovadas,
           round((o.inscritas + o.matriculadas + o.concluidas + o.reprovadas) * 100.0 / t.vagas_total, 1),
           case
             when t.periodo_inicio > v_hoje then 'futura'
             when t.periodo_fim >= v_hoje then 'em_andamento'
             when o.inscritas + o.matriculadas > 0 then 'aguardando_encerramento'
             else 'encerrada'
           end as situacao
    from selecao.fonte_turmas() t
    join catalogo.fonte_modulos() mo on mo.modulo_id = t.modulo_id
    join identidade.fonte_pessoas(null, false) p on p.id = t.professor_id
    join selecao.ocupacao_turmas(null) o on o.turma_id = t.turma_id
    where (p_inicio is null or t.periodo_fim >= p_inicio)
      and (p_fim is null or t.periodo_inicio <= p_fim)
      and (p_trilha_id is null or mo.trilha_id = p_trilha_id)
  ) linhas
  where p_status is null or linhas.situacao = p_status
  order by linhas.periodo_inicio desc, linhas.codigo, linhas.turma_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Matrículas e inscrições. Período = data da inscrição. Status = da matrícula.
-- motivo_rejeicao fica de fora: é texto livre, pode conter dado pessoal.
create or replace function selecao.relatorio_matriculas(
  p_inicio date default null,
  p_fim date default null,
  p_trilha_id uuid default null,
  p_status text default null
)
returns table (
  matricula_id uuid,
  aluno_id uuid,
  aluno_nome text,
  trilha_id uuid,
  trilha_nome text,
  modulo_nome text,
  turma_id uuid,
  turma_codigo text,
  status text,
  inscrito_em timestamptz,
  deferido_em timestamptz,
  encerrada_em timestamptz
)
language plpgsql
security definer
stable
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not identidade.usuario_e_coordenacao() then
    raise exception 'apenas a coordenação pode ver este relatório' using errcode = '42501';
  end if;

  return query
  select f.matricula_id,
         f.aluno_id,
         p.nome_completo,
         mo.trilha_id,
         mo.trilha_nome,
         mo.modulo_nome,
         f.turma_id,
         t.codigo,
         f.status,
         f.criado_em,
         f.deferido_em,
         f.encerrada_em
  from selecao.fonte_matriculas() f
  join selecao.fonte_turmas() t on t.turma_id = f.turma_id
  join catalogo.fonte_modulos() mo on mo.modulo_id = t.modulo_id
  join identidade.fonte_pessoas(null, false) p on p.id = f.aluno_id
  where (p_inicio is null or identidade.data_local(f.criado_em) >= p_inicio)
    and (p_fim is null or identidade.data_local(f.criado_em) <= p_fim)
    and (p_trilha_id is null or mo.trilha_id = p_trilha_id)
    and (p_status is null or f.status = p_status)
  order by f.criado_em desc, f.matricula_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Notas e frequência por aluno × turma (só quem aparece no diário). Período =
-- turma com dias dentro do intervalo. Status = da matrícula.
create or replace function diario.relatorio_notas_frequencia(
  p_inicio date default null,
  p_fim date default null,
  p_trilha_id uuid default null,
  p_status text default null
)
returns table (
  matricula_id uuid,
  aluno_id uuid,
  aluno_nome text,
  trilha_id uuid,
  trilha_nome text,
  modulo_nome text,
  turma_id uuid,
  turma_codigo text,
  status text,
  nota_media numeric,
  frequencia_percentual numeric,
  frequencia_minima_percentual smallint
)
language plpgsql
security definer
stable
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not identidade.usuario_e_coordenacao() then
    raise exception 'apenas a coordenação pode ver este relatório' using errcode = '42501';
  end if;

  return query
  select f.matricula_id,
         f.aluno_id,
         p.nome_completo,
         mo.trilha_id,
         mo.trilha_nome,
         mo.modulo_nome,
         f.turma_id,
         t.codigo,
         f.status,
         d.media,
         d.frequencia,
         t.frequencia_minima_percentual
  from diario.fonte_desempenho() d
  join selecao.fonte_matriculas() f on f.matricula_id = d.matricula_id
  join selecao.fonte_turmas() t on t.turma_id = f.turma_id
  join catalogo.fonte_modulos() mo on mo.modulo_id = t.modulo_id
  join identidade.fonte_pessoas(null, false) p on p.id = f.aluno_id
  where (p_inicio is null or t.periodo_fim >= p_inicio)
    and (p_fim is null or t.periodo_inicio <= p_fim)
    and (p_trilha_id is null or mo.trilha_id = p_trilha_id)
    and (p_status is null or f.status = p_status)
  order by p.nome_completo, t.codigo, f.matricula_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Certificados. Nomes vêm congelados no próprio certificado (o documento diz o
-- que dizia ao ser emitido). Período = data de emissão. Status = 'valido' ou
-- 'revogado'.
create or replace function certificacao.relatorio_certificados(
  p_inicio date default null,
  p_fim date default null,
  p_trilha_id uuid default null,
  p_status text default null
)
returns table (
  certificado_id uuid,
  aluno_id uuid,
  aluno_nome text,
  trilha_id uuid,
  trilha_nome text,
  modulo_nome text,
  turma_codigo text,
  tipo text,
  emitido_em timestamptz,
  codigo_verificacao text,
  status text,
  revogado_em timestamptz
)
language plpgsql
security definer
stable
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not identidade.usuario_e_coordenacao() then
    raise exception 'apenas a coordenação pode ver este relatório' using errcode = '42501';
  end if;

  return query
  select c.id,
         c.aluno_id,
         c.aluno_nome,
         c.trilha_id,
         c.trilha_nome,
         c.modulo_nome,
         c.turma_codigo,
         case when c.modulo_id is null then 'trilha' else 'modulo' end,
         c.emitido_em,
         c.hash_publico,
         case when c.revogado_em is null then 'valido' else 'revogado' end,
         c.revogado_em
  from certificacao.certificados c
  where (p_inicio is null or identidade.data_local(c.emitido_em) >= p_inicio)
    and (p_fim is null or identidade.data_local(c.emitido_em) <= p_fim)
    and (p_trilha_id is null or c.trilha_id = p_trilha_id)
    and (p_status is null or p_status = case when c.revogado_em is null then 'valido' else 'revogado' end)
  order by c.emitido_em desc, c.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Indicadores do dashboard: KPIs e séries num único jsonb, para a tela não
-- somar nada no navegador. Fica em selecao porque a matrícula é o centro de
-- quase tudo aqui; o resto vem pelas fontes dos outros contextos.
--
-- O período recorta de dois jeitos, conforme a natureza do número:
--   * estado (ativos, taxas, médias, ocupação, pendentes, gráficos por trilha,
--     notas, frequência): matrículas de turmas com dias dentro do intervalo;
--   * evento (matrículas por mês, certificados): data do próprio evento.
-- Taxas seguem as views do artigo: evasão como vw_taxa_evasao (cancelada ou
-- reprovada sobre as encerradas); conclusão é o complemento. taxa_aprovacao
-- por trilha como vw_desempenho_por_trilha (só concluída e reprovada).
create or replace function selecao.relatorio_indicadores(
  p_inicio date default null,
  p_fim date default null,
  p_trilha_id uuid default null
)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_resultado jsonb;
begin
  if not identidade.usuario_e_coordenacao() then
    raise exception 'apenas a coordenação pode ver este relatório' using errcode = '42501';
  end if;

  with
  turmas as (
    select t.turma_id, t.codigo, t.vagas_total, mo.trilha_id, mo.trilha_nome,
           t.periodo_inicio, t.periodo_fim
    from selecao.fonte_turmas() t
    join catalogo.fonte_modulos() mo on mo.modulo_id = t.modulo_id
    where p_trilha_id is null or mo.trilha_id = p_trilha_id
  ),
  turmas_periodo as (
    select t.* from turmas t
    where (p_inicio is null or t.periodo_fim >= p_inicio)
      and (p_fim is null or t.periodo_inicio <= p_fim)
  ),
  todas_matriculas as (
    select f.* , t.trilha_id
    from selecao.fonte_matriculas() f
    join turmas t on t.turma_id = f.turma_id
  ),
  mats as (
    select m.*, d.media, d.frequencia, tp.trilha_nome
    from todas_matriculas m
    join turmas_periodo tp on tp.turma_id = m.turma_id
    left join diario.fonte_desempenho() d on d.matricula_id = m.matricula_id
  ),
  ocupacao as (
    select tp.turma_id,
           (o.inscritas + o.matriculadas + o.concluidas + o.reprovadas) * 100.0 / tp.vagas_total as percentual
    from turmas_periodo tp
    join selecao.ocupacao_turmas(null) o on o.turma_id = tp.turma_id
  ),
  certificados as (
    select c.emitido_em
    from certificacao.fonte_certificados() c
    where c.revogado_em is null
      and (p_trilha_id is null or c.trilha_id = p_trilha_id)
      and (p_inicio is null or identidade.data_local(c.emitido_em) >= p_inicio)
      and (p_fim is null or identidade.data_local(c.emitido_em) <= p_fim)
  ),
  -- Quem passou de inscrito: rejeitada nunca foi matrícula, e inscrita ainda
  -- não é. Sem data de deferimento (carga antiga), vale a da inscrição.
  entradas as (
    select identidade.data_local(coalesce(m.deferido_em, m.criado_em)) as dia
    from todas_matriculas m
    where m.status not in ('inscrita', 'rejeitada')
  ),
  entradas_periodo as (
    select e.dia from entradas e
    where (p_inicio is null or e.dia >= p_inicio)
      and (p_fim is null or e.dia <= p_fim)
  )
  select jsonb_build_object(
    'kpis', (
      select jsonb_build_object(
        'alunos_ativos', count(distinct m.aluno_id) filter (where m.status = 'matriculada'),
        'matriculas_ativas', count(*) filter (where m.status = 'matriculada'),
        'inscricoes_pendentes', count(*) filter (where m.status = 'inscrita'),
        'taxa_conclusao', round(
          100.0 * count(*) filter (where m.status = 'concluida')
            / nullif(count(*) filter (where m.status in ('concluida', 'reprovada', 'cancelada')), 0), 1),
        'taxa_evasao', round(
          100.0 * count(*) filter (where m.status in ('cancelada', 'reprovada'))
            / nullif(count(*) filter (where m.status in ('concluida', 'reprovada', 'cancelada')), 0), 1),
        'frequencia_media', round(avg(m.frequencia), 1),
        'nota_media', round(avg(m.media), 2),
        'certificados_periodo', (select count(*) from certificados),
        'ocupacao_media', (select round(avg(o.percentual), 1) from ocupacao o)
      )
      from mats m
    ),
    'matriculas_por_mes', coalesce((
      select jsonb_agg(jsonb_build_object('mes', s.mes, 'total', s.total) order by s.mes)
      from (
        select to_char(e.dia, 'YYYY-MM') as mes, count(*) as total
        from entradas_periodo e group by 1
      ) s
    ), '[]'::jsonb),
    'alunos_por_trilha', coalesce((
      select jsonb_agg(jsonb_build_object('trilha_id', s.trilha_id, 'trilha_nome', s.trilha_nome, 'alunos', s.alunos)
                       order by s.alunos desc, s.trilha_nome)
      from (
        select m.trilha_id, m.trilha_nome, count(distinct m.aluno_id) as alunos
        from mats m
        where m.status in ('matriculada', 'concluida', 'reprovada')
        group by m.trilha_id, m.trilha_nome
      ) s
    ), '[]'::jsonb),
    'desempenho_por_trilha', coalesce((
      select jsonb_agg(jsonb_build_object(
               'trilha_id', s.trilha_id, 'trilha_nome', s.trilha_nome,
               'concluidas', s.concluidas, 'reprovadas', s.reprovadas, 'canceladas', s.canceladas,
               'taxa_aprovacao', round(100.0 * s.concluidas / nullif(s.concluidas + s.reprovadas, 0), 1),
               'taxa_evasao', round(100.0 * (s.canceladas + s.reprovadas)
                                    / nullif(s.concluidas + s.reprovadas + s.canceladas, 0), 1)
             ) order by s.trilha_nome)
      from (
        select m.trilha_id, m.trilha_nome,
               count(*) filter (where m.status = 'concluida') as concluidas,
               count(*) filter (where m.status = 'reprovada') as reprovadas,
               count(*) filter (where m.status = 'cancelada') as canceladas
        from mats m
        group by m.trilha_id, m.trilha_nome
      ) s
    ), '[]'::jsonb),
    -- Dez faixas sempre presentes (0–1 … 9–10): histograma sem buracos. Média
    -- exatamente 10 entra na última faixa.
    'distribuicao_notas', (
      select jsonb_agg(jsonb_build_object('faixa_inicio', f.i, 'faixa_fim', f.i + 1, 'total', coalesce(s.total, 0)) order by f.i)
      from generate_series(0, 9) f(i)
      left join (
        select least(floor(m.media)::integer, 9) as i, count(*) as total
        from mats m
        where m.media is not null
        group by 1
      ) s on s.i = f.i
    ),
    'frequencia_por_turma', coalesce((
      select jsonb_agg(jsonb_build_object(
               'turma_id', s.turma_id, 'turma_codigo', s.codigo,
               'trilha_nome', s.trilha_nome, 'frequencia', s.frequencia
             ) order by s.frequencia, s.codigo)
      from (
        select tp.turma_id, tp.codigo, tp.trilha_nome, round(avg(m.frequencia), 1) as frequencia
        from turmas_periodo tp
        join mats m on m.turma_id = tp.turma_id
        where m.frequencia is not null
        group by tp.turma_id, tp.codigo, tp.trilha_nome
      ) s
    ), '[]'::jsonb),
    'certificados_por_mes', coalesce((
      select jsonb_agg(jsonb_build_object('mes', s.mes, 'total', s.total) order by s.mes)
      from (
        select to_char(identidade.data_local(c.emitido_em), 'YYYY-MM') as mes, count(*) as total
        from certificados c group by 1
      ) s
    ), '[]'::jsonb)
  )
  into v_resultado;

  return v_resultado;
end;
$$;

revoke execute on function identidade.relatorio_alunos(date, date, uuid, text) from public, anon;
revoke execute on function identidade.relatorio_docentes(date, date, uuid, text) from public, anon;
revoke execute on function catalogo.relatorio_trilhas(date, date, uuid, text) from public, anon;
revoke execute on function selecao.relatorio_turmas(date, date, uuid, text) from public, anon;
revoke execute on function selecao.relatorio_matriculas(date, date, uuid, text) from public, anon;
revoke execute on function diario.relatorio_notas_frequencia(date, date, uuid, text) from public, anon;
revoke execute on function certificacao.relatorio_certificados(date, date, uuid, text) from public, anon;
revoke execute on function selecao.relatorio_indicadores(date, date, uuid) from public, anon;

grant execute on function identidade.relatorio_alunos(date, date, uuid, text) to authenticated;
grant execute on function identidade.relatorio_docentes(date, date, uuid, text) to authenticated;
grant execute on function catalogo.relatorio_trilhas(date, date, uuid, text) to authenticated;
grant execute on function selecao.relatorio_turmas(date, date, uuid, text) to authenticated;
grant execute on function selecao.relatorio_matriculas(date, date, uuid, text) to authenticated;
grant execute on function diario.relatorio_notas_frequencia(date, date, uuid, text) to authenticated;
grant execute on function certificacao.relatorio_certificados(date, date, uuid, text) to authenticated;
grant execute on function selecao.relatorio_indicadores(date, date, uuid) to authenticated;
