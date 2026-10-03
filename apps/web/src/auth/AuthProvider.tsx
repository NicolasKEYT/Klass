import { useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import type { Profile } from "@klass/types";
import { queryClient } from "@/lib/consultas/cliente";
import { limparUltimaGravacao } from "@/lib/consultas/estadoGravacao";
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

function esvaziarCache() {
  queryClient.clear();
  limparUltimaGravacao();
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
    // Id do usuário cujo profile já está carregado. onAuthStateChange
    // dispara a CADA visibilitychange da aba (o supabase-js re-valida a
    // sessão ao focar) com eventos SIGNED_IN/TOKEN_REFRESHED do MESMO
    // usuário. Sem este guard, toda troca de aba re-buscava o profile e
    // ligava `carregando`, o que trocava a tela inteira pelo spinner do
    // <Autenticado> por 1-2s — a causa raiz do "recarrega ao trocar de
    // aba". Só re-carrega quando o usuário realmente muda.
    let idCarregado: string | null = null;

    async function sincronizar(session: Session | null) {
      const novoUsuario = session?.user ?? null;

      if (!novoUsuario) {
        // Saiu: o cache de leitura era desta conta (a RLS decide o que cada
        // uma vê) — não pode aparecer para a próxima.
        if (idCarregado !== null) esvaziarCache();
        idCarregado = null;
        setUsuario(null);
        setProfile(null);
        if (ativo) setCarregando(false);
        return;
      }

      // Mesmo usuário já carregado: atualiza só o objeto (token renovado)
      // sem re-buscar profile nem piscar o "Carregando".
      if (novoUsuario.id === idCarregado) {
        setUsuario(novoUsuario);
        return;
      }

      // Usuário novo/diferente (primeiro load, login, troca de conta):
      // aí sim carrega o profile. `carregando` cobre toda a busca para o
      // / não renderizar "Olá, ...!" com profile ainda nulo após o login.
      if (idCarregado !== null) esvaziarCache();
      idCarregado = novoUsuario.id;
      setCarregando(true);
      setUsuario(novoUsuario);

      const perfil = await buscarProfileComRetry(novoUsuario.id);
      // Guarda contra corrida: se o usuário mudou durante o fetch, ignora.
      if (ativo && idCarregado === novoUsuario.id) {
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
