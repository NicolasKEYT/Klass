import { defineConfig } from "@playwright/test";

// Os roteiros só rodam contra o banco local (`supabase start`): eles criam e
// alteram dados, e rodadas de teste no Supabase hospedado já contaminaram a
// produção. Por isso a configuração recusa qualquer URL que não seja local.
const urlSupabase = process.env.KLASS_E2E_SUPABASE_URL ?? "http://127.0.0.1:54321";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(urlSupabase)) {
  throw new Error(`Os roteiros e2e só rodam no banco local; URL recusada: ${urlSupabase}`);
}
const chavePublicavel = process.env.KLASS_E2E_PUBLISHABLE_KEY;
if (!chavePublicavel) {
  throw new Error("Defina KLASS_E2E_PUBLISHABLE_KEY (use e2e/rodar.sh, que a lê de `supabase status`).");
}

const PORTA = 5199;

export default defineConfig({
  testDir: "./e2e",
  // Os roteiros compartilham o mesmo banco local: um por vez, na ordem dos arquivos.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORTA}`,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
    acceptDownloads: true,
  },
  webServer: {
    command: `pnpm exec vite --host 127.0.0.1 --port ${PORTA} --strictPort`,
    port: PORTA,
    reuseExistingServer: false,
    env: {
      VITE_SUPABASE_URL: urlSupabase,
      VITE_SUPABASE_PUBLISHABLE_KEY: chavePublicavel,
    },
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
