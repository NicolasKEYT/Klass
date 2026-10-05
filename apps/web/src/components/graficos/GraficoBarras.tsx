import { useId, useRef, useState, type KeyboardEvent } from "react";
import { TriangleAlert } from "lucide-react";
import { BotaoExportarCsv } from "@/components/BotaoExportarCsv";
import { Card } from "@/components/Card";
import type { ColunaCsv } from "@/lib/csv";

// D11 (klass-uikit.pdf) — gráficos de acompanhamento da coordenação.
// Método de visualização do projeto: barras horizontais ordenadas, UMA
// série por gráfico, na cor de tinta do tema (text-primary); sem pizza,
// sem velocímetro, sem dois eixos. Marcas finas (20 px) com 2 px de folga
// entre barras e ponta arredondada de 4 px só no fim (a base, no zero,
// fica reta). Valor e rótulo em cor de texto, o valor direto no fim da
// barra; grade e eixo em tom de borda. O traço laranja (bg-meta) continua
// reservado à meta, como na BarraDeMeta. Tooltip ao passar o mouse e ao
// focar pelo teclado; "Ver como tabela" traz os mesmos números (e o CSV).
// Nada depende só de cor: abaixo da meta ganha ícone e texto, e a meta
// está na legenda, no tooltip e na tabela.
//
// HTML + CSS, sem biblioteca de gráficos: só barras horizontais, que o
// próprio layout desenha.

export interface ItemGrafico {
  id: string;
  /** Categoria (trilha, turma, semestre). */
  rotulo: string;
  /** Na escala de 0 a `max` (percentual, por padrão). */
  valor: number;
  /** O valor como aparece no fim da barra ("82%", "18/20"). */
  textoValor: string;
  /** Linhas extras do tooltip ("8 de 10 matrículas encerradas"). */
  detalhes?: string[];
  /** Posição do traço de meta desta linha, na mesma escala. */
  meta?: number;
  /** Abaixo da meta: ícone + texto ao lado do valor (não só cor). */
  alerta?: string;
}

interface GraficoBarrasProps<T extends ItemGrafico> {
  titulo: string;
  /** Uma linha dizendo o que é medido e de onde vem. */
  descricao: string;
  itens: T[];
  max?: number;
  /** Rótulo dos ticks do eixo ("%" por padrão). */
  sufixoEixo?: string;
  /** Legenda do traço de meta, quando há meta. */
  legendaMeta?: string;
  /** Linha abaixo do gráfico (ex.: "2 trilhas sem matrícula encerrada ficam de fora"). */
  nota?: string;
  vazio: string;
  colunasTabela: ColunaCsv<T>[];
  nomeCsv: string[];
  carregando?: boolean;
}

const TICKS = [0, 25, 50, 75, 100];

export function GraficoBarras<T extends ItemGrafico>({
  titulo,
  descricao,
  itens,
  max = 100,
  sufixoEixo = "%",
  legendaMeta,
  nota,
  vazio,
  colunasTabela,
  nomeCsv,
  carregando = false,
}: GraficoBarrasProps<T>) {
  const idTitulo = useId();
  const [ativo, setAtivo] = useState<number | null>(null);
  // Tabulação "itinerante": uma parada de Tab para o gráfico inteiro, e as
  // setas andam entre as barras — com 20 turmas, Tab barra a barra seria
  // uma maratona até o "Ver como tabela".
  const [foco, setFoco] = useState(0);
  const linhas = useRef<Array<HTMLDivElement | null>>([]);
  const escala = (v: number) => Math.max(0, Math.min(100, (v / max) * 100));

  function aoTeclar(e: KeyboardEvent<HTMLDivElement>, i: number) {
    let alvo: number | null = null;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") alvo = Math.min(itens.length - 1, i + 1);
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") alvo = Math.max(0, i - 1);
    else if (e.key === "Home") alvo = 0;
    else if (e.key === "End") alvo = itens.length - 1;
    else if (e.key === "Escape") setAtivo(null);
    if (alvo === null) return;
    e.preventDefault();
    setFoco(alvo);
    linhas.current[alvo]?.focus();
  }

  return (
    // min-w-0: dentro de grid/flex, o cartão encolheria até a largura da
    // tabela aberta ("Ver como tabela") e estouraria a tela no celular; assim
    // a tabela rola dentro do próprio contêiner (overflow-x-auto abaixo).
    <Card className="flex min-w-0 flex-col">
      <h2 id={idTitulo} className="text-klass-lg text-text-primary">
        {titulo}
      </h2>
      <p className="mb-3 text-label text-text-muted">{descricao}</p>
      {legendaMeta && itens.length > 0 && (
        <p className="mb-3 flex items-center gap-2 text-label text-text-secondary">
          <span aria-hidden className="inline-block h-4 w-0.5 rounded-full bg-meta" />
          {legendaMeta}
        </p>
      )}

      {carregando && (
        <div aria-hidden className="flex flex-col gap-0.5">
          {[70, 55, 40].map((w) => (
            <div key={w} className="h-5 animate-pulse rounded-r-[4px] bg-surface-subtle" style={{ width: `${w}%` }} />
          ))}
        </div>
      )}
      {!carregando && itens.length === 0 && <p className="text-body-sm text-text-secondary">{vazio}</p>}

      {!carregando && itens.length > 0 && (
        <div className="relative">
          {/* Grade: linhas verticais finas nos quartos da escala, atrás das
              barras. A área do gráfico começa depois da coluna de rótulos
              e deixa 4,5rem à direita para o valor no fim da barra. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-28 right-[4.5rem] sm:left-48"
          >
            {TICKS.map((t) => (
              <div key={t} className="absolute inset-y-0 w-px bg-border" style={{ left: `${t}%` }} />
            ))}
          </div>

          <div role="list" aria-labelledby={idTitulo} className="relative flex flex-col gap-0.5">
            {itens.map((item, i) => {
              const largura = escala(item.valor);
              const descricaoAcessivel = [
                `${item.rotulo}: ${item.textoValor}`,
                ...(item.alerta ? [item.alerta] : []),
                ...(item.detalhes ?? []),
              ].join(". ");
              return (
                <div
                  key={item.id}
                  ref={(el) => {
                    linhas.current[i] = el;
                  }}
                  role="listitem"
                  tabIndex={i === foco ? 0 : -1}
                  aria-label={descricaoAcessivel}
                  className="group relative flex h-5 items-center rounded-sm outline-offset-2"
                  onMouseEnter={() => setAtivo(i)}
                  onMouseLeave={() => setAtivo((a) => (a === i ? null : a))}
                  onFocus={() => {
                    setFoco(i);
                    setAtivo(i);
                  }}
                  onBlur={() => setAtivo((a) => (a === i ? null : a))}
                  onKeyDown={(e) => aoTeclar(e, i)}
                >
                  <span
                    className="w-28 shrink-0 truncate pr-3 text-label text-text-primary sm:w-48"
                    title={item.rotulo}
                  >
                    {item.rotulo}
                  </span>
                  <div className="relative h-full flex-1 pr-[4.5rem]">
                    <div className="relative h-full">
                      <div
                        className={`h-full rounded-r-[4px] bg-text-primary transition-opacity ${
                          ativo !== null && ativo !== i ? "opacity-60" : ""
                        }`}
                        style={{ width: `${largura}%`, minWidth: item.valor > 0 ? 2 : 0 }}
                      />
                      {item.meta !== undefined && (
                        <div
                          aria-hidden
                          className="absolute inset-y-0 w-0.5 rounded-full bg-meta"
                          style={{ left: `calc(${escala(item.meta)}% - 1px)` }}
                        />
                      )}
                      {/* Valor direto no fim da barra, em cor de texto. */}
                      <span
                        aria-hidden
                        className="absolute top-1/2 flex -translate-y-1/2 items-center gap-1 whitespace-nowrap pl-1.5 font-mono text-label tabular-nums text-text-primary"
                        style={{ left: `${largura}%` }}
                      >
                        {item.textoValor}
                        {item.alerta && <TriangleAlert className="h-3.5 w-3.5 text-text-primary" aria-hidden />}
                      </span>
                      {ativo === i && (
                        <div
                          aria-hidden
                          className="pointer-events-none absolute bottom-full z-10 mb-1.5 w-max max-w-64 rounded-klass-control border border-border bg-surface px-3 py-2 shadow-klass-elevated"
                          style={{ left: `min(${largura}%, calc(100% - 12rem))` }}
                        >
                          {/* Valor primeiro, rótulo depois. */}
                          <p className="font-mono text-body-sm font-semibold tabular-nums text-text-primary">
                            {item.textoValor}
                          </p>
                          <p className="text-label text-text-primary">{item.rotulo}</p>
                          {item.alerta && <p className="text-label text-text-primary">{item.alerta}</p>}
                          {item.detalhes?.map((d) => (
                            <p key={d} className="text-label text-text-secondary">
                              {d}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Eixo: só os rótulos dos quartos, discretos. */}
          <div aria-hidden className="relative ml-28 mr-[4.5rem] mt-1 h-5 sm:ml-48">
            {TICKS.map((t) => (
              // No celular só 0, 50 e 100: os cinco rótulos se encostavam.
              <span
                key={t}
                className={`absolute -translate-x-1/2 font-mono text-label tabular-nums text-text-muted ${
                  t === 25 || t === 75 ? "hidden sm:inline" : ""
                }`}
                style={{ left: `${t}%` }}
              >
                {Math.round((t / 100) * max)}
                {sufixoEixo}
              </span>
            ))}
          </div>
        </div>
      )}

      {nota && <p className="mt-3 text-label text-text-muted">{nota}</p>}

      {!carregando && itens.length > 0 && (
        <details className="mt-3 border-t border-border pt-3">
          <summary className="w-fit cursor-pointer rounded-sm text-body-sm font-medium text-text-primary hover:underline">
            Ver como tabela
          </summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left">
              <caption className="sr-only">{titulo}</caption>
              <thead>
                <tr className="border-b border-border text-label text-text-secondary">
                  {colunasTabela.map((c) => (
                    <th key={c.titulo} scope="col" className="px-2 py-2 font-medium first:pl-0">
                      {c.titulo}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {itens.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-b-0">
                    {colunasTabela.map((c, j) => {
                      const v = c.valor(item);
                      // Número em mono alinhado; texto na fonte do corpo.
                      return j === 0 ? (
                        <th
                          key={c.titulo}
                          scope="row"
                          className="whitespace-nowrap px-2 py-2 text-body-sm font-normal text-text-primary first:pl-0"
                        >
                          {v ?? "—"}
                        </th>
                      ) : typeof v === "number" ? (
                        <td key={c.titulo} className="px-2 py-2 font-mono text-body-sm tabular-nums text-text-primary">
                          {v.toLocaleString("pt-BR")}
                        </td>
                      ) : (
                        <td key={c.titulo} className="px-2 py-2 text-body-sm text-text-primary">
                          {v ?? "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <BotaoExportarCsv
            className="mt-3"
            nome={nomeCsv}
            rotulo={`Exportar "${titulo}" em CSV`}
            linhas={itens}
            colunas={colunasTabela}
          />
        </details>
      )}
    </Card>
  );
}
