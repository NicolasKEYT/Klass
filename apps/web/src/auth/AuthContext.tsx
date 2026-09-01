import { createContext, useContext } from "react";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@klass/types";

export interface CadastroResultado {
  /** true quando o Supabase exige confirmação de e-mail antes de liberar a sessão. */
  precisaConfirmarEmail: boolean;
}

export interface AuthContextValue {
  usuario: User | null;
  profile: Profile | null;
  carregando: boolean;
  entrar: (email: string, senha: string) => Promise<void>;
  cadastrar: (
    email: string,
    senha: string,
    nomeCompleto: string,
  ) => Promise<CadastroResultado>;
  sair: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const contexto = useContext(AuthContext);
  if (!contexto) {
    throw new Error("useAuth precisa ser usado dentro de um <AuthProvider>.");
  }
  return contexto;
}
