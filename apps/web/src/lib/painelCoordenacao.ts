import { supabase } from "@/lib/supabase";
import { mensagemDeErroBanco } from "@/lib/mensagensDeErroBanco";
import { plural } from "@/lib/plural";
import { formatarData, formatarDiaMes, paraDataLocal } from "@/lib/formato";
import { buscarOcupacaoTurmas, situacaoDaTurma, type TurmaListagem } from "@/lib/selecao";

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

// Frequências e aulas por turma calculadas no banco
// (diario.indicadores_por_turma, só coordenação): uma linha por turma, em
// vez de trazer todas as matrículas, aulas e presenças para o navegador
// (que agregava aqui e truncava em 1000 linhas). Mesma regra de
// diario.frequencia_percentual (aula sem nenhuma presença não conta).
// Devolve a frequência média geral (ponderada pelos alunos de cada turma
// = média de todos os alunos), quantos estão abaixo do mínimo legal (75%,
// LDB art. 24), a média POR TURMA (tabela "Turmas em andamento" e gráfico
// de Acompanhamento) e o total de aulas por turma (pendência "sem aulas").
export interface FrequenciasCoordenacao {
  mediaGeral: number | null;
  abaixoDoMinimo: number;
  /** turma_id -> frequência média. Record (não Map) para caber no cache. */
  porTurma: Record<string, number>;
  /** turma_id -> aulas cadastradas. */
  aulasPorTurma: Record<string, number>;
}

export async function calcularFrequencias(): Promise<FrequenciasCoordenacao> {
  const { data, error } = await diario().rpc("indicadores_por_turma");
  if (error) throw new Error(mensagemDeErroBanco(error));

  let somaGeral = 0;
  let contGeral = 0;
  let abaixoDoMinimo = 0;
  const porTurma: Record<string, number> = {};
  const aulasPorTurma: Record<string, number> = {};
  for (const linha of data ?? []) {
    aulasPorTurma[linha.turma_id] = linha.total_aulas;
    if (linha.alunos_com_frequencia > 0 && linha.frequencia_media !== null) {
      const media = Number(linha.frequencia_media);
      porTurma[linha.turma_id] = media;
      somaGeral += media * linha.alunos_com_frequencia;
      contGeral += linha.alunos_com_frequencia;
      abaixoDoMinimo += linha.alunos_abaixo_minimo_legal;
    }
  }

  return {
    mediaGeral: contGeral > 0 ? somaGeral / contGeral : null,
    abaixoDoMinimo,
    porTurma,
    aulasPorTurma,
  };
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

// As duas views do artigo, linha a linha: alimentam os indicadores do
// Início (agregados em resumirViews) e os gráficos de Acompanhamento (por
// trilha e por semestre) — uma leitura só para os dois.
export interface LinhaDesempenhoTrilha {
  trilhaId: string;
  trilhaNome: string;
  totalAprovados: number;
  totalEncerrados: number;
  /** null = trilha sem matrícula encerrada ainda. */
  taxaAprovacao: number | null;
}

export interface LinhaEvasaoSemestre {
  /** "2026/1" */
  periodo: string;
  totalEvadidos: number;
  totalEncerrados: number;
  taxaEvasao: number | null;
}

export interface LinhasDasViews {
  desempenho: LinhaDesempenhoTrilha[];
  evasao: LinhaEvasaoSemestre[];
}

export async function buscarLinhasDasViews(): Promise<LinhasDasViews> {
  const [desempenhoResp, evasaoResp] = await Promise.all([
    catalogo()
      .from("vw_desempenho_por_trilha")
      .select("trilha_id, trilha_nome, total_aprovados, total_encerrados, taxa_aprovacao_percentual"),
    catalogo()
      .from("vw_taxa_evasao")
      .select("periodo, total_evadidos, total_encerrados, taxa_evasao_percentual")
      .order("periodo", { ascending: false }),
  ]);
  if (desempenhoResp.error) throw new Error(mensagemDeErroBanco(desempenhoResp.error));
  if (evasaoResp.error) throw new Error(mensagemDeErroBanco(evasaoResp.error));

  // As views devolvem numeric como texto/number conforme o driver; Number()
  // normaliza. Linha sem trilha/período (não deveria existir) é descartada.
  return {
    desempenho: (desempenhoResp.data ?? []).flatMap((r) =>
      r.trilha_id && r.trilha_nome
        ? [
            {
              trilhaId: r.trilha_id,
              trilhaNome: r.trilha_nome,
              totalAprovados: Number(r.total_aprovados ?? 0),
              totalEncerrados: Number(r.total_encerrados ?? 0),
              taxaAprovacao: r.taxa_aprovacao_percentual === null ? null : Number(r.taxa_aprovacao_percentual),
            },
          ]
        : [],
    ),
    evasao: (evasaoResp.data ?? []).flatMap((r) =>
      r.periodo
        ? [
            {
              periodo: r.periodo,
              totalEvadidos: Number(r.total_evadidos ?? 0),
              totalEncerrados: Number(r.total_encerrados ?? 0),
              taxaEvasao: r.taxa_evasao_percentual === null ? null : Number(r.taxa_evasao_percentual),
            },
          ]
        : [],
    ),
  };
}

export function resumirViews(linhas: LinhasDasViews): IndicadoresDasViews {
  // Agregado ponderado (soma dos aprovados / soma dos encerrados), não
  // média das porcentagens por trilha — evita distorcer o número quando
  // uma trilha tem poucos módulos encerrados e outra tem muitos.
  const totalAprovados = linhas.desempenho.reduce((s, r) => s + r.totalAprovados, 0);
  const totalEncerrados = linhas.desempenho.reduce((s, r) => s + r.totalEncerrados, 0);
  // A view já vem do semestre mais recente para o mais antigo.
  const linhaEvasao = linhas.evasao[0];

  return {
    totalAprovados,
    totalEncerrados,
    evasaoSemestreAtual: linhaEvasao?.taxaEvasao ?? null,
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

export type TipoPendenciaCoordenacao =
  | "inscricoes"
  | "chamadas_atrasadas"
  | "turmas_aguardando_encerramento"
  | "turmas_sem_aulas"
  | "turmas_terminando";

export interface PendenciaCoordenacao {
  tipo: TipoPendenciaCoordenacao;
  quantidade: number;
  detalhe: string;
  /** Turmas envolvidas — com uma só, "Revisar" leva direto ao detalhe dela. */
  turmaIds: string[];
}

// Aula que já passou sem nenhuma presença registrada, vinda pronta do
// banco (diario.chamadas_pendentes), com a situação do prazo: "encerrada"
// = o professor já não consegue fazê-la sem a coordenação liberar. Lida
// uma vez e compartilhada (cache) entre "Precisa de você" e "Esta semana".
export interface ChamadaAtrasada {
  aulaId: string;
  turmaId: string;
  data: string;
  foraDoPrazo: boolean;
}

export async function buscarChamadasAtrasadas(): Promise<ChamadaAtrasada[]> {
  const { data, error } = await diario().rpc("chamadas_pendentes");
  if (error) throw new Error(mensagemDeErroBanco(error));
  return (data ?? []).map((a) => ({
    aulaId: a.aula_id,
    turmaId: a.turma_id,
    data: a.data,
    foraDoPrazo: a.situacao === "encerrada",
  }));
}

export async function listarPendenciasCoordenacao(
  /** Quem já tem as chamadas atrasadas em cache passa um leitor. */
  obterAtrasadas: () => Promise<ChamadaAtrasada[]> = buscarChamadasAtrasadas,
  /** Idem para os indicadores por turma (aulas cadastradas). */
  obterFrequencias: () => Promise<FrequenciasCoordenacao> = calcularFrequencias,
): Promise<PendenciaCoordenacao[]> {
  const pendencias: PendenciaCoordenacao[] = [];
  const hoje = hojeISO();

  // As leituras são independentes: saem juntas.
  // Contagens vêm agregadas do banco (ocupação por turma, aulas por turma),
  // não linha a linha.
  const [inscricoesResp, turmasResp, atrasadas, ocupacao, frequencias] = await Promise.all([
    selecao()
      .from("matriculas")
      .select("criado_em, turma_id")
      .eq("status", "inscrita")
      .order("criado_em", { ascending: true }),
    selecao().from("turmas").select("id, codigo, periodo_inicio, periodo_fim"),
    obterAtrasadas(),
    buscarOcupacaoTurmas(null),
    obterFrequencias(),
  ]);
  if (inscricoesResp.error) throw new Error(mensagemDeErroBanco(inscricoesResp.error));
  if (turmasResp.error) throw new Error(mensagemDeErroBanco(turmasResp.error));

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

  if (atrasadas.length > 0) {
    const exemplos = atrasadas
      .slice(0, 2)
      .map((a) => `${turmaPorId.get(a.turmaId)?.codigo ?? "—"} (${formatarData(a.data)})`)
      .join(", ");
    // Fora do prazo de 7 dias: só a coordenação libera (aba Aulas da turma).
    const foraDoPrazo = atrasadas.filter((a) => a.foraDoPrazo).length;
    pendencias.push({
      tipo: "chamadas_atrasadas",
      quantidade: atrasadas.length,
      detalhe: foraDoPrazo > 0 ? `${exemplos} · ${foraDoPrazo} fora do prazo (liberar na turma)` : exemplos,
      turmaIds: [...new Set(atrasadas.map((a) => a.turmaId))],
    });
  }

  const turmasComAtivos = new Set(
    [...ocupacao].filter(([, o]) => o.matriculadas > 0).map(([turmaId]) => turmaId),
  );
  const terminando = (turmas ?? []).filter((t) => {
    const dias = Math.round(
      (new Date(`${t.periodo_fim}T00:00:00`).getTime() - new Date(`${hoje}T00:00:00`).getTime()) /
        86_400_000,
    );
    return dias >= 0 && dias <= 7 && turmasComAtivos.has(t.id);
  });
  // Período acabou e ainda há aluno cursando: falta encerrar a turma.
  const aguardando = (turmas ?? []).filter((t) => t.periodo_fim < hoje && turmasComAtivos.has(t.id));
  if (aguardando.length > 0) {
    pendencias.push({
      tipo: "turmas_aguardando_encerramento",
      quantidade: aguardando.length,
      detalhe: aguardando.map((t) => t.codigo).join(", "),
      turmaIds: aguardando.map((t) => t.id),
    });
  }

  // Turma ainda não terminada sem nenhuma aula: sem aula não há chamada,
  // e a turma não chega a "pronta para encerrar".
  const semAulas = (turmas ?? []).filter(
    (t) => t.periodo_fim >= hoje && (frequencias.aulasPorTurma[t.id] ?? 0) === 0,
  );
  if (semAulas.length > 0) {
    pendencias.push({
      tipo: "turmas_sem_aulas",
      quantidade: semAulas.length,
      detalhe: semAulas
        .map((t) => `${t.codigo} · começa em ${formatarDiaMes(t.periodo_inicio)}`)
        .slice(0, 2)
        .join(", "),
      turmaIds: semAulas.map((t) => t.id),
    });
  }

  if (terminando.length > 0) {
    pendencias.push({
      tipo: "turmas_terminando",
      quantidade: terminando.length,
      detalhe: terminando.map((t) => t.codigo).join(", "),
      turmaIds: terminando.map((t) => t.id),
    });
  }

  // pág. 10 — "Precisa de você" tem no máximo 4 cartões; a ordem acima já
  // é a de prioridade.
  return pendencias.slice(0, 4);
}

/** "Semestre 2026/2" — 1º semestre de janeiro a junho, 2º de julho a dezembro. */
export function semestreAtual(data = new Date()): string {
  return `${data.getFullYear()}/${data.getMonth() < 6 ? 1 : 2}`;
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
    if (s === "futura") situacao = `Começa ${formatarData(t.periodoInicio)}`;
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

// ---------------------------------------------------------------------
// "Esta semana" do Início da coordenação: o que chegou nos últimos 7 dias
// e o que acontece nos próximos 7. Turmas e chamadas atrasadas vêm do
// cache (as mesmas leituras da tabela e de "Precisa de você"); só as
// inscrições recentes são uma leitura nova.
// ---------------------------------------------------------------------

/** Data local N dias a partir de hoje (negativo = passado), em AAAA-MM-DD. */
export function diaRelativoISO(dias: number, base = new Date()): string {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export interface InscricaoRecente {
  turmaId: string;
  status: string;
  criadoEm: string;
}

/** Matrículas criadas nos últimos 7 dias (hoje incluído), em qualquer situação. */
export async function listarInscricoesRecentes(): Promise<InscricaoRecente[]> {
  const desde = paraDataLocal(diaRelativoISO(-6)).toISOString();
  const { data, error } = await selecao()
    .from("matriculas")
    .select("turma_id, status, criado_em")
    .gte("criado_em", desde)
    .order("criado_em", { ascending: false });
  if (error) throw new Error(mensagemDeErroBanco(error));
  return (data ?? []).map((m) => ({ turmaId: m.turma_id, status: m.status, criadoEm: m.criado_em }));
}

export interface EventoDeTurmaNaSemana {
  turmaId: string;
  codigo: string;
  moduloNome: string;
  tipo: "comeca" | "termina";
  data: string;
}

export interface AtrasoPorTurma {
  turmaId: string;
  codigo: string;
  quantidade: number;
  maisAntiga: string;
}

export interface SemanaCoordenacao {
  inscricoesRecebidas: number;
  inscricoesEmAnalise: number;
  /** Turmas com inscrição nova (link direto quando é uma só). */
  turmasComInscricao: string[];
  eventosDeTurma: EventoDeTurmaNaSemana[];
  atrasosPorTurma: AtrasoPorTurma[];
}

// Pura: junta o que já está em cache. "Próximos 7 dias" = hoje até daqui
// a 7 dias, inclusive.
export function montarSemanaCoordenacao(
  turmas: TurmaListagem[],
  atrasadas: ChamadaAtrasada[],
  inscricoes: InscricaoRecente[],
  hoje = hojeISO(),
): SemanaCoordenacao {
  const limite = diaRelativoISO(7, paraDataLocal(hoje));
  const naJanela = (data: string) => data >= hoje && data <= limite;

  const eventosDeTurma: EventoDeTurmaNaSemana[] = turmas
    .flatMap((t) => {
      const eventos: EventoDeTurmaNaSemana[] = [];
      if (naJanela(t.periodoInicio))
        eventos.push({ turmaId: t.id, codigo: t.codigo, moduloNome: t.moduloNome, tipo: "comeca", data: t.periodoInicio });
      // Turma já sem ninguém (encerrada) não "termina" mais nada.
      if (naJanela(t.periodoFim) && situacaoDaTurma(t, hoje) !== "encerrada")
        eventos.push({ turmaId: t.id, codigo: t.codigo, moduloNome: t.moduloNome, tipo: "termina", data: t.periodoFim });
      return eventos;
    })
    .sort((a, b) => (a.data === b.data ? a.codigo.localeCompare(b.codigo) : a.data < b.data ? -1 : 1));

  const codigoPorTurma = new Map(turmas.map((t) => [t.id, t.codigo]));
  const porTurma = new Map<string, AtrasoPorTurma>();
  for (const a of atrasadas) {
    const atual = porTurma.get(a.turmaId);
    if (atual) {
      atual.quantidade++;
      if (a.data < atual.maisAntiga) atual.maisAntiga = a.data;
    } else {
      porTurma.set(a.turmaId, {
        turmaId: a.turmaId,
        codigo: codigoPorTurma.get(a.turmaId) ?? "—",
        quantidade: 1,
        maisAntiga: a.data,
      });
    }
  }

  return {
    inscricoesRecebidas: inscricoes.length,
    inscricoesEmAnalise: inscricoes.filter((i) => i.status === "inscrita").length,
    turmasComInscricao: [...new Set(inscricoes.map((i) => i.turmaId))],
    eventosDeTurma,
    atrasosPorTurma: [...porTurma.values()].sort((a, b) => b.quantidade - a.quantidade || a.codigo.localeCompare(b.codigo)),
  };
}
