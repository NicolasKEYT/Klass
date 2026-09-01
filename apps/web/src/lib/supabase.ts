import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@klass/types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
// Publishable key (formato novo do Supabase, sb_publishable_...) — mesmo
// papel de segurança da antiga anon key: pública por design, protegida
// pela RLS. O nome da variável segue o que o projeto realmente emite.
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Fica nulo se as variáveis não estiverem definidas, para não quebrar o
// esqueleto antes das telas reais existirem.
export const supabase: SupabaseClient<Database> | null =
  supabaseUrl && supabasePublishableKey
    ? createClient<Database>(supabaseUrl, supabasePublishableKey)
    : null;
