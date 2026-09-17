import type { ReactNode } from "react";
import { Cabecalho } from "@/components/Cabecalho";

// Casca comum das telas autenticadas: cabeçalho + container central com
// largura máxima e gutter responsivo. Centraliza o que antes cada tela
// repetia à mão com larguras diferentes (max-w-3xl/4xl/5xl), o que fazia
// o conteúdo ocupar ~30% da tela no desktop e sobrar espaço vazio.
//
// Larguras: "ampla" para listagens/tabelas densas (coordenação),
// "padrao" para a maioria, "estreita" para formulários (não ganham nada
// em esticar). O gutter px-4 (16px) no mobile e px-6 no >=sm evita o
// conteúdo colado na borda em telas estreitas.
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
    <div className="min-h-screen bg-background">
      <Cabecalho />
      <main className={`mx-auto w-full ${larguraClasse[largura]} px-4 py-6 sm:px-6 ${className}`}>
        {children}
      </main>
    </div>
  );
}
