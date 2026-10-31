import { paraDataLocal, paraIsoLocal } from "@/lib/formato";

// Período e trilha na query string, no mesmo formato nas telas de Acompanhamento
// e de Exports: `?periodo=30d|semestre|ano|tudo&trilha=<id>`. Intervalo livre
// (digitado em Exports) vai como `de` e `ate` (AAAA-MM-DD) no lugar de `periodo`.

export type PeriodoPredefinido = "30d" | "semestre" | "ano" | "tudo";

export const PERIODOS: { valor: PeriodoPredefinido; rotulo: string }[] = [
  { valor: "30d", rotulo: "Últimos 30 dias" },
  { valor: "semestre", rotulo: "Semestre atual" },
  { valor: "ano", rotulo: "Ano atual" },
  { valor: "tudo", rotulo: "Tudo" },
];

export interface FiltroRelatorio {
  /** `null` quando o intervalo é livre (`de`/`ate`). */
  periodo: PeriodoPredefinido | null;
  inicio?: string;
  fim?: string;
  trilhaId?: string;
}

const PREDEFINIDOS = new Set<string>(PERIODOS.map((p) => p.valor));
const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

function dia(ano: number, mes: number, d: number): string {
  return paraIsoLocal(new Date(ano, mes, d));
}

function intervaloDoPeriodo(periodo: PeriodoPredefinido, hoje: Date): { inicio?: string; fim?: string } {
  const ano = hoje.getFullYear();
  if (periodo === "tudo") return {};
  if (periodo === "ano") return { inicio: dia(ano, 0, 1), fim: dia(ano, 11, 31) };
  if (periodo === "semestre") {
    return hoje.getMonth() < 6
      ? { inicio: dia(ano, 0, 1), fim: dia(ano, 5, 30) }
      : { inicio: dia(ano, 6, 1), fim: dia(ano, 11, 31) };
  }
  return { inicio: dia(ano, hoje.getMonth(), hoje.getDate() - 29), fim: paraIsoLocal(hoje) };
}

/** `padrao` vale quando a URL não diz nada: Indicadores abre no ano, Exports em "tudo". */
export function lerFiltroRelatorio(
  params: URLSearchParams,
  padrao: PeriodoPredefinido,
  hoje: Date = new Date(),
): FiltroRelatorio {
  const trilhaId = params.get("trilha") || undefined;
  const de = params.get("de");
  const ate = params.get("ate");
  if ((de && DATA_ISO.test(de)) || (ate && DATA_ISO.test(ate))) {
    return {
      periodo: null,
      inicio: de && DATA_ISO.test(de) ? de : undefined,
      fim: ate && DATA_ISO.test(ate) ? ate : undefined,
      trilhaId,
    };
  }
  const lido = params.get("periodo");
  const periodo = lido && PREDEFINIDOS.has(lido) ? (lido as PeriodoPredefinido) : padrao;
  return { periodo, ...intervaloDoPeriodo(periodo, hoje), trilhaId };
}

/** Parte da query string que carrega o filtro; quem chama acrescenta o resto. */
export function paramsDoFiltro(filtro: FiltroRelatorio): URLSearchParams {
  const p = new URLSearchParams();
  if (filtro.periodo) p.set("periodo", filtro.periodo);
  else {
    if (filtro.inicio) p.set("de", filtro.inicio);
    if (filtro.fim) p.set("ate", filtro.fim);
  }
  if (filtro.trilhaId) p.set("trilha", filtro.trilhaId);
  return p;
}

/** Período imediatamente anterior, para a variação dos KPIs; `null` em "tudo". */
export function periodoAnterior(filtro: FiltroRelatorio): { inicio: string; fim: string } | null {
  if (!filtro.inicio || !filtro.fim) return null;
  const ini = paraDataLocal(filtro.inicio);
  if (filtro.periodo === "ano") {
    const a = ini.getFullYear() - 1;
    return { inicio: dia(a, 0, 1), fim: dia(a, 11, 31) };
  }
  if (filtro.periodo === "semestre") {
    return ini.getMonth() === 0
      ? { inicio: dia(ini.getFullYear() - 1, 6, 1), fim: dia(ini.getFullYear() - 1, 11, 31) }
      : { inicio: dia(ini.getFullYear(), 0, 1), fim: dia(ini.getFullYear(), 5, 30) };
  }
  // 30 dias e intervalo livre: a mesma duração, logo antes.
  const fim = paraDataLocal(filtro.fim);
  const dias = Math.round((fim.getTime() - ini.getTime()) / 86_400_000) + 1;
  const fimAnt = new Date(ini.getFullYear(), ini.getMonth(), ini.getDate() - 1);
  const iniAnt = new Date(fimAnt.getFullYear(), fimAnt.getMonth(), fimAnt.getDate() - (dias - 1));
  return { inicio: paraIsoLocal(iniAnt), fim: paraIsoLocal(fimAnt) };
}
