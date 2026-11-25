import { supabase } from "@/lib/supabase";
import { mensagemDeErroBanco } from "@/lib/mensagensDeErroBanco";
import { plural } from "@/lib/plural";
import { formatarData, formatarMedia, formatarNota, formatarPercentual } from "@/lib/formato";
import {
  buscarNomesCompletos,
  listarMatriculasDaTurma,
  listarMatriculasDoAluno,
  listarTurmasDoProfessor,
  type MatriculaDoAluno,
  type MatriculaListagem,
  type TurmaDoProfessor,
} from "@/lib/selecao";
import type {
  Aula,
  AulaComPrazo,
  Avaliacao,
  HistoricoEncerramento,
  Modulo,
  SituacaoChamada,
  StatusMatricula,
  TipoCertificacao,
  Trilha,
} from "@klass/types";

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

// Aulas vêm com a situação do prazo da chamada já decidida pelo banco
// (campos calculados diario.situacao_chamada / chamada_aberta_ate): a tela
// não repete a regra dos 7 dias nem o fuso da instituição.
const COLUNAS_AULA = "*, situacao_chamada, chamada_aberta_ate";

export async function listarAulasDaTurma(turmaId: string): Promise<AulaComPrazo[]> {
  const { data, error } = await diario()
    .from("aulas")
    .select(COLUNAS_AULA)
    .eq("turma_id", turmaId)
    .order("data")
    .order("horario");
  if (error) throw new Error(mensagemDeErroBanco(error));
  return data as AulaComPrazo[];
}

export async function buscarAula(aulaId: string): Promise<AulaComPrazo | null> {
  const { data, error } = await diario().from("aulas").select(COLUNAS_AULA).eq("id", aulaId).maybeSingle();
  if (error) throw new Error(mensagemDeErroBanco(error));
  return data as AulaComPrazo | null;
}

// Chamadas pendentes (aula passada sem presença) de UMA turma, com a
// situação do prazo — para o Resumo da turma. A função do banco devolve as
// do professor ou, para a coordenação, todas; aqui filtra a turma.
export interface ChamadaPendente {
  aulaId: string;
  data: string;
  situacao: SituacaoChamada;
  abertaAte: string;
}

export async function listarChamadasPendentesDaTurma(turmaId: string): Promise<ChamadaPendente[]> {
  const { data, error } = await diario().rpc("chamadas_pendentes");
  if (error) throw new Error(mensagemDeErroBanco(error));
  return (data ?? [])
    .filter((c) => c.turma_id === turmaId)
    .map((c) => ({
      aulaId: c.aula_id,
      data: c.data,
      situacao: c.situacao as SituacaoChamada,
      abertaAte: c.aberta_ate,
    }));
}

// Coordenação libera a chamada de uma aula fora do prazo: o professor
// ganha mais 7 dias a partir de hoje. Devolve a nova data limite.
export async function liberarChamada(aulaId: string): Promise<string> {
  const { data, error } = await diario().rpc("liberar_chamada", { p_aula_id: aulaId });
  if (error) throw new Error(mensagemDeErroBanco(error));
  return data;
}

export async function criarAula(input: {
  turmaId: string;
  data: string;
  horario: string;
  descricao: string;
  /** Opcional (ex.: "Sala 3"); vazio = sem sala. */
  sala?: string;
}): Promise<Aula> {
  const { data, error } = await diario()
    .from("aulas")
    .insert({
      turma_id: input.turmaId,
      data: input.data,
      horario: input.horario || null,
      descricao: input.descricao || null,
      sala: input.sala?.trim() || null,
    })
    .select(COLUNAS_AULA)
    .single();
  if (error) throw new Error(mensagemDeErroBanco(error));
  return data;
}

// Editar não apaga nem recria a linha (mesmo id) — as presenças já
// registradas, que referenciam aula_id, continuam intactas.
export async function atualizarAula(
  id: string,
  patch: { data: string; horario: string; descricao: string; sala?: string },
): Promise<Aula> {
  const { data, error } = await diario()
    .from("aulas")
    .update({
      data: patch.data,
      horario: patch.horario || null,
      descricao: patch.descricao || null,
      sala: patch.sala?.trim() || null,
    })
    .eq("id", id)
    .select(COLUNAS_AULA)
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
  sala?: string;
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
        sala: input.sala?.trim() || null,
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
  /** id da linha em diario.notas (o Realtime de DELETE só traz isso); falta na célula recém-gravada até a releitura. */
  id?: string;
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
    .select("id, avaliacao_id, matricula_id, valor")
    .in("avaliacao_id", avaliacaoIds);
  if (error) throw new Error(mensagemDeErroBanco(error));
  return (data ?? []).map((n) => ({
    id: n.id,
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

// Limpar a célula da grade remove a nota (QA, P5). A RLS (notas_delete) e o
// trigger que protege matrícula encerrada valem como em qualquer exclusão.
export async function removerNota(avaliacaoId: string, matriculaId: string): Promise<void> {
  const { data, error } = await diario()
    .from("notas")
    .delete()
    .eq("avaliacao_id", avaliacaoId)
    .eq("matricula_id", matriculaId)
    .select("id");
  if (error) lancarErroDeExclusao(error, "A nota");
  if (!data || data.length === 0) throw new Error("A nota não foi removida: ela não existe mais ou você não tem permissão.");
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

// Progresso de todas as matrículas da turma numa chamada só
// (diario.progresso_da_turma; professor da turma ou coordenação). Antes,
// eram três RPCs por aluno. Record (não Map) para caber no cache.
export async function buscarProgressoDaTurma(turmaId: string): Promise<Record<string, ProgressoMatricula>> {
  const { data, error } = await diario().rpc("progresso_da_turma", { p_turma_id: turmaId });
  if (error) throw new Error(mensagemDeErroBanco(error));
  const resultado: Record<string, ProgressoMatricula> = {};
  for (const linha of data ?? []) {
    resultado[linha.matricula_id] = {
      media: linha.media === null ? null : Number(linha.media),
      frequencia: linha.frequencia === null ? null : Number(linha.frequencia),
      prontoParaEncerrar: Boolean(linha.pronto_para_encerrar),
    };
  }
  return resultado;
}

export async function encerrarMatricula(matriculaId: string): Promise<void> {
  const { error } = await diario().rpc("encerrar_matricula", { p_matricula_id: matriculaId });
  if (error) throw new Error(mensagemDeErroBanco(error));
}

// Coordenação desfaz o encerramento de um aluno. Motivo obrigatório (o
// banco exige 10+ caracteres e grava no histórico); se havia certificado,
// ele é revogado pelo próprio banco. Devolve quantos foram revogados.
export async function desfazerEncerramento(
  matriculaId: string,
  motivo: string,
): Promise<{ certificados_revogados: number }> {
  const { data, error } = await diario().rpc("desfazer_encerramento", {
    p_matricula_id: matriculaId,
    p_motivo: motivo,
  });
  if (error) throw new Error(mensagemDeErroBanco(error));
  return data as unknown as { certificados_revogados: number };
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

// Resumo devolvido por diario.reativar_turma (jsonb): quem voltou a
// "Cursando" e quem foi pulado, com o motivo (sem vaga, matrícula ativa em
// outra turma do mesmo módulo).
export interface ResumoReativacaoTurma {
  reativadas: number;
  puladas: number;
  alunos_reativados: Array<{ matricula_id: string; aluno_nome: string | null }>;
  alunos_pulados: Array<{ matricula_id: string; aluno_nome: string | null; motivo: string }>;
  certificados_revogados: number;
}

export async function reativarTurma(turmaId: string, motivo: string): Promise<ResumoReativacaoTurma> {
  const { data, error } = await diario().rpc("reativar_turma", { p_turma_id: turmaId, p_motivo: motivo });
  if (error) throw new Error(mensagemDeErroBanco(error));
  return data as unknown as ResumoReativacaoTurma;
}

// Histórico de encerrar/desfazer/reativar da turma, mais recente primeiro,
// com o nome de quem fez (realizado_por é só o id). A RLS libera para a
// coordenação e o professor da turma.
export interface RegistroDeEncerramento extends HistoricoEncerramento {
  realizadoPorNome: string | null;
}

export async function listarHistoricoEncerramentos(turmaId: string): Promise<RegistroDeEncerramento[]> {
  const { data, error } = await diario()
    .from("historico_encerramentos")
    .select("*")
    .eq("turma_id", turmaId)
    .order("realizado_em", { ascending: false });
  if (error) throw new Error(mensagemDeErroBanco(error));
  const nomes = await buscarNomesCompletos([
    ...new Set(data.flatMap((r) => (r.realizado_por ? [r.realizado_por] : []))),
  ]);
  return data.map((r) => ({
    ...r,
    realizadoPorNome: r.realizado_por ? (nomes.get(r.realizado_por) ?? null) : null,
  }));
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

/**
 * Ids das presenças das matrículas do aluno, por id → matrícula. Só serve
 * ao Realtime: o DELETE chega sem filtro e só com o id da linha apagada,
 * e é por esta lista que o aluno sabe se a exclusão é dele.
 */
export async function listarIdsDePresenca(matriculaIds: string[]): Promise<Map<string, string>> {
  if (matriculaIds.length === 0) return new Map();
  const { data, error } = await diario()
    .from("presencas")
    .select("id, matricula_id")
    .in("matricula_id", matriculaIds);
  if (error) throw new Error(mensagemDeErroBanco(error));
  return new Map((data ?? []).map((p) => [p.id, p.matricula_id]));
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
  /** Turno da turma e sala da aula, opcionais (UI Kit: "AM-2026-2 · Noite", "Sala 3"). */
  turmaTurno: string | null;
  sala: string | null;
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
      turmaTurno: turma?.turno ?? null,
      moduloNome: turma?.moduloNome ?? "—",
      horario: aula.horario,
      sala: aula.sala,
      totalAlunos: turma?.matriculados ?? 0,
      chamadaFeita: aulasComChamada.has(aula.id),
    };
  });
}

// "Esta semana" do professor: aulas de amanhã até daqui a 7 dias (as de
// hoje já estão em "Aulas de hoje"), com a situação da chamada — uma aula
// futura normalmente ainda não tem chamada, mas a chamada antecipada
// existe e aparece como feita.
export interface AulaDaSemana extends AulaDeHoje {
  data: string;
}

/** Data local N dias a partir de hoje, em AAAA-MM-DD. */
function diaRelativoISO(dias: number): string {
  const agora = new Date();
  const d = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function listarAulasDaSemanaDoProfessor(
  professorId: string,
  turmasConhecidas?: TurmaDoProfessor[],
): Promise<AulaDaSemana[]> {
  const turmas = turmasConhecidas ?? (await listarTurmasDoProfessor(professorId));
  if (turmas.length === 0) return [];

  const { data: aulas, error } = await diario()
    .from("aulas")
    .select("*")
    .in(
      "turma_id",
      turmas.map((t) => t.id),
    )
    .gte("data", diaRelativoISO(1))
    .lte("data", diaRelativoISO(7))
    .order("data")
    .order("horario");
  if (error) throw new Error(mensagemDeErroBanco(error));
  if (!aulas || aulas.length === 0) return [];

  const { data: presencas, error: erroPresencas } = await diario()
    .from("presencas")
    .select("aula_id")
    .in(
      "aula_id",
      aulas.map((a) => a.id),
    );
  if (erroPresencas) throw new Error(mensagemDeErroBanco(erroPresencas));
  const aulasComChamada = new Set((presencas ?? []).map((p) => p.aula_id));

  const turmaPorId = new Map(turmas.map((t) => [t.id, t]));
  return aulas.map((aula) => {
    const turma = turmaPorId.get(aula.turma_id);
    return {
      id: aula.id,
      data: aula.data,
      turmaId: aula.turma_id,
      turmaCodigo: turma?.codigo ?? "—",
      turmaTurno: turma?.turno ?? null,
      moduloNome: turma?.moduloNome ?? "—",
      horario: aula.horario,
      sala: aula.sala,
      totalAlunos: turma?.matriculados ?? 0,
      chamadaFeita: aulasComChamada.has(aula.id),
    };
  });
}

/**
 * Agrupa itens com `data` (AAAA-MM-DD) por dia, em ordem de data e
 * horário (ordena aqui: não depende da ordem em que o banco devolveu).
 */
export function agruparPorDia<T extends { data: string; horario?: string | null }>(
  itens: T[],
): Array<{ data: string; itens: T[] }> {
  const ordenados = [...itens].sort((a, b) =>
    a.data !== b.data ? (a.data < b.data ? -1 : 1) : (a.horario ?? "").localeCompare(b.horario ?? ""),
  );
  const grupos: Array<{ data: string; itens: T[] }> = [];
  for (const item of ordenados) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.data === item.data) ultimo.itens.push(item);
    else grupos.push({ data: item.data, itens: [item] });
  }
  return grupos;
}

export type TipoPendenciaProfessor =
  | "avaliacao_sem_nota"
  | "chamada_atrasada"
  /** Chamada não feita e prazo de 7 dias vencido: só com liberação da coordenação. */
  | "chamada_fora_do_prazo"
  | "turma_terminando";

export interface PendenciaProfessor {
  tipo: TipoPendenciaProfessor;
  titulo: string;
  detalhe: string;
  turmaId: string;
  aulaId?: string;
}

/**
 * Avaliações a que falta nota de algum aluno cursando. Nota de quem já foi
 * encerrado não conta (nem a favor nem contra): é a mesma regra no Hoje do
 * professor e no Resumo da turma.
 */
export function avaliacoesSemNota<A extends { id: string }>(
  avaliacoes: A[],
  notas: Array<{ avaliacaoId: string; matriculaId: string }>,
  matriculasAtivas: Iterable<string>,
): Array<{ avaliacao: A; faltam: number }> {
  const ativas = new Set(matriculasAtivas);
  const lancadas = new Map<string, number>();
  for (const n of notas) {
    if (ativas.has(n.matriculaId)) lancadas.set(n.avaliacaoId, (lancadas.get(n.avaliacaoId) ?? 0) + 1);
  }
  return avaliacoes
    .map((avaliacao) => ({ avaliacao, faltam: ativas.size - (lancadas.get(avaliacao.id) ?? 0) }))
    .filter((x) => x.faltam > 0);
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

  // Chamadas pendentes vêm prontas do banco (aula passada sem presença,
  // com a situação do prazo), em vez de trazer todas as presenças.
  const [avaliacoesResp, pendentesResp, listasDeAlunos] = await Promise.all([
    diario().from("avaliacoes").select("*").in("turma_id", turmaIds),
    diario().rpc("chamadas_pendentes"),
    Promise.all(turmas.map((t) => obterAlunos(t.id))),
  ]);
  if (avaliacoesResp.error) throw new Error(mensagemDeErroBanco(avaliacoesResp.error));
  if (pendentesResp.error) throw new Error(mensagemDeErroBanco(pendentesResp.error));

  const alunosPorTurmaId = new Map(turmas.map((t, i) => [t.id, listasDeAlunos[i]]));
  const turmaPorId = new Map(turmas.map((t) => [t.id, t]));

  const pendencias: PendenciaProfessor[] = [];

  const avaliacoes = avaliacoesResp.data ?? [];
  const avaliacaoIds = avaliacoes.map((a) => a.id);
  const { data: notas, error: erroNotas } =
    avaliacaoIds.length > 0
      ? await diario().from("notas").select("avaliacao_id, matricula_id").in("avaliacao_id", avaliacaoIds)
      : { data: [] as Array<{ avaliacao_id: string; matricula_id: string }>, error: null };
  if (erroNotas) throw new Error(mensagemDeErroBanco(erroNotas));

  // Avaliações sem nota completa — mesma conta do Resumo da turma.
  const notasLancadas = (notas ?? []).map((n) => ({ avaliacaoId: n.avaliacao_id, matriculaId: n.matricula_id }));
  for (const turma of turmas) {
    const daTurma = avaliacoes.filter((a) => a.turma_id === turma.id);
    const ativos = (alunosPorTurmaId.get(turma.id) ?? []).map((a) => a.matriculaId);
    for (const { avaliacao, faltam } of avaliacoesSemNota(daTurma, notasLancadas, ativos)) {
      pendencias.push({
        tipo: "avaliacao_sem_nota",
        titulo: `${avaliacao.titulo} sem nota para ${plural(faltam, "aluno", "alunos")}`,
        detalhe: `${turma.codigo} · ${turma.moduloNome}`,
        turmaId: turma.id,
      });
    }
  }

  // Chamadas atrasadas: aula já passou e não tem nenhuma presença
  // registrada. Com o prazo de 7 dias vencido (e sem liberação), o
  // professor não consegue mais fazê-la: a pendência vira pedir liberação.
  const turmasDoProfessor = new Set(turmaIds);
  for (const aula of pendentesResp.data ?? []) {
    if (!turmasDoProfessor.has(aula.turma_id)) continue;
    const turma = turmaPorId.get(aula.turma_id);
    const foraDoPrazo = (aula.situacao as SituacaoChamada) === "encerrada";
    pendencias.push({
      tipo: foraDoPrazo ? "chamada_fora_do_prazo" : "chamada_atrasada",
      titulo: foraDoPrazo
        ? `Chamada de ${formatarData(aula.data)} fora do prazo`
        : `Chamada de ${formatarData(aula.data)} não feita (até ${formatarData(aula.aberta_ate)})`,
      detalhe: foraDoPrazo
        ? `${turma?.codigo ?? "—"} · peça liberação à coordenação`
        : `${turma?.codigo ?? "—"} · Aula`,
      turmaId: aula.turma_id,
      aulaId: aula.aula_id,
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
          valor: formatarPercentual(p.frequencia),
        });
      } else if (p.media !== null && p.media < turma.trilhaMediaMinima) {
        resultado.push({
          alunoNome: aluno.alunoNome,
          turmaId: turma.id,
          turmaCodigo: turma.codigo,
          motivo: "média parcial",
          valor: formatarMedia(p.media),
        });
      }
    }
  }
  return resultado;
}

// ---------------------------------------------------------------------
// D4 (klass-uikit.pdf) — tela "Início" do aluno.
// ---------------------------------------------------------------------

/**
 * "Você pode faltar mais N aulas" (pág. 4 do UI Kit). Conta sobre as aulas
 * já cadastradas da turma: o limite de faltas é a parte delas que a
 * frequência mínima deixa de fora (arredondada para baixo), menos as
 * faltas já registradas. Negativo = o aluno já passou do limite.
 */
export interface MargemDeFaltas {
  totalAulas: number;
  faltas: number;
  limite: number;
  restantes: number;
}

export function calcularMargemDeFaltas(
  aulas: AulaComPresenca[],
  frequenciaMinimaPercentual: number,
): MargemDeFaltas {
  const totalAulas = aulas.length;
  const faltas = aulas.filter((a) => a.presente === false).length;
  const limite = Math.floor(totalAulas * (1 - frequenciaMinimaPercentual / 100));
  return { totalAulas, faltas, limite, restantes: limite - faltas };
}

export interface ProximoPassoAluno {
  trilhaNome: string;
  trilhaSlug: string;
  modulosConcluidos: number;
  totalModulos: number;
  moduloAtualNome: string;
  tipoCertificacao: TipoCertificacao;
  matriculaId: string;
  turmaId: string;
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
    tipoCertificacao: trilha.tipo_certificacao,
    matriculaId: escolha.matricula.id,
    turmaId: escolha.matricula.turmaId,
    frequenciaAtual: progresso.frequencia,
    frequenciaMinima: escolha.matricula.frequenciaMinimaPercentual,
  };
}

export interface NovidadeAluno {
  /** Decide o ícone na tela (nota lançada ou matrícula confirmada). */
  tipo: "nota" | "matricula";
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
      tipo: "nota" as const,
      texto: `Nota publicada: ${tituloPorAvaliacao.get(n.avaliacao_id) ?? "Avaliação"} · ${formatarNota(n.valor)}`,
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
      tipo: "matricula" as const,
      texto: `Matrícula confirmada em ${m.turmaCodigo}`,
      detalhe: m.moduloNome,
      quando: m.deferidoEm as string,
    }));

  return [...eventosNota, ...eventosMatricula]
    .sort((a, b) => (a.quando < b.quando ? 1 : -1))
    .slice(0, 5);
}

// ---------------------------------------------------------------------
// "Esta semana" do aluno.
// ---------------------------------------------------------------------

export interface AulaDaSemanaDoAluno {
  id: string;
  data: string;
  horario: string | null;
  turmaCodigo: string;
  moduloNome: string;
  /** null = chamada ainda não feita. */
  presente: boolean | null;
}

/**
 * Pura: das aulas (em cache, por matrícula) das turmas que o aluno está
 * cursando, as de hoje até daqui a 6 dias — sete dias contando hoje.
 */
export function montarAulasDaSemanaDoAluno(
  porMatricula: Array<{ matricula: MatriculaDoAluno; aulas: AulaComPresenca[] }>,
): AulaDaSemanaDoAluno[] {
  const inicio = hojeISO();
  const fim = diaRelativoISO(6);
  return porMatricula
    .flatMap(({ matricula, aulas }) =>
      aulas
        .filter((a) => a.data >= inicio && a.data <= fim)
        .map((a) => ({
          id: a.id,
          data: a.data,
          horario: a.horario,
          turmaCodigo: matricula.turmaCodigo,
          moduloNome: matricula.moduloNome,
          presente: a.presente,
        })),
    )
    .sort((a, b) =>
      a.data !== b.data ? (a.data < b.data ? -1 : 1) : (a.horario ?? "").localeCompare(b.horario ?? ""),
    );
}

export interface NotaDaSemana {
  avaliacaoTitulo: string;
  valor: number;
  moduloNome: string;
  lancadaEm: string;
}

/** Notas do aluno lançadas (ou alteradas) nos últimos 7 dias, da mais recente à mais antiga. */
export async function listarNotasDaSemanaDoAluno(matriculas: MatriculaDoAluno[]): Promise<NotaDaSemana[]> {
  if (matriculas.length === 0) return [];
  const matriculaPorId = new Map(matriculas.map((m) => [m.id, m]));
  const agora = new Date();
  const desde = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 6).toISOString();

  const { data: notas, error } = await diario()
    .from("notas")
    .select("matricula_id, valor, lancada_em, avaliacao_id")
    .in("matricula_id", [...matriculaPorId.keys()])
    .gte("lancada_em", desde)
    .order("lancada_em", { ascending: false });
  if (error) throw new Error(mensagemDeErroBanco(error));
  if (!notas || notas.length === 0) return [];

  const avaliacaoIds = [...new Set(notas.map((n) => n.avaliacao_id))];
  const { data: avaliacoes, error: erroAval } = await diario()
    .from("avaliacoes")
    .select("id, titulo")
    .in("id", avaliacaoIds);
  if (erroAval) throw new Error(mensagemDeErroBanco(erroAval));
  const tituloPorAvaliacao = new Map((avaliacoes ?? []).map((a) => [a.id, a.titulo]));

  return notas.map((n) => ({
    avaliacaoTitulo: tituloPorAvaliacao.get(n.avaliacao_id) ?? "Avaliação",
    valor: Number(n.valor),
    moduloNome: matriculaPorId.get(n.matricula_id)?.moduloNome ?? "—",
    lancadaEm: n.lancada_em,
  }));
}

export type { Aula, Avaliacao };
