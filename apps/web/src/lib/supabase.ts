import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@klass/types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
// Publishable key (formato novo do Supabase, sb_publishable_...) — mesmo
// papel de segurança da antiga anon key: pública por design, protegida
// pela RLS. O nome da variável segue o que o projeto realmente emite.
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// O link de "Esqueci minha senha" abre o site com `type=recovery` na URL. O
// supabase-js lê esse trecho e o apaga da barra de endereço logo ao ser criado
// (abaixo), então o sinal precisa ser guardado antes. É ele que diferencia quem
// chegou pelo link do e-mail de quem só está com a sessão aberta: só o primeiro
// pode criar uma nova senha sem informar a atual.
export const ABRIU_LINK_DE_RECUPERACAO =
  typeof window !== "undefined" &&
  /(^|[#&?])type=recovery(&|$)/.test(window.location.hash + window.location.search);

// Fica nulo se as variáveis não estiverem definidas, para não quebrar o
// esqueleto antes das telas reais existirem.
export const supabase: SupabaseClient<Database> | null =
  supabaseUrl && supabasePublishableKey
    ? createClient<Database>(supabaseUrl, supabasePublishableKey)
    : null;
