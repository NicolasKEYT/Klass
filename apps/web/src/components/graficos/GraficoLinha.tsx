import { Card } from "@/components/Card";
import type { ColunaCsv } from "@/lib/csv";
import { topoDoEixo } from "./escalaGrafico";
import { TabelaDoGrafico } from "./TabelaDoGrafico";

export interface PontoGrafico {
  id: string;
  rotulo: string;
  valor: number;
}

interface GraficoLinhaProps {
  titulo: string;
  descricao: string;
  /** Unidade no singular/plural curto para o texto acessível ("matrículas"). */
  unidade: string;
  pontos: PontoGrafico[];
  vazio: string;
  colunasTabela: ColunaCsv<PontoGrafico>[];
  nomeCsv: string[];
  carregando?: boolean;
}

const L = 360;
const A = 190;
const MARGEM = { topo: 14, direita: 22, base: 26, esquerda: 30 };

// Série temporal numa linha só (uma série por gráfico, como D11), em SVG
// próprio: traço e pontos na tinta do tema, grade nos tons de borda. Os
// rótulos do eixo X são afinados para no máximo ~6, e o valor de cada ponto
// aparece em cima dele quando a série é curta.
export function GraficoLinha({
  titulo,
  descricao,
  unidade,
  pontos,
  vazio,
  colunasTabela,
  nomeCsv,
  carregando = false,
}: GraficoLinhaProps) {
  const topo = topoDoEixo(Math.max(0, ...pontos.map((p) => p.valor)));
  const larguraUtil = L - MARGEM.esquerda - MARGEM.direita;
  const alturaUtil = A - MARGEM.topo - MARGEM.base;
  const x = (i: number) =>
    MARGEM.esquerda + (pontos.length === 1 ? larguraUtil / 2 : (i / (pontos.length - 1)) * larguraUtil);
  const y = (v: number) => MARGEM.topo + alturaUtil - (v / topo) * alturaUtil;
  const passo = Math.ceil(pontos.length / 6);
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
            <polyline
              points={pontos.map((p, i) => `${x(i)},${y(p.valor)}`).join(" ")}
              fill="none"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              className="stroke-text-primary"
            />
            {pontos.map((p, i) => (
              <g key={p.id}>
                <circle cx={x(i)} cy={y(p.valor)} r={3.5} className="fill-surface stroke-text-primary" strokeWidth={2}>
                  <title>{`${p.rotulo}: ${p.valor} ${unidade}`}</title>
                </circle>
                {pontos.length <= 12 && (
                  <text x={x(i)} y={y(p.valor) - 8} textAnchor="middle" fontSize={10} className="fill-text-primary font-mono">
                    {p.valor}
                  </text>
                )}
                {i % passo === 0 && (
                  <text x={x(i)} y={A - 8} textAnchor="middle" fontSize={10} className="fill-text-muted font-mono">
                    {p.rotulo}
                  </text>
                )}
              </g>
            ))}
          </svg>
          <TabelaDoGrafico titulo={titulo} linhas={pontos} colunas={colunasTabela} nomeCsv={nomeCsv} chave={(p) => p.id} />
        </>
      )}
    </Card>
  );
}
