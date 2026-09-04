import { supabase } from "@/lib/supabase";
import { mensagemDeErroBanco } from "@/lib/mensagensDeErroBanco";
import type { Matricula, StatusMatricula, Turma } from "@klass/types";

// Ponto único de acesso a selecao.* — mesmo padrão de apps/web/src/lib/catalogo.ts.
function selecao() {
  if (!supabase) throw new Error("Supabase não configurado.");
  return supabase.schema("selecao");
}

function catalogo() {
  if (!supabase) throw new Error("Supabase não configurado.");
  return supabase.schema("catalogo");
}

function identidade() {
  if (!supabase) throw new Error("Supabase não configurado.");
  return supabase.schema("identidade");
}

// RLS de identidade.profiles só deixa ler o próprio perfil (ou tudo, se
// coordenação) — insuficiente aqui, onde aluno precisa ver nome do
// professor da turma e professor precisa ver nome dos alunos matriculados.
// identidade.nomes_completos() é uma função "diretório" (só id + nome) que
// contorna essa RLS de propósito, sem expor papel ou outras colunas.
async function buscarNomesCompletos(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await identidade().rpc("nomes_completos", { p_ids: ids });
  if (error) throw new Error(mensagemDeErroBanco(error));
  return new Map((data ?? []).map((p) => [p.id, p.nome_completo]));
}

export interface TurmaListagem {
  id: string;
  codigo: string;
  trilhaId: string;
  trilhaNome: string;
  professorNome: string;
  periodoInicio: string;
  periodoFim: string;
  vagasTotal: number;
  matriculados: number;
  pendentes: number;
}

// Junta em código, não via embed do PostgREST: turmas referencia
// catalogo.trilhas e identidade.profiles, schemas diferentes do que a
// query "principal" — mesma estratégia de apps/web/src/lib/catalogo.ts.
export async function listarTurmasParaCoordenacao(): Promise<TurmaListagem[]> {
  const { data: turmas, error } = await selecao()
    .from("turmas")
    .select("*")
    .order("periodo_inicio", { ascending: false });
  if (error) throw new Error(mensagemDeErroBanco(error));
  if (turmas.length === 0) return [];

  const trilhaIds = [...new Set(turmas.map((t) => t.trilha_id))];
  const professorIds = [...new Set(turmas.map((t) => t.professor_id))];
  const turmaIds = turmas.map((t) => t.id);

  const [trilhasResp, nomeProfessor, matriculasResp] = await Promise.all([
    catalogo().from("trilhas").select("id, nome").in("id", trilhaIds),
    buscarNomesCompletos(professorIds),
    selecao().from("matriculas").select("turma_id, status").in("turma_id", turmaIds),
  ]);
  if (trilhasResp.error) throw new Error(mensagemDeErroBanco(trilhasResp.error));
  if (matriculasResp.error) throw new Error(mensagemDeErroBanco(matriculasResp.error));

  const nomeTrilha = new Map((trilhasResp.data ?? []).map((t) => [t.id, t.nome]));

  return turmas.map((turma) => {
    const doTurma = (matriculasResp.data ?? []).filter((m) => m.turma_id === turma.id);
    return {
      id: turma.id,
      codigo: turma.codigo,
      trilhaId: turma.trilha_id,
      trilhaNome: nomeTrilha.get(turma.trilha_id) ?? "—",
      professorNome: nomeProfessor.get(turma.professor_id) ?? "—",
      periodoInicio: turma.periodo_inicio,
      periodoFim: turma.periodo_fim,
      vagasTotal: turma.vagas_total,
      matriculados: doTurma.filter((m) => m.status === "matriculada").length,
      pendentes: doTurma.filter((m) => m.status === "inscrita").length,
    };
  });
}

export interface TurmaDetalhada {
  id: string;
  codigo: string;
  trilhaNome: string;
  professorNome: string;
  periodoInicio: string;
  periodoFim: string;
  vagasTotal: number;
}

export async function buscarTurmaDetalhada(turmaId: string): Promise<TurmaDetalhada | null> {
  const { data: turma, error } = await selecao()
    .from("turmas")
    .select("*")
    .eq("id", turmaId)
    .maybeSingle();
  if (error) throw new Error(mensagemDeErroBanco(error));
  if (!turma) return null;

  const [trilhaResp, nomeProfessor] = await Promise.all([
    catalogo().from("trilhas").select("nome").eq("id", turma.trilha_id).single(),
    buscarNomesCompletos([turma.professor_id]),
  ]);
  if (trilhaResp.error) throw new Error(mensagemDeErroBanco(trilhaResp.error));

  return {
    id: turma.id,
    codigo: turma.codigo,
    trilhaNome: trilhaResp.data.nome,
    professorNome: nomeProfessor.get(turma.professor_id) ?? "—",
    periodoInicio: turma.periodo_inicio,
    periodoFim: turma.periodo_fim,
    vagasTotal: turma.vagas_total,
  };
}

export interface MatriculaListagem {
  id: string;
  alunoNome: string;
  status: StatusMatricula;
  motivoRejeicao: string | null;
  criadoEm: string;
}

export async function listarMatriculasDaTurma(turmaId: string): Promise<MatriculaListagem[]> {
  const { data: matriculas, error } = await selecao()
    .from("matriculas")
    .select("*")
    .eq("turma_id", turmaId)
    .order("criado_em", { ascending: true });
  if (error) throw new Error(mensagemDeErroBanco(error));
  if (matriculas.length === 0) return [];

  const alunoIds = [...new Set(matriculas.map((m) => m.aluno_id))];
  const nomeAluno = await buscarNomesCompletos(alunoIds);

  return matriculas.map((m) => ({
    id: m.id,
    alunoNome: nomeAluno.get(m.aluno_id) ?? "—",
    status: m.status,
    motivoRejeicao: m.motivo_rejeicao,
    criadoEm: m.criado_em,
  }));
}

export async function listarProfessores(): Promise<Array<{ id: string; nomeCompleto: string }>> {
  const { data, error } = await identidade()
    .from("profiles")
    .select("id, nome_completo")
    .eq("papel", "professor")
    .order("nome_completo");
  if (error) throw new Error(mensagemDeErroBanco(error));
  return (data ?? []).map((p) => ({ id: p.id, nomeCompleto: p.nome_completo }));
}

export async function criarTurma(input: {
  trilhaId: string;
  codigo: string;
  professorId: string;
  periodoInicio: string;
  periodoFim: string;
  vagasTotal: number;
}): Promise<Turma> {
  const { data, error } = await selecao()
    .from("turmas")
    .insert({
      trilha_id: input.trilhaId,
      codigo: input.codigo,
      professor_id: input.professorId,
      periodo_inicio: input.periodoInicio,
      periodo_fim: input.periodoFim,
      vagas_total: input.vagasTotal,
    })
    .select("*")
    .single();
  if (error) throw new Error(mensagemDeErroBanco(error));
  return data;
}

export async function aprovarMatricula(matriculaId: string, deferidoPor: string): Promise<void> {
  const { error } = await selecao()
    .from("matriculas")
    .update({ status: "matriculada", deferido_por: deferidoPor })
    .eq("id", matriculaId);
  if (error) throw new Error(mensagemDeErroBanco(error));
}

export async function rejeitarMatricula(
  matriculaId: string,
  deferidoPor: string,
  motivo: string,
): Promise<void> {
  const { error } = await selecao()
    .from("matriculas")
    .update({ status: "rejeitada", deferido_por: deferidoPor, motivo_rejeicao: motivo })
    .eq("id", matriculaId);
  if (error) throw new Error(mensagemDeErroBanco(error));
}

export async function inscreverAluno(turmaId: string): Promise<string> {
  const { data, error } = await selecao().rpc("inscrever_aluno", { p_turma_id: turmaId });
  if (error) throw new Error(mensagemDeErroBanco(error));
  return data;
}

export async function cancelarInscricao(matriculaId: string): Promise<void> {
  const { error } = await selecao().rpc("cancelar_inscricao", { p_matricula_id: matriculaId });
  if (error) throw new Error(mensagemDeErroBanco(error));
}

export interface MatriculaDoAluno {
  id: string;
  status: StatusMatricula;
  turmaCodigo: string;
  trilhaNome: string;
  professorNome: string;
  periodoInicio: string;
  periodoFim: string;
}

export async function listarMatriculasDoAluno(alunoId: string): Promise<MatriculaDoAluno[]> {
  const { data: matriculas, error } = await selecao()
    .from("matriculas")
    .select("*")
    .eq("aluno_id", alunoId)
    .order("criado_em", { ascending: false });
  if (error) throw new Error(mensagemDeErroBanco(error));
  if (matriculas.length === 0) return [];

  const turmaIds = [...new Set(matriculas.map((m) => m.turma_id))];
  const { data: turmas, error: erroTurmas } = await selecao()
    .from("turmas")
    .select("*")
    .in("id", turmaIds);
  if (erroTurmas) throw new Error(mensagemDeErroBanco(erroTurmas));

  const trilhaIds = [...new Set((turmas ?? []).map((t) => t.trilha_id))];
  const professorIds = [...new Set((turmas ?? []).map((t) => t.professor_id))];

  const [trilhasResp, nomeProfessor] = await Promise.all([
    catalogo().from("trilhas").select("id, nome").in("id", trilhaIds),
    buscarNomesCompletos(professorIds),
  ]);
  if (trilhasResp.error) throw new Error(mensagemDeErroBanco(trilhasResp.error));

  const turmaPorId = new Map((turmas ?? []).map((t) => [t.id, t]));
  const nomeTrilha = new Map((trilhasResp.data ?? []).map((t) => [t.id, t.nome]));

  return matriculas.map((m) => {
    const turma = turmaPorId.get(m.turma_id);
    return {
      id: m.id,
      status: m.status,
      turmaCodigo: turma?.codigo ?? "—",
      trilhaNome: turma ? (nomeTrilha.get(turma.trilha_id) ?? "—") : "—",
      professorNome: turma ? (nomeProfessor.get(turma.professor_id) ?? "—") : "—",
      periodoInicio: turma?.periodo_inicio ?? "",
      periodoFim: turma?.periodo_fim ?? "",
    };
  });
}

export interface TurmaDoProfessor {
  id: string;
  codigo: string;
  trilhaNome: string;
  periodoInicio: string;
  periodoFim: string;
  matriculados: number;
}

export async function listarTurmasDoProfessor(professorId: string): Promise<TurmaDoProfessor[]> {
  const { data: turmas, error } = await selecao()
    .from("turmas")
    .select("*")
    .eq("professor_id", professorId)
    .order("periodo_inicio", { ascending: false });
  if (error) throw new Error(mensagemDeErroBanco(error));
  if (turmas.length === 0) return [];

  const trilhaIds = [...new Set(turmas.map((t) => t.trilha_id))];
  const turmaIds = turmas.map((t) => t.id);

  const [trilhasResp, matriculasResp] = await Promise.all([
    catalogo().from("trilhas").select("id, nome").in("id", trilhaIds),
    selecao().from("matriculas").select("turma_id, status").in("turma_id", turmaIds),
  ]);
  if (trilhasResp.error) throw new Error(mensagemDeErroBanco(trilhasResp.error));
  if (matriculasResp.error) throw new Error(mensagemDeErroBanco(matriculasResp.error));

  const nomeTrilha = new Map((trilhasResp.data ?? []).map((t) => [t.id, t.nome]));

  return turmas.map((turma) => ({
    id: turma.id,
    codigo: turma.codigo,
    trilhaNome: nomeTrilha.get(turma.trilha_id) ?? "—",
    periodoInicio: turma.periodo_inicio,
    periodoFim: turma.periodo_fim,
    matriculados: (matriculasResp.data ?? []).filter(
      (m) => m.turma_id === turma.id && m.status === "matriculada",
    ).length,
  }));
}

export interface TurmaDisponivel {
  id: string;
  codigo: string;
  professorNome: string;
  periodoInicio: string;
  periodoFim: string;
  vagasRestantes: number;
  /** Situação do aluno atual nesta turma, se houver. */
  minhaMatricula: { id: string; status: StatusMatricula } | null;
}

/** Turmas de uma trilha para a tela pública — já cruza com a matrícula do próprio aluno, se houver. */
export async function listarTurmasDisponiveisDaTrilha(
  trilhaId: string,
  alunoId: string | null,
): Promise<TurmaDisponivel[]> {
  const { data: turmas, error } = await selecao()
    .from("turmas")
    .select("*")
    .eq("trilha_id", trilhaId)
    .order("periodo_inicio", { ascending: true });
  if (error) throw new Error(mensagemDeErroBanco(error));
  if (turmas.length === 0) return [];

  const turmaIds = turmas.map((t) => t.id);
  const professorIds = [...new Set(turmas.map((t) => t.professor_id))];

  const [nomeProfessor, matriculasResp, minhasMatriculasResp] = await Promise.all([
    buscarNomesCompletos(professorIds),
    selecao().from("matriculas").select("turma_id, status").in("turma_id", turmaIds),
    alunoId
      ? selecao().from("matriculas").select("id, turma_id, status").eq("aluno_id", alunoId).in("turma_id", turmaIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (matriculasResp.error) throw new Error(mensagemDeErroBanco(matriculasResp.error));
  if (minhasMatriculasResp.error) throw new Error(mensagemDeErroBanco(minhasMatriculasResp.error));

  const minhaPorTurma = new Map(
    (minhasMatriculasResp.data ?? []).map((m) => [m.turma_id, { id: m.id, status: m.status }]),
  );

  return turmas.map((turma) => {
    const ocupadas = (matriculasResp.data ?? []).filter(
      (m) => m.turma_id === turma.id && (m.status === "inscrita" || m.status === "matriculada"),
    ).length;
    return {
      id: turma.id,
      codigo: turma.codigo,
      professorNome: nomeProfessor.get(turma.professor_id) ?? "—",
      periodoInicio: turma.periodo_inicio,
      periodoFim: turma.periodo_fim,
      vagasRestantes: turma.vagas_total - ocupadas,
      minhaMatricula: minhaPorTurma.get(turma.id) ?? null,
    };
  });
}

// ---- Pré-requisitos ENTRE TRILHAS (usado na edição de trilha do MS2) ----
// Nome diferente de catalogo.listarPreRequisitosIdsDaTrilha() de propósito
// — aquela é sobre módulos DENTRO de uma trilha; esta é sobre trilhas
// inteiras que essa trilha exige.

export async function listarIdsTrilhasRequisito(trilhaId: string): Promise<string[]> {
  const { data, error } = await selecao()
    .from("pre_requisitos_trilha")
    .select("trilha_requisito_id")
    .eq("trilha_id", trilhaId);
  if (error) throw new Error(mensagemDeErroBanco(error));
  return (data ?? []).map((linha) => linha.trilha_requisito_id);
}

export async function definirPreRequisitoTrilha(
  trilhaId: string,
  trilhaRequisitoId: string,
  ativo: boolean,
): Promise<void> {
  if (ativo) {
    const { error } = await selecao()
      .from("pre_requisitos_trilha")
      .insert({ trilha_id: trilhaId, trilha_requisito_id: trilhaRequisitoId });
    if (error) throw new Error(mensagemDeErroBanco(error));
    return;
  }
  const { error } = await selecao()
    .from("pre_requisitos_trilha")
    .delete()
    .eq("trilha_id", trilhaId)
    .eq("trilha_requisito_id", trilhaRequisitoId);
  if (error) throw new Error(mensagemDeErroBanco(error));
}

export type { Matricula, StatusMatricula, Turma };
