import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import type { Papel } from "@klass/types";
import { useAuth } from "./AuthContext";

interface AutenticadoProps {
  children: ReactNode;
  /** Exige esse papel específico; redireciona para /acesso-negado se não bater. */
  papel?: Papel;
}

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

  return <>{children}</>;
}
