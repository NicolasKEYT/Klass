import { supabase } from "@/lib/supabase";
import { mensagemDeErroBanco } from "@/lib/mensagensDeErroBanco";
import { plural } from "@/lib/plural";
import {
  listarMatriculasDaTurma,
  listarMatriculasDoAluno,
  listarTurmasDoProfessor,
  type MatriculaDoAluno,
  type MatriculaListagem,
  type TurmaDoProfessor,
} from "@/lib/selecao";
import type { Aula, Avaliacao, Modulo, StatusMatricula, Trilha } from "@klass/types";

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

/**
 * O trigger de bloqueio pós-encerramento (notas/presenças de matrícula
 * concluída ou reprovada) impediu a exclusão. Classe própria para a tela
 * distinguir esse caso — a operação inteira foi desfeita, nada foi
 * apagado — de uma falha genérica.
 */
export class BloqueioAlunoEncerrado extends Error {}

function lancarErroDeExclusao(error: { message: string; code?: string }, oQue: string): never {
  if (error.message.includes("Matrícula já encerrada")) {
    throw new BloqueioAlunoEncerrado(
      `${oQue} não foi apagada: há registro de aluno já encerrado (aprovado ou reprovado), e o histórico dele não pode mudar. Para apagar, peça à coordenação para desfazer o encerramento desse aluno.`,
    );
  }
  throw new Error(mensagemDeErroBanco(error));
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

// Título e peso editáveis (policy avaliacoes_update). O select confirma
// que a linha mudou: sob RLS, um update sem permissão não dá erro.
export async function atualizarAvaliacao(
  id: string,
  patch: { titulo: string; peso: number },
): Promise<Avaliacao> {
  const { data, error } = await diario()
    .from("avaliacoes")
    .update({ titulo: patch.titulo, peso: patch.peso })
    .eq("id", id)
    .select("*");
  if (error) throw new Error(mensagemDeErroBanco(error));
  if (!data || data.length === 0) throw new Error("A avaliação não foi alterada: ela não existe mais ou você não tem permissão.");
  return data[0];
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

// Editar não apaga nem recria a linha (mesmo id) — as presenças já
// registradas, que referenciam aula_id, continuam intactas.
export async function atualizarAula(
  id: string,
  patch: { data: string; horario: string; descricao: string },
): Promise<Aula> {
  const { data, error } = await diario()
    .from("aulas")
    .update({
      data: patch.data,
      horario: patch.horario || null,
      descricao: patch.descricao || null,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(mensagemDeErroBanco(error));
  return data;
}

// Dias da semana no formato de Date.getDay(): 0 = domingo ... 6 = sábado.
// Função pura (sem chamada ao banco) para poder mostrar a prévia da
// quantidade de aulas antes do professor confirmar a geração em lote.
export function calcularDatasRecorrentes(
  diasDaSemana: number[],
  dataInicio: string,
  dataFim: string,
): string[] {
  if (diasDaSemana.length === 0 || !dataInicio || !dataFim) return [];
  const conjunto = new Set(diasDaSemana);
  const cursor = new Date(`${dataInicio}T00:00:00`);
  const fim = new Date(`${dataFim}T00:00:00`);
  if (cursor > fim) return [];

  const datas: string[] = [];
  while (cursor <= fim) {
    if (conjunto.has(cursor.getDay())) {
      const ano = cursor.getFullYear();
      const mes = String(cursor.getMonth() + 1).padStart(2, "0");
      const dia = String(cursor.getDate()).padStart(2, "0");
      datas.push(`${ano}-${mes}-${dia}`);
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return datas;
}

export async function criarAulasEmLote(input: {
  turmaId: string;
  datas: string[];
  horario: string;
  descricao: string;
}): Promise<void> {
  if (input.datas.length === 0) return;
  const { error } = await diario()
    .from("aulas")
    .insert(
      input.datas.map((data) => ({
        turma_id: input.turmaId,
        data,
        horario: input.horario || null,
        descricao: input.descricao || null,
      })),
    );
  if (error) throw new Error(mensagemDeErroBanco(error));
}

// Cascata deliberada: diario.notas.avaliacao_id já é "on delete cascade"
// (ver migration do schema), então apagar a avaliação apaga junto as
// notas lançadas para ela — são dados de matrícula ainda em curso,
// corrigíveis. Se alguma nota pertencer a uma matrícula já encerrada
// (concluída/reprovada), o trigger de bloqueio pós-encerramento do
// diario impede a exclusão daquela linha e a operação inteira falha —
// não é possível apagar uma avaliação que tenha nota de aluno já
// encerrado, preservando o histórico fechado dele.
export async function apagarAvaliacao(id: string): Promise<void> {
  const { error } = await diario().from("avaliacoes").delete().eq("id", id);
  if (error) lancarErroDeExclusao(error, "A avaliação");
}

// Mesma cascata da avaliação: diario.presencas.aula_id é "on delete
// cascade", então a chamada da aula vai junto; presença de matrícula
// encerrada bloqueia a operação inteira (BloqueioAlunoEncerrado). Existe
// sobretudo para aula criada por engano — pronto_para_encerrar exige
// chamada em todas as aulas, e uma aula sobrando impedia encerrar a turma.
export async function apagarAula(id: string): Promise<void> {
  const { data, error } = await diario().from("aulas").delete().eq("id", id).select("id");
  if (error) lancarErroDeExclusao(error, "A aula");
  // Sob RLS, um delete sem permissão não dá erro: só não apaga nada.
  if (!data || data.length === 0) throw new Error("A aula não foi apagada: ela não existe mais ou você não tem permissão.");
}

export interface AlunoParaLancamento {
  matriculaId: string;
  alunoNome: string;
}

/** Só os ativos (status matriculada) — é neles que dá pra lançar nota/presença. */
export function filtrarAlunosMatriculados(matriculas: MatriculaListagem[]): AlunoParaLancamento[] {
  return matriculas
    .filter((m) => m.status === "matriculada")
    .map((m) => ({ matriculaId: m.id, alunoNome: m.alunoNome }));
}

export async function listarAlunosMatriculados(turmaId: string): Promise<AlunoParaLancamento[]> {
  return filtrarAlunosMatriculados(await listarMatriculasDaTurma(turmaId));
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
export function filtrarAlunosDoDiario(matriculas: MatriculaListagem[]): AlunoDoDiario[] {
  return matriculas
    .filter((m) => m.status === "matriculada" || m.status === "concluida" || m.status === "reprovada")
    .map((m) => ({ matriculaId: m.id, alunoNome: m.alunoNome, status: m.status }));
}

export async function listarAlunosDoDiario(turmaId: string): Promise<AlunoDoDiario[]> {
  return filtrarAlunosDoDiario(await listarMatriculasDaTurma(turmaId));
}

export interface NotaLancada {
  avaliacaoId: string;
  matriculaId: string;
  valor: number;
}

// Notas de várias avaliações numa ida só (a grade antes fazia uma consulta
// por avaliação).
export async function buscarNotasDasAvaliacoes(avaliacaoIds: string[]): Promise<NotaLancada[]> {
  if (avaliacaoIds.length === 0) return [];
  const { data, error } = await diario()
    .from("notas")
    .select("avaliacao_id, matricula_id, valor")
    .in("avaliacao_id", avaliacaoIds);
  if (error) throw new Error(mensagemDeErroBanco(error));
  return (data ?? []).map((n) => ({
    avaliacaoId: n.avaliacao_id,
    matriculaId: n.matricula_id,
    valor: Number(n.valor),
  }));
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
  if (error) {
    // Um valor que precise de mais dígitos do que a coluna comporta (ex.:
    // "1000") estoura o precision/scale de notas.valor (numeric(4,2))
    // ANTES do check notas_valor_na_faixa rodar — vira "numeric field
    // overflow" (22003), não a violação do check. mensagemDeErroBanco não
    // mapeia esse código de forma genérica porque ele é comum a qualquer
    // coluna numeric do banco (ex.: media_minima da trilha também é
    // numeric(4,2), e mereceria outra mensagem); aqui sabemos que a coluna
    // é notas.valor, então tratamos direto. O check em si (valores como
    // 10.5 ou -5, que cabem na coluna mas violam o intervalo) já é
    // mapeado por mensagemDeErroBanco via notas_valor_na_faixa.
    if (error.code === "22003") {
      throw new Error("A nota precisa estar entre 0 e 10.");
    }
    throw new Error(mensagemDeErroBanco(error));
  }
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
  /** id da linha em diario.notas — o Realtime de DELETE só traz isso. */
  notaId: string | null;
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
    diario().from("notas").select("id, avaliacao_id, valor").eq("matricula_id", matriculaId),
  ]);
  if (notasResp.error) throw new Error(mensagemDeErroBanco(notasResp.error));

  const notaPorAvaliacao = new Map((notasResp.data ?? []).map((n) => [n.avaliacao_id, Number(n.valor)]));
  const idNotaPorAvaliacao = new Map((notasResp.data ?? []).map((n) => [n.avaliacao_id, n.id]));
  return avaliacoes.map((a) => ({
    notaId: idNotaPorAvaliacao.get(a.id) ?? null,
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
// `turmas` opcional em todas as consultas do "Hoje": a tela já tem a lista
// em cache e a repassa — antes cada card buscava as turmas de novo.
export async function listarAulasDeHojeDoProfessor(
  professorId: string,
  turmasConhecidas?: TurmaDoProfessor[],
): Promise<AulaDeHoje[]> {
  const turmas = turmasConhecidas ?? (await listarTurmasDoProfessor(professorId));
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

export async function listarPendenciasDoProfessor(
  professorId: string,
  turmasConhecidas?: TurmaDoProfessor[],
  /** Quem tem os alunos de cada turma em cache passa um leitor (roda em paralelo às demais). */
  obterAlunos: (turmaId: string) => Promise<AlunoParaLancamento[]> = listarAlunosMatriculados,
): Promise<PendenciaProfessor[]> {
  const turmas = turmasConhecidas ?? (await listarTurmasDoProfessor(professorId));
  if (turmas.length === 0) return [];
  const turmaIds = turmas.map((t) => t.id);
  const hoje = hojeISO();

  const [avaliacoesResp, aulasResp, listasDeAlunos] = await Promise.all([
    diario().from("avaliacoes").select("*").in("turma_id", turmaIds),
    diario().from("aulas").select("*").in("turma_id", turmaIds),
    Promise.all(turmas.map((t) => obterAlunos(t.id))),
  ]);
  if (avaliacoesResp.error) throw new Error(mensagemDeErroBanco(avaliacoesResp.error));
  if (aulasResp.error) throw new Error(mensagemDeErroBanco(aulasResp.error));

  const alunosPorTurmaId = new Map(turmas.map((t, i) => [t.id, listasDeAlunos[i]]));
  const turmaPorId = new Map(turmas.map((t) => [t.id, t]));

  const pendencias: PendenciaProfessor[] = [];

  // Notas e presenças só dependem de avaliações/aulas: as duas consultas
  // saem juntas, não uma depois da outra.
  const avaliacoes = avaliacoesResp.data ?? [];
  const avaliacaoIds = avaliacoes.map((a) => a.id);
  const aulasPassadas = (aulasResp.data ?? []).filter((a) => a.data < hoje);
  const aulaIds = aulasPassadas.map((a) => a.id);
  const [
    { data: notas, error: erroNotas },
    { data: presencas, error: erroPresencas },
  ] = await Promise.all([
    avaliacaoIds.length > 0
      ? diario().from("notas").select("avaliacao_id, matricula_id").in("avaliacao_id", avaliacaoIds)
      : Promise.resolve({ data: [] as Array<{ avaliacao_id: string; matricula_id: string }>, error: null }),
    aulaIds.length > 0
      ? diario().from("presencas").select("aula_id").in("aula_id", aulaIds)
      : Promise.resolve({ data: [] as Array<{ aula_id: string }>, error: null }),
  ]);
  if (erroNotas) throw new Error(mensagemDeErroBanco(erroNotas));
  if (erroPresencas) throw new Error(mensagemDeErroBanco(erroPresencas));

  // Avaliações sem nota completa: menos notas lançadas do que alunos ativos.
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
        titulo: `${avaliacao.titulo} sem nota para ${plural(faltam, "aluno", "alunos")}`,
        detalhe: `${turma?.codigo ?? "—"} · ${turma?.moduloNome ?? "—"}`,
        turmaId: avaliacao.turma_id,
      });
    }
  }

  // Chamadas atrasadas: aula já passou e não tem nenhuma presença registrada.
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
        titulo: dias === 0 ? "Turma termina hoje" : `Turma termina em ${plural(dias, "dia", "dias")}`,
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

// Frequência comparada com a mínima configurada em cada turma (a mesma
// que decide a aprovação no encerramento), não com 75% fixo — com um
// número fixo, aluno abaixo da mínima de uma turma mais exigente não
// aparecia. Média parcial usa o mínimo real da trilha.
//
// Função pura: quem chama já tem turmas, alunos e progresso (em cache,
// compartilhados com o diário da turma) e só pede a classificação — antes
// isto buscava turma por turma em sequência.
export function identificarAlunosQuePedemAtencao(
  turmas: TurmaDoProfessor[],
  alunosPorTurma: Map<string, AlunoParaLancamento[]>,
  progressoPorMatricula: Map<string, ProgressoMatricula>,
): AlunoQuePedeAtencao[] {
  const resultado: AlunoQuePedeAtencao[] = [];
  for (const turma of turmas) {
    for (const aluno of alunosPorTurma.get(turma.id) ?? []) {
      const p = progressoPorMatricula.get(aluno.matriculaId);
      if (!p) continue;
      if (p.frequencia !== null && p.frequencia < turma.frequenciaMinimaPercentual) {
        resultado.push({
          alunoNome: aluno.alunoNome,
          turmaId: turma.id,
          turmaCodigo: turma.codigo,
          motivo: "frequência",
          valor: `${p.frequencia.toFixed(0)}%`,
        });
      } else if (p.media !== null && p.media < turma.trilhaMediaMinima) {
        resultado.push({
          alunoNome: aluno.alunoNome,
          turmaId: turma.id,
          turmaCodigo: turma.codigo,
          motivo: "média parcial",
          valor: p.media.toFixed(1),
        });
      }
    }
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
// tela mostra o convite pra explorar o catálogo. Separado em escolha
// (pura) + montagem para a tela reaproveitar trilha, módulos e progresso
// que já estão em cache.
export function escolherMatriculaEmAndamento(
  matriculas: MatriculaDoAluno[],
): { matricula: MatriculaDoAluno; concluidos: number } | null {
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

  const matricula = emAndamento.find((m) => m.trilhaId === melhor!.trilhaId);
  return matricula ? { matricula, concluidos: melhor.concluidos } : null;
}

export function montarProximoPasso(
  escolha: { matricula: MatriculaDoAluno; concluidos: number },
  trilha: Trilha,
  modulos: Modulo[],
  progresso: ProgressoMatricula,
): ProximoPassoAluno {
  return {
    trilhaNome: trilha.nome,
    trilhaSlug: trilha.slug,
    modulosConcluidos: escolha.concluidos,
    totalModulos: modulos.length,
    moduloAtualNome: escolha.matricula.moduloNome,
    frequenciaAtual: progresso.frequencia,
    frequenciaMinima: escolha.matricula.frequenciaMinimaPercentual,
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
export async function listarNovidadesDoAluno(
  alunoId: string,
  matriculasConhecidas?: MatriculaDoAluno[],
): Promise<NovidadeAluno[]> {
  const matriculas = matriculasConhecidas ?? (await listarMatriculasDoAluno(alunoId));
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

  // deferido_em sozinho não quer dizer "confirmada": o banco também o
  // preenche ao REJEITAR, e uma matrícula devolvida para "inscrita" (ex.:
  // reaberta pela coordenação) mantém a data antiga — a Carla via
  // "Matrícula confirmada" de uma inscrição que o Boletim mostrava "Em
  // análise". Só conta quem está (ou esteve) de fato matriculado.
  const eventosMatricula: NovidadeAluno[] = matriculas
    .filter((m) => m.deferidoEm !== null && m.status !== "inscrita" && m.status !== "rejeitada")
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
