import type { ReactNode } from "react";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { IndicadorSincronizacao } from "@/components/IndicadorSincronizacao";

// Invólucro de conteúdo das telas autenticadas. A casca (barra lateral,
// faixa superior do celular, barra inferior) mora em LayoutAutenticado e
// não remonta ao navegar.
//
// Cabeçalho de página (klass-uikit.pdf, pág. 3, 9, 10 e 11): faixa com
// linha inferior, sobrelinha (data, semestre ou trilha de navegação),
// título e, à direita, o indicador de sincronização (D13) e as ações da
// tela. No celular a faixa perde a linha e o indicador, que já fica na
// faixa superior da casca. Abas, quando a tela tem, ficam dentro da faixa.
//
// Larguras: "conteudo" aproveita a área ao lado da barra lateral até
// 1200px (listas, tabelas, painéis); "media" para leitura em coluna única
// (boletim, módulo, chamada); "estreita" para formulários, que não ganham
// nada em esticar. O gutter px-4 (16px) no celular e px-6 no >=sm evita o
// conteúdo colado na borda em telas estreitas.
type Largura = "estreita" | "media" | "conteudo";

const larguraClasse: Record<Largura, string> = {
  estreita: "max-w-2xl",
  media: "max-w-3xl",
  conteudo: "max-w-klass-conteudo",
};

export interface VoltarDoCabecalho {
  /** Destino fixo (ver BotaoVoltar). */
  para?: string;
  /** Destino quando não há tela anterior no histórico (ver BotaoVoltar). */
  seSemHistorico?: string;
  rotulo?: string;
  /**
   * "chevron" (padrão): só o chevron, à esquerda do título (Chamada, pág. 8).
   * "acima": chevron + rótulo numa linha acima do título (Detalhe de
   * módulo, pág. 6: "‹ Catálogo").
   */
  posicao?: "chevron" | "acima";
}

interface PaginaAutenticadaProps {
  children: ReactNode;
  largura?: Largura;
  className?: string;
  titulo?: ReactNode;
  /** Linha pequena acima do título: data, semestre, "Turmas / CÓDIGO"... */
  sobrelinha?: ReactNode;
  /** Linha abaixo do título (Chamada, pág. 8: "CÓDIGO · qui 24/09 · 10:00"). */
  subtitulo?: ReactNode;
  /** Botões/busca à direita do título (desktop) ou abaixo dele (celular). */
  acoes?: ReactNode;
  voltar?: VoltarDoCabecalho;
  /** Abas da tela, dentro da faixa do cabeçalho (pág. 9 e 11). */
  abas?: ReactNode;
  /**
   * Painel lateral fixo aberto à direita (pág. 11): no desktop a página
   * inteira, cabeçalho incluído, recua a largura do painel para nada
   * ficar por baixo dele.
   */
  comPainelLateral?: boolean;
}

export function PaginaAutenticada({
  children,
  largura = "conteudo",
  className = "",
  titulo,
  sobrelinha,
  subtitulo,
  acoes,
  voltar,
  abas,
  comPainelLateral = false,
}: PaginaAutenticadaProps) {
  const container = `mx-auto w-full ${larguraClasse[largura]} px-4 sm:px-6`;
  return (
    <main className={`flex flex-1 flex-col ${comPainelLateral ? "md:pr-klass-painel" : ""}`}>
      <header className="md:border-b md:border-border">
        <div className={`${container} pt-4 ${abas ? "" : "pb-2 md:pb-4"}`}>
          {voltar?.posicao === "acima" && (
            <BotaoVoltar
              chevron="com-rotulo"
              para={voltar.para}
              seSemHistorico={voltar.seSemHistorico}
              rotulo={voltar.rotulo}
            />
          )}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-6">
            <div className="flex min-w-0 items-start gap-1">
              {voltar && voltar.posicao !== "acima" && (
                <BotaoVoltar
                  chevron="so-icone"
                  para={voltar.para}
                  seSemHistorico={voltar.seSemHistorico}
                  rotulo={voltar.rotulo}
                />
              )}
              <div className="min-w-0">
                {sobrelinha && <div className="text-body-sm text-text-secondary">{sobrelinha}</div>}
                {titulo && (
                  <h1 className="break-words text-klass-2xl text-text-primary">{titulo}</h1>
                )}
                {subtitulo && <div className="text-body-sm text-text-secondary">{subtitulo}</div>}
              </div>
            </div>
            <div className={`${acoes ? "flex" : "hidden md:flex"} flex-wrap items-center gap-3 md:shrink-0 md:justify-end`}>
              {acoes}
              <IndicadorSincronizacao className="hidden md:inline-flex" />
            </div>
          </div>
          {abas && <div className="mt-3">{abas}</div>}
        </div>
      </header>
      <div className={`${container} flex-1 pb-24 pt-4 md:pb-8 md:pt-6 ${className}`}>{children}</div>
    </main>
  );
}
