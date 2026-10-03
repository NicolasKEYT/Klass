import { useLocation } from "react-router-dom";
import { useAuth } from "@/auth";
import { LinkComPrefetch } from "@/components/LinkComPrefetch";
import { navMobilePorPapel } from "./itensDeNavegacao";

// D3 (klass-uikit.pdf) — "celular: barra inferior fixa, 64px, rótulo
// sempre visível" para aluno e professor. Coordenação NÃO recebe barra
// inferior (ver PaginaAutenticada) — gestão de turmas/trilhas é tarefa de
// desktop, decisão do próprio kit (Moran/NN·g, 2019).
export function BarraInferior() {
  const { profile } = useAuth();
  const location = useLocation();
  const itens = navMobilePorPapel(profile?.papel);

  if (itens.length === 0) return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex h-16 border-t border-border bg-surface md:hidden"
      aria-label="Navegação principal"
    >
      {itens.map((item) => {
        const ativo =
          location.pathname === item.para ||
          (item.para !== "/" && location.pathname.startsWith(item.para));
        return (
          <LinkComPrefetch
            key={item.para}
            to={item.para}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 ${
              ativo ? "text-primary" : "text-text-secondary"
            }`}
          >
            <item.Icone className="h-5 w-5" aria-hidden />
            <span className={`text-label ${ativo ? "font-semibold" : "font-medium"}`}>
              {item.texto}
            </span>
          </LinkComPrefetch>
        );
      })}
    </nav>
  );
}
