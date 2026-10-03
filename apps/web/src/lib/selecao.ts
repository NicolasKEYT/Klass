import { supabase } from "@/lib/supabase";
import { mensagemDeErroBanco } from "@/lib/mensagensDeErroBanco";
import { listarModulosDaTrilha } from "@/lib/catalogo";
import type { Matricula, Modulo, StatusMatricula, Turma } from "@klass/types";

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

interface ContextoModulo {
  nome: string;
  trilhaId: string;
  trilhaNome: string;
  trilhaMediaMinima: number;
}

// turma referencia um módulo, não uma trilha inteira — para exibir "qual
// disciplina, de qual trilha" numa tela, precisa desse salto extra
// (turma -> catalogo.modulos -> catalogo.trilhas). trilhaMediaMinima vem
// junto porque diario.encerrar_matricula usa esse valor no lugar do
// antigo literal 6.0 (ver migration certificacao_por_modulo) — telas que
// explicam "para ser aprovado" precisam do valor real da trilha.
async function buscarContextoModulos(moduloIds: string[]): Promise<Map<string, ContextoModulo>> {
  if (moduloIds.length === 0) return new Map();
  const { data: modulos, error } = await catalogo()
    .from("modulos")
    .select("id, nome, trilha_id")
    .in("id", moduloIds);
  if (error) throw new Error(mensagemDeErroBanco(error));

  const trilhaIds = [...new Set((modulos ?? []).map((m) => m.trilha_id))];
  const { data: trilhas, error: erroTrilhas } = await catalogo()
    .from("trilhas")
    .select("id, nome, media_minima")
    .in("id", trilhaIds);
  if (erroTrilhas) throw new Error(mensagemDeErroBanco(erroTrilhas));

  const trilhaPorId = new Map((trilhas ?? []).map((t) => [t.id, t]));
  return new Map(
    (modulos ?? []).map((m) => {
      const trilha = trilhaPorId.get(m.trilha_id);
      return [
        m.id,
        {
          nome: m.nome,
          trilhaId: m.trilha_id,
          trilhaNome: trilha?.nome ?? "—",
          trilhaMediaMinima: trilha ? Number(trilha.media_minima) : 6,
        },
      ];
    }),
  );
}

export interface TurmaListagem {
  id: string;
  codigo: string;
  moduloId: string;
  moduloNome: string;
  trilhaNome: string;
  professorNome: string;
  periodoInicio: string;
  periodoFim: string;
  vagasTotal: number;
  matriculados: number;
  pendentes: number;
}

// Junta em código, não via embed do PostgREST: turmas referencia
// catalogo.modulos/trilhas e identidade.profiles, schemas diferentes do
// que a query "principal" — mesma estratégia de apps/web/src/lib/catalogo.ts.
export async function listarTurmasParaCoordenacao(): Promise<TurmaListagem[]> {
  const { data: turmas, error } = await selecao()
    .from("turmas")
    .select("*")
    .order("periodo_inicio", { ascending: false });
  if (error) throw new Error(mensagemDeErroBanco(error));
  if (turmas.length === 0) return [];

  const moduloIds = [...new Set(turmas.map((t) => t.modulo_id))];
  const professorIds = [...new Set(turmas.map((t) => t.professor_id))];
  const turmaIds = turmas.map((t) => t.id);

  const [contextoModulo, nomeProfessor, matriculasResp] = await Promise.all([
    buscarContextoModulos(moduloIds),
    buscarNomesCompletos(professorIds),
    selecao().from("matriculas").select("turma_id, status").in("turma_id", turmaIds),
  ]);
  if (matriculasResp.error) throw new Error(mensagemDeErroBanco(matriculasResp.error));

  return turmas.map((turma) => {
    const doTurma = (matriculasResp.data ?? []).filter((m) => m.turma_id === turma.id);
    const contexto = contextoModulo.get(turma.modulo_id);
    return {
      id: turma.id,
      codigo: turma.codigo,
      moduloId: turma.modulo_id,
      moduloNome: contexto?.nome ?? "—",
      trilhaNome: contexto?.trilhaNome ?? "—",
      professorNome: nomeProfessor.get(turma.professor_id) ?? "—",
      periodoInicio: turma.periodo_inicio,
      periodoFim: turma.periodo_fim,
      vagasTotal: turma.vagas_total,
      matriculados: doTurma.filter((m) => m.status === "matriculada").length,
      pendentes: doTurma.filter((m) => m.status === "inscrita").length,
    };
  });
}

export type SituacaoTurma = "futura" | "em_andamento" | "aguardando_encerramento" | "encerrada";

// Ainda não existe estado de turma no banco: a situação é derivada aqui.
// "encerrada" = período terminado E nenhuma matrícula ativa (inscrita ou
// matriculada); período terminado com aluno ativo = "aguardando
// encerramento" (falta o professor encerrar os alunos). Quando houver um
// estado próprio de turma no banco, esta função passa a só lê-lo.
export function situacaoDaTurma(
  turma: Pick<TurmaListagem, "periodoInicio" | "periodoFim" | "matriculados" | "pendentes">,
  hoje: string,
): SituacaoTurma {
  if (turma.periodoInicio > hoje) return "futura";
  if (turma.periodoFim >= hoje) return "em_andamento";
  return turma.matriculados + turma.pendentes > 0 ? "aguardando_encerramento" : "encerrada";
}

export interface TurmaDetalhada {
  id: string;
  codigo: string;
  moduloId: string;
  moduloNome: string;
  trilhaId: string;
  trilhaNome: string;
  /** Grade de notas mostra isto como informação read-only no toolbar (D6). */
  trilhaMediaMinima: number;
  professorId: string;
  professorNome: string;
  periodoInicio: string;
  periodoFim: string;
  vagasTotal: number;
  frequenciaMinimaPercentual: number;
}

export async function buscarTurmaDetalhada(turmaId: string): Promise<TurmaDetalhada | null> {
  const { data: turma, error } = await selecao()
    .from("turmas")
    .select("*")
    .eq("id", turmaId)
    .maybeSingle();
  if (error) throw new Error(mensagemDeErroBanco(error));
  if (!turma) return null;

  const [contextoModulo, nomeProfessor] = await Promise.all([
    buscarContextoModulos([turma.modulo_id]),
    buscarNomesCompletos([turma.professor_id]),
  ]);
  const contexto = contextoModulo.get(turma.modulo_id);

  return {
    id: turma.id,
    codigo: turma.codigo,
    moduloId: turma.modulo_id,
    moduloNome: contexto?.nome ?? "—",
    trilhaId: contexto?.trilhaId ?? "",
    trilhaNome: contexto?.trilhaNome ?? "—",
    trilhaMediaMinima: contexto?.trilhaMediaMinima ?? 6,
    professorId: turma.professor_id,
    professorNome: nomeProfessor.get(turma.professor_id) ?? "—",
    periodoInicio: turma.periodo_inicio,
    periodoFim: turma.periodo_fim,
    vagasTotal: turma.vagas_total,
    frequenciaMinimaPercentual: turma.frequencia_minima_percentual,
  };
}

export interface MatriculaListagem {
  id: string;
  alunoNome: string;
  status: StatusMatricula;
  motivoRejeicao: string | null;
  motivoConclusao: string | null;
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
    motivoConclusao: m.motivo_conclusao,
    criadoEm: m.criado_em,
  }));
}

// Coordenação desliga um aluno já matriculado (status -> cancelada, com
// motivo). Ver migration remover_aluno_da_turma.
export async function removerAlunoDaTurma(matriculaId: string, motivo: string): Promise<void> {
  const { error } = await selecao().rpc("remover_aluno_da_turma", {
    p_matricula_id: matriculaId,
    p_motivo: motivo,
  });
  if (error) throw new Error(mensagemDeErroBanco(error));
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

// Faixa de datas aceita no período da turma. Espelha o check
// turmas_periodo_ano_razoavel no banco; aqui limita o input de data
// nativo (via min/max) para não deixar digitar um ano de 5 dígitos.
export const PERIODO_TURMA_DATA_MIN = "2000-01-01";
export const PERIODO_TURMA_DATA_MAX = "2100-12-31";

export const MENSAGEM_ANO_PERIODO_TURMA = "O ano das datas do período precisa estar entre 2000 e 2100.";

// Validação de conveniência antes de enviar (a garantia é do banco).
// Retorna a mensagem de erro em português, ou null se estiver ok. A data
// inteira é conferida (não só os 4 primeiros caracteres): o input nativo
// aceita digitar um ano de 5 dígitos ("20261-05-01"), que passava.
export function validarPeriodoTurma(inicio: string, fim: string): string | null {
  if (!inicio || !fim) return "Preencha as datas de início e fim do período.";
  const formato = /^\d{4}-\d{2}-\d{2}$/;
  if (!formato.test(inicio) || !formato.test(fim)) return MENSAGEM_ANO_PERIODO_TURMA;
  if (inicio < PERIODO_TURMA_DATA_MIN || inicio > PERIODO_TURMA_DATA_MAX) return MENSAGEM_ANO_PERIODO_TURMA;
  if (fim < PERIODO_TURMA_DATA_MIN || fim > PERIODO_TURMA_DATA_MAX) return MENSAGEM_ANO_PERIODO_TURMA;
  if (fim <= inicio) return "O período final precisa vir depois do início.";
  return null;
}

export const AJUDA_CODIGO_TURMA =
  "2 ou 3 partes de letras maiúsculas e números separadas por hífen; a primeira com pelo menos 2 caracteres; até 30 caracteres, sem espaços nem acentos. Ex.: CDA-2026-1.";

// Mesma regra do check turmas_codigo_formato (migration
// 20260923120000_turmas_edicao_validacoes): validação enquanto digita.
export function validarCodigoTurma(codigo: string): string | null {
  if (codigo.length > 30) return "O código pode ter no máximo 30 caracteres.";
  if (/\s/.test(codigo)) return "O código não pode ter espaços.";
  if (!/^[A-Z0-9]{2,}(-[A-Z0-9]+){1,2}$/.test(codigo)) return `Código fora do formato: ${AJUDA_CODIGO_TURMA}`;
  return null;
}

/** Outras turmas do mesmo módulo cujo período se sobrepõe ao informado. */
export function turmasSobrepostas<T extends { id: string; moduloId: string; periodoInicio: string; periodoFim: string }>(
  turmas: T[],
  moduloId: string,
  inicio: string,
  fim: string,
  ignorarId?: string,
): T[] {
  if (!moduloId || !inicio || !fim) return [];
  return turmas.filter(
    (t) => t.id !== ignorarId && t.moduloId === moduloId && t.periodoInicio <= fim && t.periodoFim >= inicio,
  );
}

export async function criarTurma(input: {
  moduloId: string;
  codigo: string;
  professorId: string;
  periodoInicio: string;
  periodoFim: string;
  vagasTotal: number;
  frequenciaMinimaPercentual: number;
}): Promise<Turma> {
  const { data, error } = await selecao()
    .from("turmas")
    .insert({
      modulo_id: input.moduloId,
      codigo: input.codigo,
      professor_id: input.professorId,
      periodo_inicio: input.periodoInicio,
      periodo_fim: input.periodoFim,
      vagas_total: input.vagasTotal,
      frequencia_minima_percentual: input.frequenciaMinimaPercentual,
    })
    .select("*")
    .single();
  if (error) throw new Error(mensagemDeErroBanco(error));
  return data;
}

// Edição de turma já criada (item 7). Código, professor, período, vagas e
// frequência mínima são todos editáveis; o banco é quem impede reduzir
// vagas abaixo dos já matriculados (trigger
// turmas_impedir_vagas_abaixo_dos_matriculados).
export async function atualizarTurma(
  turmaId: string,
  input: {
    codigo: string;
    professorId: string;
    periodoInicio: string;
    periodoFim: string;
    vagasTotal: number;
    frequenciaMinimaPercentual: number;
  },
): Promise<Turma> {
  const { data, error } = await selecao()
    .from("turmas")
    .update({
      codigo: input.codigo,
      professor_id: input.professorId,
      periodo_inicio: input.periodoInicio,
      periodo_fim: input.periodoFim,
      vagas_total: input.vagasTotal,
      frequencia_minima_percentual: input.frequenciaMinimaPercentual,
    })
    .eq("id", turmaId)
    .select("*")
    .single();
  if (error) throw new Error(mensagemDeErroBanco(error));
  return data;
}

export interface MatriculaDetalhada {
  id: string;
  status: StatusMatricula;
  motivoConclusao: string | null;
  turmaId: string;
  turmaCodigo: string;
  moduloNome: string;
  trilhaNome: string;
  professorNome: string;
  periodoInicio: string;
  periodoFim: string;
}

export async function buscarMatriculaDetalhada(matriculaId: string): Promise<MatriculaDetalhada | null> {
  const { data: matricula, error } = await selecao()
    .from("matriculas")
    .select("*")
    .eq("id", matriculaId)
    .maybeSingle();
  if (error) throw new Error(mensagemDeErroBanco(error));
  if (!matricula) return null;

  const turma = await buscarTurmaDetalhada(matricula.turma_id);
  if (!turma) return null;

  return {
    id: matricula.id,
    status: matricula.status,
    motivoConclusao: matricula.motivo_conclusao,
    turmaId: turma.id,
    turmaCodigo: turma.codigo,
    moduloNome: turma.moduloNome,
    trilhaNome: turma.trilhaNome,
    professorNome: turma.professorNome,
    periodoInicio: turma.periodoInicio,
    periodoFim: turma.periodoFim,
  };
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
  turmaId: string;
  turmaCodigo: string;
  moduloId: string;
  moduloNome: string;
  trilhaId: string;
  trilhaNome: string;
  trilhaMediaMinima: number;
  professorNome: string;
  periodoInicio: string;
  periodoFim: string;
  frequenciaMinimaPercentual: number;
  /** Motivo de encerramento/remoção (preenchido em cancelada/concluida/reprovada). */
  motivoConclusao: string | null;
  /** Quando a matrícula foi deferida (aceita) — usado no feed de novidades. */
  deferidoEm: string | null;
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

  const moduloIds = [...new Set((turmas ?? []).map((t) => t.modulo_id))];
  const professorIds = [...new Set((turmas ?? []).map((t) => t.professor_id))];

  const [contextoModulo, nomeProfessor] = await Promise.all([
    buscarContextoModulos(moduloIds),
    buscarNomesCompletos(professorIds),
  ]);

  const turmaPorId = new Map((turmas ?? []).map((t) => [t.id, t]));

  return matriculas.map((m) => {
    const turma = turmaPorId.get(m.turma_id);
    const contexto = turma ? contextoModulo.get(turma.modulo_id) : undefined;
    return {
      id: m.id,
      status: m.status,
      turmaId: m.turma_id,
      turmaCodigo: turma?.codigo ?? "—",
      moduloId: turma?.modulo_id ?? "",
      moduloNome: contexto?.nome ?? "—",
      trilhaId: contexto?.trilhaId ?? "",
      trilhaNome: contexto?.trilhaNome ?? "—",
      trilhaMediaMinima: contexto?.trilhaMediaMinima ?? 6,
      professorNome: turma ? nomeProfessor.get(turma.professor_id) ?? "—" : "—",
      periodoInicio: turma?.periodo_inicio ?? "",
      periodoFim: turma?.periodo_fim ?? "",
      frequenciaMinimaPercentual: turma?.frequencia_minima_percentual ?? 75,
      motivoConclusao: m.motivo_conclusao,
      deferidoEm: m.deferido_em,
    };
  });
}

export interface TurmaDoProfessor {
  id: string;
  codigo: string;
  moduloNome: string;
  trilhaNome: string;
  periodoInicio: string;
  periodoFim: string;
  matriculados: number;
  /** Critérios de aprovação — o "Hoje" compara frequência/média com eles. */
  frequenciaMinimaPercentual: number;
  trilhaMediaMinima: number;
}

export async function listarTurmasDoProfessor(professorId: string): Promise<TurmaDoProfessor[]> {
  const { data: turmas, error } = await selecao()
    .from("turmas")
    .select("*")
    .eq("professor_id", professorId)
    .order("periodo_inicio", { ascending: false });
  if (error) throw new Error(mensagemDeErroBanco(error));
  if (turmas.length === 0) return [];

  const moduloIds = [...new Set(turmas.map((t) => t.modulo_id))];
  const turmaIds = turmas.map((t) => t.id);

  const [contextoModulo, matriculasResp] = await Promise.all([
    buscarContextoModulos(moduloIds),
    selecao().from("matriculas").select("turma_id, status").in("turma_id", turmaIds),
  ]);
  if (matriculasResp.error) throw new Error(mensagemDeErroBanco(matriculasResp.error));

  return turmas.map((turma) => {
    const contexto = contextoModulo.get(turma.modulo_id);
    return {
      id: turma.id,
      codigo: turma.codigo,
      moduloNome: contexto?.nome ?? "—",
      trilhaNome: contexto?.trilhaNome ?? "—",
      periodoInicio: turma.periodo_inicio,
      periodoFim: turma.periodo_fim,
      matriculados: (matriculasResp.data ?? []).filter(
        (m) => m.turma_id === turma.id && m.status === "matriculada",
      ).length,
      frequenciaMinimaPercentual: turma.frequencia_minima_percentual,
      trilhaMediaMinima: contexto?.trilhaMediaMinima ?? 6,
    };
  });
}

export interface TurmaDisponivel {
  id: string;
  codigo: string;
  professorNome: string;
  periodoInicio: string;
  periodoFim: string;
  vagasRestantes: number;
  /**
   * Matrícula do aluno atual nesta turma, em qualquer status — inclusive
   * rejeitada/cancelada/reprovada. Não significa inscrição vigente: serve
   * para bloquear só esta turma (unique aluno+turma); se o aluno ainda
   * pode se inscrever no módulo é decidido pelo status (DetalheModulo).
   */
  minhaMatricula: { id: string; status: StatusMatricula } | null;
}

export interface ModuloComTurmas {
  moduloId: string;
  moduloNome: string;
  moduloOrdem: number;
  turmas: TurmaDisponivel[];
}

/**
 * Turmas de uma trilha para a tela pública, agrupadas por módulo — cada
 * módulo é uma disciplina com turma (e professor) próprios, não existe
 * mais "a turma da trilha inteira". Já cruza com a matrícula do próprio
 * aluno em cada turma, se houver.
 */
export async function listarModulosComTurmasDaTrilha(
  trilhaId: string,
  alunoId: string | null,
  modulosConhecidos?: Modulo[],
): Promise<ModuloComTurmas[]> {
  const modulos = modulosConhecidos ?? (await listarModulosDaTrilha(trilhaId));
  if (modulos.length === 0) return [];

  const moduloIds = modulos.map((m) => m.id);
  const { data: turmas, error } = await selecao()
    .from("turmas")
    .select("*")
    .in("modulo_id", moduloIds)
    .order("periodo_inicio", { ascending: true });
  if (error) throw new Error(mensagemDeErroBanco(error));

  const turmaIds = (turmas ?? []).map((t) => t.id);
  const professorIds = [...new Set((turmas ?? []).map((t) => t.professor_id))];

  const [nomeProfessor, matriculasResp, minhasMatriculasResp] = await Promise.all([
    buscarNomesCompletos(professorIds),
    turmaIds.length > 0
      ? selecao().from("matriculas").select("turma_id, status").in("turma_id", turmaIds)
      : Promise.resolve({ data: [], error: null }),
    alunoId && turmaIds.length > 0
      ? selecao()
          .from("matriculas")
          .select("id, turma_id, status")
          .eq("aluno_id", alunoId)
          .in("turma_id", turmaIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (matriculasResp.error) throw new Error(mensagemDeErroBanco(matriculasResp.error));
  if (minhasMatriculasResp.error) throw new Error(mensagemDeErroBanco(minhasMatriculasResp.error));

  const minhaPorTurma = new Map(
    (minhasMatriculasResp.data ?? []).map((m) => [m.turma_id, { id: m.id, status: m.status }]),
  );

  const turmasPorModulo = new Map<string, TurmaDisponivel[]>();
  for (const turma of turmas ?? []) {
    const ocupadas = (matriculasResp.data ?? []).filter(
      (m) => m.turma_id === turma.id && (m.status === "inscrita" || m.status === "matriculada"),
    ).length;
    const lista = turmasPorModulo.get(turma.modulo_id) ?? [];
    lista.push({
      id: turma.id,
      codigo: turma.codigo,
      professorNome: nomeProfessor.get(turma.professor_id) ?? "—",
      periodoInicio: turma.periodo_inicio,
      periodoFim: turma.periodo_fim,
      vagasRestantes: turma.vagas_total - ocupadas,
      minhaMatricula: minhaPorTurma.get(turma.id) ?? null,
    });
    turmasPorModulo.set(turma.modulo_id, lista);
  }

  return modulos.map((modulo) => ({
    moduloId: modulo.id,
    moduloNome: modulo.nome,
    moduloOrdem: modulo.ordem,
    turmas: turmasPorModulo.get(modulo.id) ?? [],
  }));
}

export type { Matricula, StatusMatricula, Turma };
