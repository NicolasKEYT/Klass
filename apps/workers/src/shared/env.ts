// Bindings de ambiente do Worker. Nenhum valor vive aqui — todos são
// configurados via `wrangler secret put` ou `.dev.vars` (ver wrangler.toml
// e README).
export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  RESEND_API_KEY: string;
  ALLOWED_ORIGIN?: string;
  WEBHOOK_SECRET: string;
}
