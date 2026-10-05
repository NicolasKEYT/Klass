import { supabase } from "@/lib/supabase";
import { mensagemDeErroBanco } from "@/lib/mensagensDeErroBanco";
import { plural } from "@/lib/plural";
import { situacaoDaTurma, type TurmaListagem } from "@/lib/selecao";

// D7 (klass-uikit.pdf) — dados do painel "Início" da coordenação. Mistura
// catalogo (as duas views novas), selecao e diario de propósito: é uma
// tela agregadora, não pertence a um único bounded context — cada
// consulta aqui é leitura simples sobre tabelas/views que já existem.

function selecao() {
  if (!supabase) throw new Error("Supabase não configurado.");
  return supabase.schema("selecao");
}
function diario() {
  if (!supabase) throw new Error("Supabase não configurado.");
  return supabase.schema("diario");
}
function catalogo() {
  if (!supabase) throw new Error("Supabase não configurado.");
  return supabase.schema("catalogo");
}
function identidade() {
  if (!supabase) throw new Error("Supabase não configurado.");
  return supabase.schema("identidade");
}

function hojeISO(): string {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;
}

// Mesma regra de diario.frequencia_percentual (aula sem NENHUMA presença
// registrada não conta no denominador), só que calculada em lote no
// cliente para não fazer uma chamada RPC por matrícula do sistema
// inteiro. Devolve a frequência média geral, quantos alunos estão abaixo
// do mínimo legal (75%, LDB art. 24) e a frequência média POR TURMA (usada
// na tabela "Turmas em andamento"). Uma consulta só alimenta os
// indicadores e a tabela — antes o painel calculava tudo duas vezes.
// Ainda traz todas as presenças das turmas ativas para o navegador: uma
// função agregada no banco resolveria isto com uma linha por turma.
export interface FrequenciasCoordenacao {
  mediaGeral: number | null;
  abaixoDoMinimo: number;
  /** turma_id -> frequência média. Record (não Map) para caber no cache. */
  porTurma: Record<string, number>;
}

export async function calcularFrequencias(): Promise<FrequenciasCoordenacao> {
  const { data: matriculas, error } = await selecao()
    .from("matriculas")
    .select("id, turma_id")
    .eq("status", "matriculada");
  if (error) throw new Error(mensagemDeErroBanco(error));
  if (!matriculas || matriculas.length === 0) {
    return { mediaGeral: null, abaixoDoMinimo: 0, porTurma: {} };
  }

  const turmaIds = [...new Set(matriculas.map((m) => m.turma_id))];
  const { data: aulas, error: erroAulas } = await diario()
    .from("aulas")
    .select("id, turma_id")
    .in("turma_id", turmaIds);
  if (erroAulas) throw new Error(mensagemDeErroBanco(erroAulas));

  const aulaIds = (aulas ?? []).map((a) => a.id);
  const { data: presencas, error: erroPresencas } =
    aulaIds.length > 0
      ? await diario().from("presencas").select("aula_id, matricula_id, presente").in("aula_id", aulaIds)
      : { data: [] as Array<{ aula_id: string; matricula_id: string; presente: boolean }>, error: null };
  if (erroPresencas) throw new Error(mensagemDeErroBanco(erroPresencas));

  const aulasComAlgumaPresenca = new Set((presencas ?? []).map((p) => p.aula_id));
  const aulaIdsPorTurma = new Map<string, string[]>();
  for (const a of aulas ?? []) {
    const lista = aulaIdsPorTurma.get(a.turma_id) ?? [];
    lista.push(a.id);
    aulaIdsPorTurma.set(a.turma_id, lista);
  }
  const presencaPorMatricula = new Map<string, Map<string, boolean>>();
  for (const p of presencas ?? []) {
    const mapa = presencaPorMatricula.get(p.matricula_id) ?? new Map();
    mapa.set(p.aula_id, p.presente);
    presencaPorMatricula.set(p.matricula_id, mapa);
  }

  let somaGeral = 0;
  let contGeral = 0;
  let abaixoDoMinimo = 0;
  const somaPorTurma = new Map<string, { soma: number; cont: number }>();

  for (const m of matriculas) {
    const aulasDaTurmaComChamada = (aulaIdsPorTurma.get(m.turma_id) ?? []).filter((id) =>
      aulasComAlgumaPresenca.has(id),
    );
    if (aulasDaTurmaComChamada.length === 0) continue;
    const presencaAluno = presencaPorMatricula.get(m.id) ?? new Map();
    const presentes = aulasDaTurmaComChamada.filter((id) => presencaAluno.get(id) === true).length;
    const freq = (presentes / aulasDaTurmaComChamada.length) * 100;

    somaGeral += freq;
    contGeral++;
    if (freq < 75) abaixoDoMinimo++;

    const acumuladoTurma = somaPorTurma.get(m.turma_id) ?? { soma: 0, cont: 0 };
    acumuladoTurma.soma += freq;
    acumuladoTurma.cont++;
    somaPorTurma.set(m.turma_id, acumuladoTurma);
  }

  const porTurma: Record<string, number> = {};
  for (const [turmaId, { soma, cont }] of somaPorTurma) {
    porTurma[turmaId] = soma / cont;
  }

  return { mediaGeral: contGeral > 0 ? somaGeral / contGeral : null, abaixoDoMinimo, porTurma };
}

export interface IndicadoresCoordenacao {
  /** Aprovados e encerrados que formam a taxa de aprovação (legenda do card). */
  totalAprovados: number;
  totalEncerrados: number;
  frequenciaMedia: number | null;
  alunosAbaixoDoMinimo: number;
  aprovacaoModulosEncerrados: number | null;
  evasaoSemestreAtual: number | null;
  periodoEvasao: string | null;
}

export interface IndicadoresDasViews {
  totalAprovados: number;
  totalEncerrados: number;
  evasaoSemestreAtual: number | null;
  periodoEvasao: string | null;
}

// Só as duas views do artigo (vw_desempenho_por_trilha, vw_taxa_evasao);
// a frequência vem de calcularFrequencias e as duas se juntam em
// montarIndicadores.
export async function buscarIndicadoresDasViews(): Promise<IndicadoresDasViews> {
  const [desempenhoResp, evasaoResp] = await Promise.all([
    catalogo()
      .from("vw_desempenho_por_trilha")
      .select("total_aprovados, total_encerrados"),
    catalogo()
      .from("vw_taxa_evasao")
      .select("periodo, taxa_evasao_percentual")
      .order("periodo", { ascending: false })
      .limit(1),
  ]);
  if (desempenhoResp.error) throw new Error(mensagemDeErroBanco(desempenhoResp.error));
  if (evasaoResp.error) throw new Error(mensagemDeErroBanco(evasaoResp.error));

  // Agregado ponderado (soma dos aprovados / soma dos encerrados), não
  // média das porcentagens por trilha — evita distorcer o número quando
  // uma trilha tem poucos módulos encerrados e outra tem muitos.
  const totalAprovados = (desempenhoResp.data ?? []).reduce((s, r) => s + (r.total_aprovados ?? 0), 0);
  const totalEncerrados = (desempenhoResp.data ?? []).reduce((s, r) => s + (r.total_encerrados ?? 0), 0);

  const linhaEvasao = evasaoResp.data?.[0];

  return {
    totalAprovados,
    totalEncerrados,
    evasaoSemestreAtual: linhaEvasao ? Number(linhaEvasao.taxa_evasao_percentual) : null,
    periodoEvasao: linhaEvasao?.periodo ?? null,
  };
}

export function montarIndicadores(
  frequencias: FrequenciasCoordenacao,
  views: IndicadoresDasViews,
): IndicadoresCoordenacao {
  return {
    totalAprovados: views.totalAprovados,
    totalEncerrados: views.totalEncerrados,
    frequenciaMedia: frequencias.mediaGeral,
    alunosAbaixoDoMinimo: frequencias.abaixoDoMinimo,
    aprovacaoModulosEncerrados:
      views.totalEncerrados > 0 ? (views.totalAprovados / views.totalEncerrados) * 100 : null,
    evasaoSemestreAtual: views.evasaoSemestreAtual,
    periodoEvasao: views.periodoEvasao,
  };
}

export type TipoPendenciaCoordenacao = "inscricoes" | "chamadas_atrasadas" | "turmas_terminando";

export interface PendenciaCoordenacao {
  tipo: TipoPendenciaCoordenacao;
  quantidade: number;
  detalhe: string;
  /** Turmas envolvidas — com uma só, "Revisar" leva direto ao detalhe dela. */
  turmaIds: string[];
}

export async function listarPendenciasCoordenacao(): Promise<PendenciaCoordenacao[]> {
  const pendencias: PendenciaCoordenacao[] = [];
  const hoje = hojeISO();

  // As quatro leituras são independentes: saem juntas. Só as presenças
  // dependem das aulas passadas e ficam para depois.
  const [inscricoesResp, turmasResp, aulasResp, matriculasAtivasResp] = await Promise.all([
    selecao()
      .from("matriculas")
      .select("criado_em, turma_id")
      .eq("status", "inscrita")
      .order("criado_em", { ascending: true }),
    selecao().from("turmas").select("id, codigo, periodo_fim"),
    diario().from("aulas").select("id, turma_id, data").lt("data", hoje),
    selecao().from("matriculas").select("turma_id").eq("status", "matriculada"),
  ]);
  if (inscricoesResp.error) throw new Error(mensagemDeErroBanco(inscricoesResp.error));
  if (turmasResp.error) throw new Error(mensagemDeErroBanco(turmasResp.error));
  if (aulasResp.error) throw new Error(mensagemDeErroBanco(aulasResp.error));
  if (matriculasAtivasResp.error) throw new Error(mensagemDeErroBanco(matriculasAtivasResp.error));

  const inscricoes = inscricoesResp.data;
  if (inscricoes && inscricoes.length > 0) {
    const diasEspera = Math.round(
      (Date.now() - new Date(inscricoes[0].criado_em).getTime()) / 86_400_000,
    );
    pendencias.push({
      tipo: "inscricoes",
      quantidade: inscricoes.length,
      detalhe:
        diasEspera === 0 ? "A mais antiga chegou hoje" : `A mais antiga espera há ${plural(diasEspera, "dia", "dias")}`,
      turmaIds: [...new Set(inscricoes.map((i) => i.turma_id))],
    });
  }

  const turmas = turmasResp.data;
  const turmaPorId = new Map((turmas ?? []).map((t) => [t.id, t]));

  const aulasPassadas = aulasResp.data;
  const aulaIds = (aulasPassadas ?? []).map((a) => a.id);
  const { data: presencas, error: erroPresencas } =
    aulaIds.length > 0
      ? await diario().from("presencas").select("aula_id").in("aula_id", aulaIds)
      : { data: [] as Array<{ aula_id: string }>, error: null };
  if (erroPresencas) throw new Error(mensagemDeErroBanco(erroPresencas));
  const aulasComChamada = new Set((presencas ?? []).map((p) => p.aula_id));
  const atrasadas = (aulasPassadas ?? []).filter((a) => !aulasComChamada.has(a.id));
  if (atrasadas.length > 0) {
    const exemplos = atrasadas
      .slice(0, 2)
      .map((a) => `${turmaPorId.get(a.turma_id)?.codigo ?? "—"} (${a.data.split("-").reverse().join("/")})`)
      .join(", ");
    pendencias.push({
      tipo: "chamadas_atrasadas",
      quantidade: atrasadas.length,
      detalhe: exemplos,
      turmaIds: [...new Set(atrasadas.map((a) => a.turma_id))],
    });
  }

  const turmasComAtivos = new Set((matriculasAtivasResp.data ?? []).map((m) => m.turma_id));
  const terminando = (turmas ?? []).filter((t) => {
    const dias = Math.round(
      (new Date(`${t.periodo_fim}T00:00:00`).getTime() - new Date(`${hoje}T00:00:00`).getTime()) /
        86_400_000,
    );
    return dias >= 0 && dias <= 7 && turmasComAtivos.has(t.id);
  });
  if (terminando.length > 0) {
    pendencias.push({
      tipo: "turmas_terminando",
      quantidade: terminando.length,
      detalhe: terminando.map((t) => t.codigo).join(", "),
      turmaIds: terminando.map((t) => t.id),
    });
  }

  return pendencias;
}

export interface TurmaEmAndamento extends TurmaListagem {
  frequenciaMedia: number | null;
  situacao: string;
}

// Pura: a lista de turmas é a mesma da tela "Turmas" (cache compartilhado)
// e a frequência por turma vem de calcularFrequencias. Turmas encerradas
// (situacaoDaTurma) ficam fora — a tabela é de turmas em andamento.
export function montarTurmasEmAndamento(
  turmas: TurmaListagem[],
  porTurma: Record<string, number>,
): TurmaEmAndamento[] {
  const hoje = hojeISO();

  return turmas.flatMap((t) => {
    const s = situacaoDaTurma(t, hoje);
    if (s === "encerrada") return [];
    let situacao: string;
    if (s === "futura") situacao = `Começa ${t.periodoInicio.split("-").reverse().join("/")}`;
    else if (s === "aguardando_encerramento") situacao = "Aguardando encerramento";
    else if (t.pendentes > 0) situacao = "Inscrições abertas";
    else situacao = "Em andamento";
    return [{ ...t, frequenciaMedia: porTurma[t.id] ?? null, situacao }];
  });
}

// Busca global simples (aluno, turma ou trilha) — filtro por substring,
// sem índice de busca dedicado (não é necessário nesta escala).
export interface ResultadoBuscaAluno {
  id: string;
  nomeCompleto: string;
}

export async function buscarAlunosPorNome(termo: string): Promise<ResultadoBuscaAluno[]> {
  if (termo.trim().length < 2) return [];
  const { data, error } = await identidade()
    .from("profiles")
    .select("id, nome_completo")
    .eq("papel", "aluno")
    .ilike("nome_completo", `%${termo}%`)
    .limit(10);
  if (error) throw new Error(mensagemDeErroBanco(error));
  return (data ?? []).map((p) => ({ id: p.id, nomeCompleto: p.nome_completo }));
}
