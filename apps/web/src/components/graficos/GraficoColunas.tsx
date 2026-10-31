import { Card } from "@/components/Card";
import type { ColunaCsv } from "@/lib/csv";
import { topoDoEixo } from "./escalaGrafico";
import type { PontoGrafico } from "./GraficoLinha";
import { TabelaDoGrafico } from "./TabelaDoGrafico";

interface GraficoColunasProps {
  titulo: string;
  descricao: string;
  unidade: string;
  pontos: PontoGrafico[];
  vazio: string;
  colunasTabela: ColunaCsv<PontoGrafico>[];
  nomeCsv: string[];
  /** Histograma: colunas coladas, sem a folga entre barras. */
  histograma?: boolean;
  carregando?: boolean;
}

const L = 360;
const A = 190;
const MARGEM = { topo: 16, direita: 8, base: 26, esquerda: 30 };

// Colunas verticais em SVG próprio, uma série, tinta do tema. Serve a
// "certificados por mês" e, com `histograma`, à distribuição de notas.
export function GraficoColunas({
  titulo,
  descricao,
  unidade,
  pontos,
  vazio,
  colunasTabela,
  nomeCsv,
  histograma = false,
  carregando = false,
}: GraficoColunasProps) {
  const topo = topoDoEixo(Math.max(0, ...pontos.map((p) => p.valor)));
  const larguraUtil = L - MARGEM.esquerda - MARGEM.direita;
  const alturaUtil = A - MARGEM.topo - MARGEM.base;
  // Teto de 40 por coluna: com um mês só, a barra não vira um bloco.
  const faixa = Math.min(40, larguraUtil / Math.max(1, pontos.length));
  const folga = histograma ? 1 : Math.min(8, faixa * 0.25);
  const y = (v: number) => MARGEM.topo + alturaUtil - (v / topo) * alturaUtil;
  const passo = Math.ceil(pontos.length / (histograma ? 10 : 6));
  const ticks = Number.isInteger(topo / 2) ? [0, topo / 2, topo] : [0, topo];
  const resumo = pontos.map((p) => `${p.rotulo}: ${p.valor} ${unidade}`).join("; ");

  return (
    <Card className="flex min-w-0 flex-col">
      <h2 className="text-klass-lg text-text-primary">{titulo}</h2>
      <p className="mb-3 text-label text-text-muted">{descricao}</p>
      {carregando && <div aria-hidden className="h-40 animate-pulse rounded bg-surface-subtle" />}
      {!carregando && pontos.length === 0 && <p className="text-body-sm text-text-secondary">{vazio}</p>}
      {!carregando && pontos.length > 0 && (
        <>
          <svg viewBox={`0 0 ${L} ${A}`} role="img" aria-label={`${titulo}. ${resumo}`} className="h-auto w-full max-w-2xl">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={MARGEM.esquerda} x2={L - MARGEM.direita} y1={y(t)} y2={y(t)} className="stroke-border" strokeWidth={1} />
                <text x={MARGEM.esquerda - 6} y={y(t) + 3} textAnchor="end" fontSize={10} className="fill-text-muted font-mono">
                  {Math.round(t)}
                </text>
              </g>
            ))}
            {pontos.map((p, i) => {
              const x0 = MARGEM.esquerda + i * faixa + folga / 2;
              const h = alturaUtil - (y(p.valor) - MARGEM.topo);
              return (
                <g key={p.id}>
                  <rect
                    x={x0}
                    y={y(p.valor)}
                    width={Math.max(1, faixa - folga)}
                    height={Math.max(h, p.valor > 0 ? 1 : 0)}
                    rx={histograma ? 0 : 2}
                    className="fill-text-primary"
                  >
                    <title>{`${p.rotulo}: ${p.valor} ${unidade}`}</title>
                  </rect>
                  {p.valor > 0 && (
                    <text x={x0 + (faixa - folga) / 2} y={y(p.valor) - 4} textAnchor="middle" fontSize={10} className="fill-text-primary font-mono">
                      {p.valor}
                    </text>
                  )}
                  {i % passo === 0 && (
                    <text x={x0 + (faixa - folga) / 2} y={A - 8} textAnchor="middle" fontSize={histograma ? 9 : 10} className="fill-text-muted font-mono">
                      {p.rotulo}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
          <TabelaDoGrafico titulo={titulo} linhas={pontos} colunas={colunasTabela} nomeCsv={nomeCsv} chave={(p) => p.id} />
        </>
      )}
    </Card>
  );
}
