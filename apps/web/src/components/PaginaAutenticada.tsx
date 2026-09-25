import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Monitor } from "lucide-react";
import { BarraInferior } from "@/components/navegacao/BarraInferior";
import { BarraLateral } from "@/components/navegacao/BarraLateral";
import { TiraSuperior } from "@/components/navegacao/TiraSuperior";
import { useAuth } from "@/auth";
import { useEhMobile } from "@/lib/useEhMobile";

// Casca comum das telas autenticadas. D3 (klass-uikit.pdf) trocou o
// cabeçalho horizontal por barra lateral no desktop + barra inferior no
// celular (aluno/professor). Larguras: "ampla" para listagens/tabelas
// densas (coordenação), "padrao" para a maioria, "estreita" para
// formulários (não ganham nada em esticar). O gutter px-4 (16px) no
// mobile e px-6 no >=sm evita o conteúdo colado na borda em telas
// estreitas.
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
  const { profile } = useAuth();
  const location = useLocation();
  const ehMobile = useEhMobile();

  // D3 — "no celular, a coordenação vê só o Início com as pendências;
  // gestão de turmas e trilhas é tarefa de desktop" (Moran/NN·g, 2019).
  // Em vez de redirecionar (o que perderia o estado de formulários em
  // andamento sem aviso), mostramos um recado honesto no lugar do
  // conteúdo — a tela continua existindo, só não é usável do celular.
  const bloqueadoNoMobile = profile?.papel === "coordenacao" && ehMobile && location.pathname !== "/";

  return (
    <div className="min-h-screen bg-background md:flex">
      <BarraLateral />
      <div className="flex min-h-screen flex-1 flex-col">
        <TiraSuperior />
        {bloqueadoNoMobile ? (
          <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <Monitor className="h-8 w-8 text-text-muted" aria-hidden />
            <p className="max-w-xs text-body-sm text-text-secondary">
              Esta tela é feita para telas maiores. Gestão de turmas e trilhas é tarefa de
              computador — no celular, use o Início para acompanhar as pendências.
            </p>
            <Link to="/" className="text-body-sm font-medium text-primary hover:underline">
              Voltar ao Início
            </Link>
          </main>
        ) : (
          <main
            className={`mx-auto w-full flex-1 ${larguraClasse[largura]} px-4 pb-24 pt-4 sm:px-6 md:pb-6 ${className}`}
          >
            {children}
          </main>
        )}
      </div>
      <BarraInferior />
    </div>
  );
}
