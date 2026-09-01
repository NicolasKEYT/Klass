import { createClient } from "@supabase/supabase-js";
import type { Database } from "@klass/types";
import type { Env } from "./env";

/**
 * Cliente Supabase com a service role key. Ignora RLS por completo —
 * use apenas em rotinas sem usuário na ponta (webhooks, cron), nunca para
 * atender uma requisição em nome de um usuário autenticado. Essa é a
 * garantia que o CLAUDE.md exige: a service key nunca entra no frontend e,
 * aqui no Worker, só serve para os casos que o próprio Supabase não
 * resolve sozinho.
 */
export function createSupabaseAdmin(env: Env) {
  return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}
