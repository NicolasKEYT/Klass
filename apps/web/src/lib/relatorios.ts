import type { Database } from "@klass/types";
import { supabase } from "@/lib/supabase";
import { mensagemDeErroBanco } from "@/lib/mensagensDeErroBanco";

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
