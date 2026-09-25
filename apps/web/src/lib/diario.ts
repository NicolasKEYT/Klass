import { supabase } from "@/lib/supabase";
import { mensagemDeErroBanco } from "@/lib/mensagensDeErroBanco";
import { buscarTrilhaPorId, listarModulosDaTrilha } from "@/lib/catalogo";
import {
  buscarTurmaDetalhada,
  listarMatriculasDaTurma,
  listarMatriculasDoAluno,
  listarTurmasDoProfessor,
} from "@/lib/selecao";
import type { Aula, Avaliacao, StatusMatricula } from "@klass/types";

function diario() {
  if (!supabase) throw new Error("Supabase não configurado.");
  return supabase.schema("diario");
}

// Data local (não UTC) no formato que o banco usa para `date` — evita o
// erro de "hoje" virar ontem/amanhã perto da meia-noite em fusos como o
// do Brasil (UTC-3), que o toISOString() (sempre UTC) cometeria.
function hojeISO(): string {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function diasEntre(dataAlvo: string, dataBase: string): number {
  const alvo = new Date(`${dataAlvo}T00:00:00`);
  const base = new Date(`${dataBase}T00:00:00`);
  return Math.round((alvo.getTime() - base.getTime()) / 86_400_000);
}

export async function listarAvaliacoesDaTurma(turmaId: string): Promise<Avaliacao[]> {
  const { data, error } = await diario()
    .from("avaliacoes")
    .select("*")
    .eq("turma_id", turmaId)
    .order("ordem");
  if (error) throw new Error(mensagemDeErroBanco(error));
  return data;
}

export async function buscarAvaliacao(avaliacaoId: string): Promise<Avaliacao | null> {
  const { data, error } = await diario()
    .from("avaliacoes")
    .select("*")
    .eq("id", avaliacaoId)
    .maybeSingle();
  if (error) throw new Error(mensagemDeErroBanco(error));
  return data;
}

export async function proximaOrdemAvaliacao(turmaId: string): Promise<number> {
  const avaliacoes = await listarAvaliacoesDaTurma(turmaId);
  return avaliacoes.length > 0 ? Math.max(...avaliacoes.map((a) => a.ordem)) + 1 : 1;
}

export async function criarAvaliacao(input: {
  turmaId: string;
  titulo: string;
  descricao: string;
  peso: number;
  ordem: number;
}): Promise<Avaliacao> {
  const { data, error } = await diario()
    .from("avaliacoes")
    .insert({
      turma_id: input.turmaId,
      titulo: input.titulo,
      descricao: input.descricao || null,
      peso: input.peso,
      ordem: input.ordem,
    })
    .select("*")
    .single();
  if (error) throw new Error(mensagemDeErroBanco(error));
  return data;
}

export async function listarAulasDaTurma(turmaId: string): Promise<Aula[]> {
  const { data, error } = await diario()
    .from("aulas")
    .select("*")
    .eq("turma_id", turmaId)
    .order("data")
    .order("horario");
  if (error) throw new Error(mensagemDeErroBanco(error));
  return data;
}

export async function buscarAula(aulaId: string): Promise<Aula | null> {
  const { data, error } = await diario().from("aulas").select("*").eq("id", aulaId).maybeSingle();
  if (error) throw new Error(mensagemDeErroBanco(error));
  return data;
}

export async function criarAula(input: {
  turmaId: string;
  data: string;
  horario: string;
  descricao: string;
}): Promise<Aula> {
  const { data, error } = await diario()
    .from("aulas")
    .insert({
      turma_id: input.turmaId,
      data: input.data,
      horario: input.horario || null,
      descricao: input.descricao || null,
    })
    .select("*")
    .single();
  if (error) throw new Error(mensagemDeErroBanco(error));
  return data;
}

export interface AlunoParaLancamento {
  matriculaId: string;
  alunoNome: string;
}

/** Só os ativos (status matriculada) — é neles que dá pra lançar nota/presença. */
export async function listarAlunosMatriculados(turmaId: string): Promise<AlunoParaLancamento[]> {
  const matriculas = await listarMatriculasDaTurma(turmaId);
  return matriculas
    .filter((m) => m.status === "matriculada")
    .map((m) => ({ matriculaId: m.id, alunoNome: m.alunoNome }));
}

export interface AlunoDoDiario {
  matriculaId: string;
  alunoNome: string;
  status: StatusMatricula;
}

/**
 * Ativos e já encerrados (matriculada/concluida/reprovada) — pra aba
 * "Alunos" continuar mostrando quem já foi aprovado/reprovado, não só
 * quem ainda está cursando.
 */
export async function listarAlunosDoDiario(turmaId: string): Promise<AlunoDoDiario[]> {
  const matriculas = await listarMatriculasDaTurma(turmaId);
  return matriculas
    .filter((m) => m.status === "matriculada" || m.status === "concluida" || m.status === "reprovada")
    .map((m) => ({ matriculaId: m.id, alunoNome: m.alunoNome, status: m.status }));
}

export async function buscarNotasDaAvaliacao(avaliacaoId: string): Promise<Map<string, number>> {
  const { data, error } = await diario()
    .from("notas")
    .select("matricula_id, valor")
    .eq("avaliacao_id", avaliacaoId);
  if (error) throw new Error(mensagemDeErroBanco(error));
  return new Map((data ?? []).map((n) => [n.matricula_id, Number(n.valor)]));
}

export async function salvarNotasEmLote(
  avaliacaoId: string,
  lancadoPor: string,
  notas: Array<{ matriculaId: string; valor: number }>,
): Promise<void> {
  const { error } = await diario()
    .from("notas")
    .upsert(
      notas.map((n) => ({
        avaliacao_id: avaliacaoId,
        matricula_id: n.matriculaId,
        valor: n.valor,
        lancada_por: lancadoPor,
        lancada_em: new Date().toISOString(),
      })),
      { onConflict: "avaliacao_id,matricula_id" },
    );
  if (error) throw new Error(mensagemDeErroBanco(error));
}

export async function buscarPresencasDaAula(aulaId: string): Promise<Map<string, boolean>> {
  const { data, error } = await diario()
    .from("presencas")
    .select("matricula_id, presente")
    .eq("aula_id", aulaId);
  if (error) throw new Error(mensagemDeErroBanco(error));
  return new Map((data ?? []).map((p) => [p.matricula_id, p.presente]));
}

export async function salvarChamadaEmLote(
  aulaId: string,
  registradoPor: string,
  presencas: Array<{ matriculaId: string; presente: boolean }>,
): Promise<void> {
  const { error } = await diario()
    .from("presencas")
    .upsert(
      presencas.map((p) => ({
        aula_id: aulaId,
        matricula_id: p.matriculaId,
        presente: p.presente,
        registrada_por: registradoPor,
        registrada_em: new Date().toISOString(),
      })),
      { onConflict: "aula_id,matricula_id" },
    );
  if (error) throw new Error(mensagemDeErroBanco(error));
}

export interface ProgressoMatricula {
  media: number | null;
  frequencia: number | null;
  prontoParaEncerrar: boolean;
}

export async function buscarProgressoMatricula(matriculaId: string): Promise<ProgressoMatricula> {
  const [mediaResp, freqResp, prontoResp] = await Promise.all([
    diario().rpc("media_ponderada", { p_matricula_id: matriculaId }),
    diario().rpc("frequencia_percentual", { p_matricula_id: matriculaId }),
    diario().rpc("pronto_para_encerrar", { p_matricula_id: matriculaId }),
  ]);
  if (mediaResp.error) throw new Error(mensagemDeErroBanco(mediaResp.error));
  if (freqResp.error) throw new Error(mensagemDeErroBanco(freqResp.error));
  if (prontoResp.error) throw new Error(mensagemDeErroBanco(prontoResp.error));
  return {
    media: mediaResp.data === null ? null : Number(mediaResp.data),
    frequencia: freqResp.data === null ? null : Number(freqResp.data),
    prontoParaEncerrar: Boolean(prontoResp.data),
  };
}

export async function encerrarMatricula(matriculaId: string): Promise<void> {
  const { error } = await diario().rpc("encerrar_matricula", { p_matricula_id: matriculaId });
  if (error) throw new Error(mensagemDeErroBanco(error));
}

export async function desfazerEncerramento(matriculaId: string): Promise<void> {
  const { error } = await diario().rpc("desfazer_encerramento", { p_matricula_id: matriculaId });
  if (error) throw new Error(mensagemDeErroBanco(error));
}

// Resumo devolvido por diario.encerrar_turma (jsonb). O rpc é tipado como
// Json genérico, então casamos aqui para o formato conhecido.
export interface ResumoEncerramentoTurma {
  aprovadas: number;
  reprovadas: number;
  puladas: number;
  total: number;
  motivo_puladas: string;
}

export async function encerrarTurma(turmaId: string): Promise<ResumoEncerramentoTurma> {
  const { data, error } = await diario().rpc("encerrar_turma", { p_turma_id: turmaId });
  if (error) throw new Error(mensagemDeErroBanco(error));
  return data as unknown as ResumoEncerramentoTurma;
}

export interface ResumoReativacaoTurma {
  reativadas: number;
}

export async function reativarTurma(turmaId: string): Promise<ResumoReativacaoTurma> {
  const { data, error } = await diario().rpc("reativar_turma", { p_turma_id: turmaId });
  if (error) throw new Error(mensagemDeErroBanco(error));
  return data as unknown as ResumoReativacaoTurma;
}

export interface AvaliacaoComNota {
  id: string;
  titulo: string;
  peso: number;
  ordem: number;
  nota: number | null;
}

export async function listarAvaliacoesComNotaDoAluno(
  matriculaId: string,
  turmaId: string,
): Promise<AvaliacaoComNota[]> {
  const [avaliacoes, notasResp] = await Promise.all([
    listarAvaliacoesDaTurma(turmaId),
    diario().from("notas").select("avaliacao_id, valor").eq("matricula_id", matriculaId),
  ]);
  if (notasResp.error) throw new Error(mensagemDeErroBanco(notasResp.error));

  const notaPorAvaliacao = new Map((notasResp.data ?? []).map((n) => [n.avaliacao_id, Number(n.valor)]));
  return avaliacoes.map((a) => ({
    id: a.id,
    titulo: a.titulo,
    peso: a.peso,
    ordem: a.ordem,
    nota: notaPorAvaliacao.get(a.id) ?? null,
  }));
}

export interface AulaComPresenca {
  id: string;
  data: string;
  horario: string | null;
  /** null = chamada ainda não feita para esta aula. */
  presente: boolean | null;
}

export async function listarAulasComPresencaDoAluno(
  matriculaId: string,
  turmaId: string,
): Promise<AulaComPresenca[]> {
  const [aulas, presencasResp] = await Promise.all([
    listarAulasDaTurma(turmaId),
    diario().from("presencas").select("aula_id, presente").eq("matricula_id", matriculaId),
  ]);
  if (presencasResp.error) throw new Error(mensagemDeErroBanco(presencasResp.error));

  const presencaPorAula = new Map((presencasResp.data ?? []).map((p) => [p.aula_id, p.presente]));
  return aulas.map((au) => ({
    id: au.id,
    data: au.data,
    horario: au.horario,
    presente: presencaPorAula.has(au.id) ? (presencaPorAula.get(au.id) ?? null) : null,
  }));
}

// ---------------------------------------------------------------------
// D4 (klass-uikit.pdf) — tela "Hoje" do professor. As três consultas
// abaixo são só leitura sobre dados que já existem (turmas, aulas,
// avaliações, notas, presenças do próprio professor) — nenhum schema
// novo, nenhuma regra de negócio nova.
// ---------------------------------------------------------------------

export interface AulaDeHoje {
  id: string;
  turmaId: string;
  turmaCodigo: string;
  moduloNome: string;
  horario: string | null;
  totalAlunos: number;
  chamadaFeita: boolean;
}

// A tela não mostra "sala": diario.aulas não tem essa coluna (o wireframe
// do kit mostra um dado que não existe no schema atual) — mostrar um
// valor inventado contradiria a regra de não fingir dado que não existe.
export async function listarAulasDeHojeDoProfessor(professorId: string): Promise<AulaDeHoje[]> {
  const turmas = await listarTurmasDoProfessor(professorId);
  if (turmas.length === 0) return [];

  const { data: aulas, error } = await diario()
    .from("aulas")
    .select("*")
    .in(
      "turma_id",
      turmas.map((t) => t.id),
    )
    .eq("data", hojeISO())
    .order("horario");
  if (error) throw new Error(mensagemDeErroBanco(error));
  if (!aulas || aulas.length === 0) return [];

  const aulaIds = aulas.map((a) => a.id);
  const { data: presencas, error: erroPresencas } = await diario()
    .from("presencas")
    .select("aula_id")
    .in("aula_id", aulaIds);
  if (erroPresencas) throw new Error(mensagemDeErroBanco(erroPresencas));
  const aulasComChamada = new Set((presencas ?? []).map((p) => p.aula_id));

  const turmaPorId = new Map(turmas.map((t) => [t.id, t]));
  return aulas.map((aula) => {
    const turma = turmaPorId.get(aula.turma_id);
    return {
      id: aula.id,
      turmaId: aula.turma_id,
      turmaCodigo: turma?.codigo ?? "—",
      moduloNome: turma?.moduloNome ?? "—",
      horario: aula.horario,
      totalAlunos: turma?.matriculados ?? 0,
      chamadaFeita: aulasComChamada.has(aula.id),
    };
  });
}

export type TipoPendenciaProfessor = "avaliacao_sem_nota" | "chamada_atrasada" | "turma_terminando";

export interface PendenciaProfessor {
  tipo: TipoPendenciaProfessor;
  titulo: string;
  detalhe: string;
  turmaId: string;
  aulaId?: string;
}

export async function listarPendenciasDoProfessor(professorId: string): Promise<PendenciaProfessor[]> {
  const turmas = await listarTurmasDoProfessor(professorId);
  if (turmas.length === 0) return [];
  const turmaIds = turmas.map((t) => t.id);
  const hoje = hojeISO();

  const [avaliacoesResp, aulasResp, listasDeAlunos] = await Promise.all([
    diario().from("avaliacoes").select("*").in("turma_id", turmaIds),
    diario().from("aulas").select("*").in("turma_id", turmaIds),
    Promise.all(turmas.map((t) => listarAlunosMatriculados(t.id))),
  ]);
  if (avaliacoesResp.error) throw new Error(mensagemDeErroBanco(avaliacoesResp.error));
  if (aulasResp.error) throw new Error(mensagemDeErroBanco(aulasResp.error));

  const alunosPorTurmaId = new Map(turmas.map((t, i) => [t.id, listasDeAlunos[i]]));
  const turmaPorId = new Map(turmas.map((t) => [t.id, t]));

  const pendencias: PendenciaProfessor[] = [];

  // Avaliações sem nota completa: menos notas lançadas do que alunos ativos.
  const avaliacoes = avaliacoesResp.data ?? [];
  const avaliacaoIds = avaliacoes.map((a) => a.id);
  const { data: notas, error: erroNotas } =
    avaliacaoIds.length > 0
      ? await diario().from("notas").select("avaliacao_id, matricula_id").in("avaliacao_id", avaliacaoIds)
      : { data: [] as Array<{ avaliacao_id: string; matricula_id: string }>, error: null };
  if (erroNotas) throw new Error(mensagemDeErroBanco(erroNotas));
  const notasPorAvaliacao = new Map<string, number>();
  for (const n of notas ?? []) {
    notasPorAvaliacao.set(n.avaliacao_id, (notasPorAvaliacao.get(n.avaliacao_id) ?? 0) + 1);
  }
  for (const avaliacao of avaliacoes) {
    const totalAtivos = (alunosPorTurmaId.get(avaliacao.turma_id) ?? []).length;
    const lancadas = notasPorAvaliacao.get(avaliacao.id) ?? 0;
    const faltam = totalAtivos - lancadas;
    if (faltam > 0) {
      const turma = turmaPorId.get(avaliacao.turma_id);
      pendencias.push({
        tipo: "avaliacao_sem_nota",
        titulo: `${avaliacao.titulo} sem nota para ${faltam} aluno(s)`,
        detalhe: `${turma?.codigo ?? "—"} · ${turma?.moduloNome ?? "—"}`,
        turmaId: avaliacao.turma_id,
      });
    }
  }

  // Chamadas atrasadas: aula já passou e não tem nenhuma presença registrada.
  const aulasPassadas = (aulasResp.data ?? []).filter((a) => a.data < hoje);
  const aulaIds = aulasPassadas.map((a) => a.id);
  const { data: presencas, error: erroPresencas } =
    aulaIds.length > 0
      ? await diario().from("presencas").select("aula_id").in("aula_id", aulaIds)
      : { data: [] as Array<{ aula_id: string }>, error: null };
  if (erroPresencas) throw new Error(mensagemDeErroBanco(erroPresencas));
  const aulasComChamada = new Set((presencas ?? []).map((p) => p.aula_id));
  for (const aula of aulasPassadas) {
    if (aulasComChamada.has(aula.id)) continue;
    const turma = turmaPorId.get(aula.turma_id);
    pendencias.push({
      tipo: "chamada_atrasada",
      titulo: `Chamada de ${aula.data.split("-").reverse().join("/")} não feita`,
      detalhe: `${turma?.codigo ?? "—"} · Aula`,
      turmaId: aula.turma_id,
      aulaId: aula.id,
    });
  }

  // Turmas terminando nos próximos 7 dias, com alunos ainda cursando.
  for (const turma of turmas) {
    const dias = diasEntre(turma.periodoFim, hoje);
    const alunosAtivos = alunosPorTurmaId.get(turma.id) ?? [];
    if (dias >= 0 && dias <= 7 && alunosAtivos.length > 0) {
      pendencias.push({
        tipo: "turma_terminando",
        titulo: `Turma termina em ${dias} dia(s)`,
        detalhe: `${turma.codigo} · encerrar os alunos`,
        turmaId: turma.id,
      });
    }
  }

  return pendencias;
}

export interface AlunoQuePedeAtencao {
  alunoNome: string;
  turmaId: string;
  turmaCodigo: string;
  motivo: "frequência" | "média parcial";
  valor: string;
}

// Frequência abaixo de 75% é o mínimo legal (LDB, art. 24) — fixo, não o
// frequenciaMinimaPercentual configurável da turma (que pode ser mais
// exigente). Média parcial usa o mínimo real da trilha.
const FREQUENCIA_MINIMA_LEGAL = 75;

export async function listarAlunosQuePedemAtencaoDoProfessor(
  professorId: string,
): Promise<AlunoQuePedeAtencao[]> {
  const turmas = await listarTurmasDoProfessor(professorId);
  const resultado: AlunoQuePedeAtencao[] = [];

  for (const turma of turmas) {
    const alunos = await listarAlunosMatriculados(turma.id);
    if (alunos.length === 0) continue;
    const turmaDetalhada = await buscarTurmaDetalhada(turma.id);
    const progressos = await Promise.all(alunos.map((a) => buscarProgressoMatricula(a.matriculaId)));

    alunos.forEach((aluno, i) => {
      const p = progressos[i];
      if (p.frequencia !== null && p.frequencia < FREQUENCIA_MINIMA_LEGAL) {
        resultado.push({
          alunoNome: aluno.alunoNome,
          turmaId: turma.id,
          turmaCodigo: turma.codigo,
          motivo: "frequência",
          valor: `${p.frequencia.toFixed(0)}%`,
        });
      } else if (p.media !== null && turmaDetalhada && p.media < turmaDetalhada.trilhaMediaMinima) {
        resultado.push({
          alunoNome: aluno.alunoNome,
          turmaId: turma.id,
          turmaCodigo: turma.codigo,
          motivo: "média parcial",
          valor: p.media.toFixed(1),
        });
      }
    });
  }

  return resultado;
}

// ---------------------------------------------------------------------
// D4 (klass-uikit.pdf) — tela "Início" do aluno.
// ---------------------------------------------------------------------

export interface ProximoPassoAluno {
  trilhaNome: string;
  trilhaSlug: string;
  modulosConcluidos: number;
  totalModulos: number;
  moduloAtualNome: string;
  frequenciaAtual: number | null;
  frequenciaMinima: number;
}

// "Trilha mais avançada em andamento": entre as trilhas onde o aluno tem
// matrícula ativa (status matriculada), a que já acumula mais módulos
// concluídos. Sem matrícula ativa nenhuma, não há "próximo passo" —
// tela mostra o convite pra explorar o catálogo.
export async function buscarProximoPassoDoAluno(alunoId: string): Promise<ProximoPassoAluno | null> {
  const matriculas = await listarMatriculasDoAluno(alunoId);
  const emAndamento = matriculas.filter((m) => m.status === "matriculada");
  if (emAndamento.length === 0) return null;

  const trilhaIds = [...new Set(emAndamento.map((m) => m.trilhaId))];
  let melhor: { trilhaId: string; concluidos: number } | null = null;
  for (const trilhaId of trilhaIds) {
    const concluidos = matriculas.filter(
      (m) => m.trilhaId === trilhaId && m.status === "concluida",
    ).length;
    if (!melhor || concluidos > melhor.concluidos) melhor = { trilhaId, concluidos };
  }
  if (!melhor) return null;

  const matriculaAtual = emAndamento.find((m) => m.trilhaId === melhor!.trilhaId);
  if (!matriculaAtual) return null;

  const [trilha, modulos, progresso] = await Promise.all([
    buscarTrilhaPorId(melhor.trilhaId),
    listarModulosDaTrilha(melhor.trilhaId),
    buscarProgressoMatricula(matriculaAtual.id),
  ]);
  if (!trilha) return null;

  return {
    trilhaNome: trilha.nome,
    trilhaSlug: trilha.slug,
    modulosConcluidos: melhor.concluidos,
    totalModulos: modulos.length,
    moduloAtualNome: matriculaAtual.moduloNome,
    frequenciaAtual: progresso.frequencia,
    frequenciaMinima: matriculaAtual.frequenciaMinimaPercentual,
  };
}

export interface NovidadeAluno {
  texto: string;
  detalhe: string;
  quando: string;
}

// Deriva dos mesmos dados que já alimentam o Realtime do boletim (notas e
// mudanças de matrícula) — sem tabela nova, só uma leitura ordenada por
// data, limitada às 5 mais recentes.
export async function listarNovidadesDoAluno(alunoId: string): Promise<NovidadeAluno[]> {
  const matriculas = await listarMatriculasDoAluno(alunoId);
  if (matriculas.length === 0) return [];
  const matriculaIds = matriculas.map((m) => m.id);
  const matriculaPorId = new Map(matriculas.map((m) => [m.id, m]));

  const { data: notas, error } = await diario()
    .from("notas")
    .select("matricula_id, valor, lancada_em, avaliacao_id")
    .in("matricula_id", matriculaIds)
    .order("lancada_em", { ascending: false })
    .limit(5);
  if (error) throw new Error(mensagemDeErroBanco(error));

  const avaliacaoIds = [...new Set((notas ?? []).map((n) => n.avaliacao_id))];
  const { data: avaliacoes, error: erroAval } =
    avaliacaoIds.length > 0
      ? await diario().from("avaliacoes").select("id, titulo").in("id", avaliacaoIds)
      : { data: [] as Array<{ id: string; titulo: string }>, error: null };
  if (erroAval) throw new Error(mensagemDeErroBanco(erroAval));
  const tituloPorAvaliacao = new Map((avaliacoes ?? []).map((a) => [a.id, a.titulo]));

  const eventosNota: NovidadeAluno[] = (notas ?? []).map((n) => {
    const m = matriculaPorId.get(n.matricula_id);
    return {
      texto: `Nota publicada: ${tituloPorAvaliacao.get(n.avaliacao_id) ?? "Avaliação"} · ${Number(n.valor).toFixed(1)}`,
      detalhe: m?.moduloNome ?? "—",
      quando: n.lancada_em,
    };
  });

  const eventosMatricula: NovidadeAluno[] = matriculas
    .filter((m) => m.deferidoEm !== null)
    .map((m) => ({
      texto: `Matrícula confirmada em ${m.turmaCodigo}`,
      detalhe: m.moduloNome,
      quando: m.deferidoEm as string,
    }));

  return [...eventosNota, ...eventosMatricula]
    .sort((a, b) => (a.quando < b.quando ? 1 : -1))
    .slice(0, 5);
}

export type { Aula, Avaliacao };
