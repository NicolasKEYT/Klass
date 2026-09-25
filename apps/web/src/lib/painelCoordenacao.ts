import { supabase } from "@/lib/supabase";
import { mensagemDeErroBanco } from "@/lib/mensagensDeErroBanco";
import { listarTurmasParaCoordenacao, type TurmaListagem } from "@/lib/selecao";

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
// na tabela "Turmas em andamento").
async function calcularFrequencias(): Promise<{
  mediaGeral: number | null;
  abaixoDoMinimo: number;
  porTurma: Map<string, number>;
}> {
  const { data: matriculas, error } = await selecao()
    .from("matriculas")
    .select("id, turma_id")
    .eq("status", "matriculada");
  if (error) throw new Error(mensagemDeErroBanco(error));
  if (!matriculas || matriculas.length === 0) {
    return { mediaGeral: null, abaixoDoMinimo: 0, porTurma: new Map() };
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

  const porTurma = new Map<string, number>();
  for (const [turmaId, { soma, cont }] of somaPorTurma) {
    porTurma.set(turmaId, soma / cont);
  }

  return { mediaGeral: contGeral > 0 ? somaGeral / contGeral : null, abaixoDoMinimo, porTurma };
}

export interface IndicadoresCoordenacao {
  frequenciaMedia: number | null;
  alunosAbaixoDoMinimo: number;
  aprovacaoModulosEncerrados: number | null;
  evasaoSemestreAtual: number | null;
  periodoEvasao: string | null;
}

export async function buscarIndicadoresCoordenacao(): Promise<IndicadoresCoordenacao> {
  const [{ mediaGeral, abaixoDoMinimo }, desempenhoResp, evasaoResp] = await Promise.all([
    calcularFrequencias(),
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
    frequenciaMedia: mediaGeral,
    alunosAbaixoDoMinimo: abaixoDoMinimo,
    aprovacaoModulosEncerrados: totalEncerrados > 0 ? (totalAprovados / totalEncerrados) * 100 : null,
    evasaoSemestreAtual: linhaEvasao ? Number(linhaEvasao.taxa_evasao_percentual) : null,
    periodoEvasao: linhaEvasao?.periodo ?? null,
  };
}

export type TipoPendenciaCoordenacao = "inscricoes" | "chamadas_atrasadas" | "turmas_terminando";

export interface PendenciaCoordenacao {
  tipo: TipoPendenciaCoordenacao;
  quantidade: number;
  detalhe: string;
}

export async function listarPendenciasCoordenacao(): Promise<PendenciaCoordenacao[]> {
  const pendencias: PendenciaCoordenacao[] = [];
  const hoje = hojeISO();

  const { data: inscricoes, error: erroInscricoes } = await selecao()
    .from("matriculas")
    .select("criado_em")
    .eq("status", "inscrita")
    .order("criado_em", { ascending: true });
  if (erroInscricoes) throw new Error(mensagemDeErroBanco(erroInscricoes));
  if (inscricoes && inscricoes.length > 0) {
    const diasEspera = Math.round(
      (Date.now() - new Date(inscricoes[0].criado_em).getTime()) / 86_400_000,
    );
    pendencias.push({
      tipo: "inscricoes",
      quantidade: inscricoes.length,
      detalhe: `A mais antiga espera há ${diasEspera} dia(s)`,
    });
  }

  const { data: turmas, error: erroTurmas } = await selecao().from("turmas").select("id, codigo, periodo_fim");
  if (erroTurmas) throw new Error(mensagemDeErroBanco(erroTurmas));
  const turmaPorId = new Map((turmas ?? []).map((t) => [t.id, t]));

  const { data: aulasPassadas, error: erroAulas } = await diario()
    .from("aulas")
    .select("id, turma_id, data")
    .lt("data", hoje);
  if (erroAulas) throw new Error(mensagemDeErroBanco(erroAulas));
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
    pendencias.push({ tipo: "chamadas_atrasadas", quantidade: atrasadas.length, detalhe: exemplos });
  }

  const { data: matriculasAtivas, error: erroMatAtivas } = await selecao()
    .from("matriculas")
    .select("turma_id")
    .eq("status", "matriculada");
  if (erroMatAtivas) throw new Error(mensagemDeErroBanco(erroMatAtivas));
  const turmasComAtivos = new Set((matriculasAtivas ?? []).map((m) => m.turma_id));
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
    });
  }

  return pendencias;
}

export interface TurmaEmAndamento extends TurmaListagem {
  frequenciaMedia: number | null;
  situacao: string;
}

export async function listarTurmasEmAndamento(): Promise<TurmaEmAndamento[]> {
  const [turmas, { porTurma }] = await Promise.all([listarTurmasParaCoordenacao(), calcularFrequencias()]);
  const hoje = hojeISO();

  return turmas.map((t) => {
    let situacao: string;
    if (t.periodoInicio > hoje) {
      situacao = `Começa ${t.periodoInicio.split("-").reverse().join("/")}`;
    } else if (t.periodoFim < hoje) {
      situacao = "Encerrada";
    } else if (t.pendentes > 0) {
      situacao = "Inscrições abertas";
    } else {
      situacao = "Em andamento";
    }
    return { ...t, frequenciaMedia: porTurma.get(t.id) ?? null, situacao };
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
