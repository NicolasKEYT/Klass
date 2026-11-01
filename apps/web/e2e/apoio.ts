import { expect, type Page } from "@playwright/test";

// Usuários de demonstração do seed (supabase/seed.sql), só do banco local.
export const USUARIOS = {
  aluno: { email: "aluno.teste@klass.dev", senha: "klass-aluno-2026" },
  professor: { email: "professor.teste@klass.dev", senha: "klass-prof-2026" },
  coordenacao: { email: "coordenacao.teste@klass.dev", senha: "klass-coord-2026" },
} as const;

export async function entrarComo(page: Page, papel: keyof typeof USUARIOS) {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(USUARIOS[papel].email);
  await page.getByLabel("Senha").fill(USUARIOS[papel].senha);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).not.toHaveURL(/\/entrar/);
}

// ---------------------------------------------------------------------------
// Cenário dos roteiros. É montado por SQL direto no banco local (como dono do
// banco, ignorando a RLS), com datas relativas a hoje, para os roteiros não
// envelhecerem junto com as datas fixas do seed. Os IDs são fixos e o script
// é idempotente. O que cada roteiro testa acontece depois, pela interface.
import { execFileSync } from "node:child_process";

const BANCO_LOCAL = process.env.KLASS_E2E_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
if (!/@(127\.0\.0\.1|localhost):\d+\//.test(BANCO_LOCAL)) {
  throw new Error("Os roteiros e2e só alteram o banco local.");
}

export function sql(comando: string): string {
  return execFileSync("psql", [BANCO_LOCAL, "-X", "-At", "-v", "ON_ERROR_STOP=1", "-c", comando], {
    encoding: "utf-8",
    env: { ...process.env, PATH: `/opt/homebrew/opt/libpq/bin:${process.env.PATH}` },
  }).trim();
}

export const IDS = {
  aluno: "a1000000-0000-4000-8000-000000000001",
  professor: "a1000000-0000-4000-8000-000000000002",
  coordenacao: "a1000000-0000-4000-8000-000000000003",
  trilha: "f1000000-0000-4000-8000-000000000001",
  moduloA: "f2000000-0000-4000-8000-00000000000a",
  moduloB: "f2000000-0000-4000-8000-00000000000b",
  moduloC: "f2000000-0000-4000-8000-00000000000c",
  turmaA: "f3000000-0000-4000-8000-00000000000a",
  turmaB: "f3000000-0000-4000-8000-00000000000b",
  turmaC: "f3000000-0000-4000-8000-00000000000c",
} as const;

export function semearCenario() {
  sql(`
    insert into catalogo.trilhas (id, slug, nome, descricao, publicada, tipo_certificacao, media_minima, frequencia_minima_percentual)
      values ('${IDS.trilha}', 'trilha-e2e', 'Trilha E2E', 'Trilha usada pelos roteiros automatizados', true, 'modulo', 7, 75)
      on conflict (id) do nothing;
    insert into catalogo.modulos (id, trilha_id, ordem, nome, descricao, nivel, carga_horaria_horas) values
      ('${IDS.moduloA}', '${IDS.trilha}', 1, 'Modulo E2E A', 'Módulo para o roteiro de inscrição', 'iniciante', 10),
      ('${IDS.moduloB}', '${IDS.trilha}', 2, 'Modulo E2E B', 'Módulo para o roteiro de chamada e notas', 'iniciante', 10),
      ('${IDS.moduloC}', '${IDS.trilha}', 3, 'Modulo E2E C', 'Módulo para o roteiro de encerramento', 'iniciante', 10)
      on conflict (id) do nothing;
    insert into selecao.turmas (id, modulo_id, codigo, professor_id, periodo_inicio, periodo_fim, vagas_total)
      select t.id, t.modulo_id, t.codigo, '${IDS.professor}', diario.hoje() - 10, diario.hoje() + 30, 5
      from (values ('${IDS.turmaA}'::uuid, '${IDS.moduloA}'::uuid, 'E2E-A1'),
                   ('${IDS.turmaB}'::uuid, '${IDS.moduloB}'::uuid, 'E2E-B1'),
                   ('${IDS.turmaC}'::uuid, '${IDS.moduloC}'::uuid, 'E2E-C1')) t(id, modulo_id, codigo)
      on conflict (id) do nothing;
  `);
}
