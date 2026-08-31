import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Apenas a anon key entra no frontend — a RLS é quem protege os dados.
// Fica nulo se as variáveis não estiverem definidas, para não quebrar o
// esqueleto antes das telas reais existirem.
export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;
