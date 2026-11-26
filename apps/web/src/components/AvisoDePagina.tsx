import type { ReactNode } from "react";
import { Card } from "@/components/Card";

interface AvisoDePaginaProps {
  titulo: string;
  texto: string;
  /** Botão ou link da única saída da tela. */
  acao: ReactNode;
  /**
   * Sem a casca do layout (visitante sem login, ou erro acima das rotas):
   * ocupa a tela inteira. Dentro da casca, ocupa só a área de conteúdo.
   */
  telaCheia?: boolean;
}

// Recado de tela inteira com uma saída: página não encontrada e erro
// inesperado. Mesmo card centralizado de AcessoNegado.
export function AvisoDePagina({ titulo, texto, acao, telaCheia = false }: AvisoDePaginaProps) {
  return (
    <main
      className={`flex items-center justify-center p-6 ${telaCheia ? "min-h-screen bg-background" : "flex-1 py-16"}`}
    >
      <Card className="flex max-w-sm flex-col items-center gap-3 text-center">
        <h1 className="text-klass-xl text-text-primary">{titulo}</h1>
        <p className="text-body-sm text-text-secondary">{texto}</p>
        {acao}
      </Card>
    </main>
  );
}
