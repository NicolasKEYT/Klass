import type { Database } from "@klass/types";
import { supabase } from "@/lib/supabase";
import { mensagemDeErroBanco } from "@/lib/mensagensDeErroBanco";
import type { ColunaTipada } from "@/lib/csv";

// Relatórios da coordenação (tela de exports e dashboard de indicadores). Os
// dados vêm de funções nomeadas do banco, uma por conjunto, no schema dono de
// cada um; o cálculo e a checagem de papel ficam lá. Quem não é coordenação
// recebe erro de permissão, não lista vazia.

function schema<S extends "identidade" | "catalogo" | "selecao" | "diario" | "certificacao">(nome: S) {
  if (!supabase) throw new Error("Supabase não configurado.");
  return supabase.schema(nome);
}

export type ConjuntoRelatorio =
  | "alunos"
  | "docentes"
  | "trilhas"
  | "turmas"
  | "matriculas"
  | "notasFrequencia"
  | "certificados";

export interface FiltrosRelatorio {
  /** AAAA-MM-DD, em data local. O que "período" recorta depende do conjunto (ver a migration). */
  inicio?: string;
  fim?: string;
  trilhaId?: string;
  /** Valor do status daquele conjunto. */
  status?: string;
}

type Retorno<S extends keyof Database, F extends keyof Database[S]["Functions" & keyof Database[S]]> =
  Database[S]["Functions" & keyof Database[S]][F] extends { Returns: (infer L)[] } ? L : never;

// O gerador de tipos não sabe quais colunas de retorno de função podem vir nulas.
type ComNulos<T, K extends keyof T> = Omit<T, K> & { [C in K]: T[C] | null };

export interface LinhasRelatorio {
  alunos: ComNulos<Retorno<"identidade", "relatorio_alunos">, "email" | "frequencia_media" | "nota_media">;
  docentes: Retorno<"identidade", "relatorio_docentes">;
  trilhas: ComNulos<
    Retorno<"catalogo", "relatorio_trilhas">,
    | "modulo_id"
    | "modulo_ordem"
    | "modulo_nome"
    | "modulo_nivel"
    | "carga_horaria_modulo"
    | "pre_requisitos"
  >;
  turmas: Retorno<"selecao", "relatorio_turmas">;
  matriculas: ComNulos<Retorno<"selecao", "relatorio_matriculas">, "deferido_em" | "encerrada_em">;
  notasFrequencia: ComNulos<
    Retorno<"diario", "relatorio_notas_frequencia">,
    "nota_media" | "frequencia_percentual"
  >;
  certificados: ComNulos<
    Retorno<"certificacao", "relatorio_certificados">,
    "modulo_nome" | "turma_codigo" | "revogado_em"
  >;
}

interface RespostaDePagina<L> {
  data: L[] | null;
  error: { message: string; code?: string } | null;
  count: number | null;
}

function argumentos(filtros: FiltrosRelatorio) {
  return {
    p_inicio: filtros.inicio,
    p_fim: filtros.fim,
    p_trilha_id: filtros.trilhaId,
    p_status: filtros.status,
  };
}

const LER_PAGINA: {
  [C in ConjuntoRelatorio]: (
    filtros: FiltrosRelatorio,
    de: number,
    ate: number,
  ) => PromiseLike<RespostaDePagina<LinhasRelatorio[C]>>;
} = {
  alunos: (filtros, de, ate) =>
    schema("identidade").rpc("relatorio_alunos", argumentos(filtros), { count: "exact" }).range(de, ate),
  docentes: (filtros, de, ate) =>
    schema("identidade").rpc("relatorio_docentes", argumentos(filtros), { count: "exact" }).range(de, ate),
  trilhas: (filtros, de, ate) =>
    schema("catalogo").rpc("relatorio_trilhas", argumentos(filtros), { count: "exact" }).range(de, ate),
  turmas: (filtros, de, ate) =>
    schema("selecao").rpc("relatorio_turmas", argumentos(filtros), { count: "exact" }).range(de, ate),
  matriculas: (filtros, de, ate) =>
    schema("selecao").rpc("relatorio_matriculas", argumentos(filtros), { count: "exact" }).range(de, ate),
  notasFrequencia: (filtros, de, ate) =>
    schema("diario")
      .rpc("relatorio_notas_frequencia", argumentos(filtros), { count: "exact" })
      .range(de, ate),
  certificados: (filtros, de, ate) =>
    schema("certificacao")
      .rpc("relatorio_certificados", argumentos(filtros), { count: "exact" })
      .range(de, ate),
};

export interface PaginaRelatorio<L> {
  linhas: L[];
  total: number;
}

/** `pagina` começa em 0. */
export async function buscarPaginaRelatorio<C extends ConjuntoRelatorio>(
  conjunto: C,
  filtros: FiltrosRelatorio,
  pagina: number,
  tamanho: number,
): Promise<PaginaRelatorio<LinhasRelatorio[C]>> {
  const de = pagina * tamanho;
  const { data, error, count } = await LER_PAGINA[conjunto](filtros, de, de + tamanho - 1);
  if (error) throw new Error(mensagemDeErroBanco(error));
  return { linhas: data ?? [], total: count ?? 0 };
}

export async function contarRelatorio(
  conjunto: ConjuntoRelatorio,
  filtros: FiltrosRelatorio,
): Promise<number> {
  return (await buscarPaginaRelatorio(conjunto, filtros, 0, 1)).total;
}

// O PostgREST corta cada resposta em max_rows (1000, em supabase/config.toml):
// sem este laço, um export grande sairia truncado sem aviso.
const LINHAS_POR_LEITURA = 1000;

export async function buscarRelatorioCompleto<C extends ConjuntoRelatorio>(
  conjunto: C,
  filtros: FiltrosRelatorio,
): Promise<LinhasRelatorio[C][]> {
  const linhas: LinhasRelatorio[C][] = [];
  for (let pagina = 0; ; pagina++) {
    const lida = await buscarPaginaRelatorio(conjunto, filtros, pagina, LINHAS_POR_LEITURA);
    linhas.push(...lida.linhas);
    if (lida.linhas.length === 0 || linhas.length >= lida.total) return linhas;
  }
}

export interface FiltrosIndicadores {
  inicio?: string;
  fim?: string;
  trilhaId?: string;
}

export interface IndicadoresCoordenacao {
  kpis: {
    alunos_ativos: number;
    matriculas_ativas: number;
    inscricoes_pendentes: number;
    /** Percentuais e médias ficam nulos quando não há base para calcular. */
    taxa_conclusao: number | null;
    taxa_evasao: number | null;
    frequencia_media: number | null;
    nota_media: number | null;
    certificados_periodo: number;
    ocupacao_media: number | null;
  };
  /** `mes` em AAAA-MM. Meses sem nenhum evento não aparecem. */
  matriculas_por_mes: { mes: string; total: number }[];
  alunos_por_trilha: { trilha_id: string; trilha_nome: string; alunos: number }[];
  desempenho_por_trilha: {
    trilha_id: string;
    trilha_nome: string;
    concluidas: number;
    reprovadas: number;
    canceladas: number;
    taxa_aprovacao: number | null;
    taxa_evasao: number | null;
  }[];
  /** Sempre dez faixas, de 0–1 a 9–10. */
  distribuicao_notas: { faixa_inicio: number; faixa_fim: number; total: number }[];
  /** Piores primeiro. */
  frequencia_por_turma: {
    turma_id: string;
    turma_codigo: string;
    trilha_nome: string;
    frequencia: number;
  }[];
  certificados_por_mes: { mes: string; total: number }[];
}

export async function buscarIndicadores(filtros: FiltrosIndicadores): Promise<IndicadoresCoordenacao> {
  const { data, error } = await schema("selecao").rpc("relatorio_indicadores", {
    p_inicio: filtros.inicio,
    p_fim: filtros.fim,
    p_trilha_id: filtros.trilhaId,
  });
  if (error) throw new Error(mensagemDeErroBanco(error));
  // O banco devolve jsonb, que o gerador de tipos só conhece como Json.
  return data as unknown as IndicadoresCoordenacao;
}

// --- Apresentação dos conjuntos (tela de exports) -------------------------
// Uma definição de colunas por conjunto serve à prévia, ao CSV e ao XLSX: o
// arquivo diz o que a tela diz. Nenhum conjunto tem CPF; o e-mail só existe
// em "alunos" (decisão do Gabriel, 30/10).

export const CONJUNTOS: ConjuntoRelatorio[] = [
  "alunos",
  "docentes",
  "trilhas",
  "turmas",
  "matriculas",
  "notasFrequencia",
  "certificados",
];

export interface InfoConjunto {
  titulo: string;
  /** Nome do arquivo e da aba no "Exportar tudo". */
  slug: string;
  descricao: string;
  /** O que o filtro de período recorta neste conjunto (ver a migration). */
  periodo: string;
  status: { valor: string; rotulo: string }[];
}

const STATUS_MATRICULA = [
  { valor: "inscrita", rotulo: "Inscrita" },
  { valor: "matriculada", rotulo: "Matriculada" },
  { valor: "concluida", rotulo: "Concluída" },
  { valor: "reprovada", rotulo: "Reprovada" },
  { valor: "rejeitada", rotulo: "Rejeitada" },
  { valor: "cancelada", rotulo: "Cancelada" },
];

const STATUS_TURMA = [
  { valor: "futura", rotulo: "Futura" },
  { valor: "em_andamento", rotulo: "Em andamento" },
  { valor: "aguardando_encerramento", rotulo: "Aguardando encerramento" },
  { valor: "encerrada", rotulo: "Encerrada" },
];

export const INFO_CONJUNTO: Record<ConjuntoRelatorio, InfoConjunto> = {
  alunos: {
    titulo: "Alunos",
    slug: "alunos",
    descricao: "Cadastro, matrículas ativas, trilhas concluídas, frequência e nota médias.",
    periodo: "Período do cadastro do aluno.",
    status: STATUS_MATRICULA,
  },
  docentes: {
    titulo: "Docentes",
    slug: "docentes",
    descricao: "Professores com número de turmas e de alunos ativos.",
    periodo: "Período das turmas do docente.",
    status: STATUS_TURMA,
  },
  trilhas: {
    titulo: "Trilhas",
    slug: "trilhas",
    descricao: "Trilhas com seus módulos, carga horária e pré-requisitos.",
    periodo: "Período das turmas do módulo.",
    status: [
      { valor: "publicada", rotulo: "Publicada" },
      { valor: "rascunho", rotulo: "Rascunho" },
    ],
  },
  turmas: {
    titulo: "Turmas",
    slug: "turmas",
    descricao: "Turmas com docente, vagas, ocupação e situação.",
    periodo: "Período de realização da turma.",
    status: STATUS_TURMA,
  },
  matriculas: {
    titulo: "Matrículas",
    slug: "matriculas",
    descricao: "Cada inscrição com sua situação e datas.",
    periodo: "Data da inscrição.",
    status: STATUS_MATRICULA,
  },
  notasFrequencia: {
    titulo: "Notas e frequência",
    slug: "notas-frequencia",
    descricao: "Nota média e frequência de cada matrícula.",
    periodo: "Período da turma.",
    status: STATUS_MATRICULA,
  },
  certificados: {
    titulo: "Certificados",
    slug: "certificados",
    descricao: "Certificados emitidos, com código de verificação.",
    periodo: "Data de emissão.",
    status: [
      { valor: "valido", rotulo: "Válido" },
      { valor: "revogado", rotulo: "Revogado" },
    ],
  },
};

const ROTULO_STATUS = new Map(
  [...STATUS_MATRICULA, ...STATUS_TURMA, ...INFO_CONJUNTO.trilhas.status, ...INFO_CONJUNTO.certificados.status].map(
    (s) => [s.valor, s.rotulo],
  ),
);
const rotuloStatus = (valor: string) => ROTULO_STATUS.get(valor) ?? valor;

const NIVEIS = new Map([
  ["iniciante", "Iniciante"],
  ["intermediario", "Intermediário"],
  ["avancado", "Avançado"],
]);
const TIPOS_CERTIFICADO = new Map([
  ["modulo", "Módulo"],
  ["trilha", "Trilha"],
]);

type Colunas = { [C in ConjuntoRelatorio]: ColunaTipada<LinhasRelatorio[C]>[] };

export const COLUNAS_RELATORIO: Colunas = {
  alunos: [
    { titulo: "Nome", tipo: "texto", valor: (l) => l.nome },
    { titulo: "E-mail", tipo: "texto", valor: (l) => l.email },
    { titulo: "Cadastrado em", tipo: "data", valor: (l) => l.cadastrado_em },
    { titulo: "Matrículas ativas", tipo: "inteiro", valor: (l) => l.matriculas_ativas },
    { titulo: "Trilhas concluídas", tipo: "inteiro", valor: (l) => l.trilhas_concluidas },
    { titulo: "Frequência média (%)", tipo: "decimal", valor: (l) => l.frequencia_media },
    { titulo: "Nota média", tipo: "decimal", valor: (l) => l.nota_media },
  ],
  docentes: [
    { titulo: "Nome", tipo: "texto", valor: (l) => l.nome },
    { titulo: "Cadastrado em", tipo: "data", valor: (l) => l.cadastrado_em },
    { titulo: "Turmas", tipo: "inteiro", valor: (l) => l.turmas },
    { titulo: "Turmas em andamento", tipo: "inteiro", valor: (l) => l.turmas_em_andamento },
    { titulo: "Alunos ativos", tipo: "inteiro", valor: (l) => l.alunos_ativos },
  ],
  trilhas: [
    { titulo: "Trilha", tipo: "texto", valor: (l) => l.trilha_nome },
    { titulo: "Situação", tipo: "texto", valor: (l) => rotuloStatus(l.status_publicacao) },
    { titulo: "Carga horária da trilha (h)", tipo: "inteiro", valor: (l) => l.carga_horaria_trilha },
    { titulo: "Ordem do módulo", tipo: "inteiro", valor: (l) => l.modulo_ordem },
    { titulo: "Módulo", tipo: "texto", valor: (l) => l.modulo_nome },
    { titulo: "Nível", tipo: "texto", valor: (l) => (l.modulo_nivel ? (NIVEIS.get(l.modulo_nivel) ?? l.modulo_nivel) : null) },
    { titulo: "Carga horária do módulo (h)", tipo: "inteiro", valor: (l) => l.carga_horaria_modulo },
    { titulo: "Pré-requisitos", tipo: "texto", valor: (l) => l.pre_requisitos },
    { titulo: "Turmas", tipo: "inteiro", valor: (l) => l.turmas },
  ],
  turmas: [
    { titulo: "Código", tipo: "texto", valor: (l) => l.codigo },
    { titulo: "Trilha", tipo: "texto", valor: (l) => l.trilha_nome },
    { titulo: "Módulo", tipo: "texto", valor: (l) => l.modulo_nome },
    { titulo: "Turno", tipo: "texto", valor: (l) => l.turno },
    { titulo: "Docente", tipo: "texto", valor: (l) => l.docente_nome },
    { titulo: "Início", tipo: "data", valor: (l) => l.periodo_inicio },
    { titulo: "Fim", tipo: "data", valor: (l) => l.periodo_fim },
    { titulo: "Vagas", tipo: "inteiro", valor: (l) => l.vagas_total },
    { titulo: "Inscritas", tipo: "inteiro", valor: (l) => l.inscritas },
    { titulo: "Matriculadas", tipo: "inteiro", valor: (l) => l.matriculadas },
    { titulo: "Concluídas", tipo: "inteiro", valor: (l) => l.concluidas },
    { titulo: "Reprovadas", tipo: "inteiro", valor: (l) => l.reprovadas },
    { titulo: "Ocupação (%)", tipo: "decimal", valor: (l) => l.ocupacao_percentual },
    { titulo: "Situação", tipo: "texto", valor: (l) => rotuloStatus(l.status) },
  ],
  matriculas: [
    { titulo: "Aluno", tipo: "texto", valor: (l) => l.aluno_nome },
    { titulo: "Trilha", tipo: "texto", valor: (l) => l.trilha_nome },
    { titulo: "Módulo", tipo: "texto", valor: (l) => l.modulo_nome },
    { titulo: "Turma", tipo: "texto", valor: (l) => l.turma_codigo },
    { titulo: "Situação", tipo: "texto", valor: (l) => rotuloStatus(l.status) },
    { titulo: "Inscrito em", tipo: "data", valor: (l) => l.inscrito_em },
    { titulo: "Deferido em", tipo: "data", valor: (l) => l.deferido_em },
    { titulo: "Encerrada em", tipo: "data", valor: (l) => l.encerrada_em },
  ],
  notasFrequencia: [
    { titulo: "Aluno", tipo: "texto", valor: (l) => l.aluno_nome },
    { titulo: "Trilha", tipo: "texto", valor: (l) => l.trilha_nome },
    { titulo: "Módulo", tipo: "texto", valor: (l) => l.modulo_nome },
    { titulo: "Turma", tipo: "texto", valor: (l) => l.turma_codigo },
    { titulo: "Situação", tipo: "texto", valor: (l) => rotuloStatus(l.status) },
    { titulo: "Nota média", tipo: "decimal", valor: (l) => l.nota_media },
    { titulo: "Frequência (%)", tipo: "decimal", valor: (l) => l.frequencia_percentual },
    { titulo: "Frequência mínima (%)", tipo: "inteiro", valor: (l) => l.frequencia_minima_percentual },
  ],
  certificados: [
    { titulo: "Aluno", tipo: "texto", valor: (l) => l.aluno_nome },
    { titulo: "Trilha", tipo: "texto", valor: (l) => l.trilha_nome },
    { titulo: "Módulo", tipo: "texto", valor: (l) => l.modulo_nome },
    { titulo: "Turma", tipo: "texto", valor: (l) => l.turma_codigo },
    { titulo: "Tipo", tipo: "texto", valor: (l) => TIPOS_CERTIFICADO.get(l.tipo) ?? l.tipo },
    { titulo: "Emitido em", tipo: "data", valor: (l) => l.emitido_em },
    { titulo: "Código de verificação", tipo: "texto", valor: (l) => l.codigo_verificacao },
    { titulo: "Situação", tipo: "texto", valor: (l) => rotuloStatus(l.status) },
    { titulo: "Revogado em", tipo: "data", valor: (l) => l.revogado_em },
  ],
};
