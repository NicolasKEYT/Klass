import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import type { Papel } from "@klass/types";
import { useAuth } from "./AuthContext";

interface AutenticadoProps {
  /** Sem filhos, vira rota de layout e renderiza a rota filha (<Outlet/>). */
  children?: ReactNode;
  /** Exige esse papel específico; redireciona para /acesso-negado se não bater. */
  papel?: Papel;
}

// Guarda de rota. Em App.tsx ela envolve a rota de layout autenticada (roda
// uma vez, não a cada tela) e, com `papel`, cada grupo de rotas por papel.
export function Autenticado({ children, papel }: AutenticadoProps) {
  const { usuario, profile, carregando } = useAuth();
  const location = useLocation();

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center text-body-sm text-text-secondary">
        Carregando...
      </div>
    );
  }

  if (!usuario) {
    return <Navigate to="/entrar" replace state={{ from: location }} />;
  }

  if (papel && profile?.papel !== papel) {
    return <Navigate to="/acesso-negado" replace />;
  }

  return <>{children ?? <Outlet />}</>;
}
