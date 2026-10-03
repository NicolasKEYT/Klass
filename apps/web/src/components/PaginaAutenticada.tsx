import type { ReactNode } from "react";

// Invólucro de conteúdo das telas autenticadas: só largura e espaçamento.
// A casca (barra lateral, faixa superior, barra inferior) mora em
// LayoutAutenticado e não remonta ao navegar. Larguras: "ampla" para
// listagens/tabelas densas (coordenação), "padrao" para a maioria,
// "estreita" para formulários (não ganham nada em esticar). O gutter px-4
// (16px) no mobile e px-6 no >=sm evita o conteúdo colado na borda em
// telas estreitas.
type Largura = "estreita" | "padrao" | "ampla";

const larguraClasse: Record<Largura, string> = {
  estreita: "max-w-2xl",
  padrao: "max-w-5xl",
  ampla: "max-w-6xl",
};

interface PaginaAutenticadaProps {
  children: ReactNode;
  largura?: Largura;
  className?: string;
}

export function PaginaAutenticada({
  children,
  largura = "padrao",
  className = "",
}: PaginaAutenticadaProps) {
  return (
    <main
      className={`mx-auto w-full flex-1 ${larguraClasse[largura]} px-4 pb-24 pt-4 sm:px-6 md:pb-6 ${className}`}
    >
      {children}
    </main>
  );
}
