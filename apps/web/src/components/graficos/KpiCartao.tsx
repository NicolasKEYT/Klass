import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { Card } from "@/components/Card";

export interface VariacaoKpi {
  /** Diferença já formatada ("+3", "−2 p.p."). */
  texto: string;
  sentido: "alta" | "queda" | "igual";
}

interface KpiCartaoProps {
  rotulo: string;
  /** Valor formatado; "—" quando não há base para calcular. */
  valor: string;
  /** Uma linha de apoio ("mínimo 75%", "de 12 turmas"). */
  apoio?: string;
  /** Ausente quando o período é "tudo" ou não há base no período anterior. */
  variacao?: VariacaoKpi;
  carregando?: boolean;
}

// Cartão de KPI do dashboard. A variação traz seta E texto: o sentido não
// depende só de cor, e de propósito não é verde/vermelho — mais matrículas
// é bom, mais evasão não, e o cartão não sabe qual é qual.
export function KpiCartao({ rotulo, valor, apoio, variacao, carregando = false }: KpiCartaoProps) {
  const Seta = variacao?.sentido === "alta" ? ArrowUp : variacao?.sentido === "queda" ? ArrowDown : Minus;
  return (
    <Card dense className="flex min-w-0 flex-col">
      <h3 className="text-body-sm font-semibold text-text-primary">{rotulo}</h3>
      {carregando ? (
        <div aria-hidden className="mt-2 h-8 w-20 animate-pulse rounded bg-surface-subtle" />
      ) : (
        <p className="mt-1 font-mono text-klass-stat font-semibold tabular-nums text-text-primary">{valor}</p>
      )}
      {apoio && <p className="text-label text-text-muted">{apoio}</p>}
      {!carregando && variacao && (
        <p className="mt-1 flex items-center gap-1 text-label text-text-secondary">
          <Seta className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            {variacao.texto} <span className="text-text-muted">vs período anterior</span>
          </span>
        </p>
      )}
    </Card>
  );
}
