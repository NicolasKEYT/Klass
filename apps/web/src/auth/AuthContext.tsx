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
  /**
   * true quando a sessão veio do link de redefinição de senha, enviado por
   * e-mail, e a senha nova ainda não foi gravada.
   */
  emRecuperacao: boolean;
  entrar: (email: string, senha: string) => Promise<void>;
  cadastrar: (
    email: string,
    senha: string,
    nomeCompleto: string,
  ) => Promise<CadastroResultado>;
  sair: () => Promise<void>;
  /**
   * Pede o e-mail com o link para criar uma nova senha. Não revela se o
   * e-mail tem conta: o Supabase responde igual nos dois casos, e a tela
   * também.
   */
  pedirRedefinicaoDeSenha: (email: string) => Promise<void>;
  /**
   * Grava a nova senha da sessão atual: a de recuperação, aberta pelo link do
   * e-mail, ou a de quem já está logado.
   */
  definirNovaSenha: (senha: string) => Promise<void>;
  /** Troca a senha de quem está logado, conferindo antes a senha atual. */
  trocarSenha: (senhaAtual: string, novaSenha: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const contexto = useContext(AuthContext);
  if (!contexto) {
    throw new Error("useAuth precisa ser usado dentro de um <AuthProvider>.");
  }
  return contexto;
}
