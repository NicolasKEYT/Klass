import { supabase } from "@/lib/supabase";
import { mensagemDeErroBanco } from "@/lib/mensagensDeErroBanco";
import { listarMatriculasDaTurma } from "@/lib/selecao";
import type { Aula, Avaliacao, StatusMatricula } from "@klass/types";

function diario() {
  if (!supabase) throw new Error("Supabase não configurado.");
  return supabase.schema("diario");
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

export type { Aula, Avaliacao };
