import { useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import type { Profile } from "@klass/types";
import { supabase } from "@/lib/supabase";
import { AuthContext, type CadastroResultado } from "./AuthContext";
import { mensagemDeErroAuth } from "./mensagensDeErro";

// O trigger que cria o profile roda na mesma transação do INSERT em
// auth.users, então normalmente já está lá quando a resposta do signUp
// volta. Essa espera é só uma rede de segurança para variação de latência
// de conexão — uma tentativa extra, não um polling indefinido.
async function buscarProfileComRetry(userId: string): Promise<Profile | null> {
  if (!supabase) return null;

  const primeira = await supabase
    .schema("identidade")
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (primeira.data) return primeira.data;

  await new Promise((resolve) => setTimeout(resolve, 400));
  const segunda = await supabase
    .schema("identidade")
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  return segunda.data ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setCarregando(false);
      return;
    }

    let ativo = true;

    async function sincronizar(session: Session | null) {
      // carregando cobre toda troca de sessão, não só a primeira: entrar()
      // só espera o signInWithPassword, não a busca do profile (que roda
      // à parte, disparada por este listener) — sem isso, o /  renderia
      // "Olá, ...!" com o profile ainda nulo por uma fração de segundo
      // logo após o login.
      setCarregando(true);
      const novoUsuario = session?.user ?? null;
      setUsuario(novoUsuario);

      if (!novoUsuario) {
        setProfile(null);
        if (ativo) setCarregando(false);
        return;
      }

      const perfil = await buscarProfileComRetry(novoUsuario.id);
      if (ativo) {
        setProfile(perfil);
        setCarregando(false);
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_evento, session) => {
      void sincronizar(session);
    });

    return () => {
      ativo = false;
      subscription.unsubscribe();
    };
  }, []);

  async function entrar(email: string, senha: string) {
    if (!supabase) throw new Error("Supabase não configurado.");
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) throw new Error(mensagemDeErroAuth(error));
  }

  async function cadastrar(
    email: string,
    senha: string,
    nomeCompleto: string,
  ): Promise<CadastroResultado> {
    if (!supabase) throw new Error("Supabase não configurado.");
    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: { data: { nome_completo: nomeCompleto } },
    });
    if (error) throw new Error(mensagemDeErroAuth(error));

    // Sem sessão + com usuário criado = Supabase está esperando a
    // confirmação de e-mail antes de liberar o login.
    return { precisaConfirmarEmail: data.user !== null && data.session === null };
  }

  async function sair() {
    if (!supabase) return;
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ usuario, profile, carregando, entrar, cadastrar, sair }}>
      {children}
    </AuthContext.Provider>
  );
}
