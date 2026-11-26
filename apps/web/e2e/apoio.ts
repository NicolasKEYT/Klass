import { expect, type Page } from "@playwright/test";

// Usuários de demonstração do seed (supabase/seed.sql), só do banco local.
export const USUARIOS = {
  aluno: { email: "aluno.teste@klass.dev", senha: "klass-aluno-2026" },
  professor: { email: "professor.teste@klass.dev", senha: "klass-prof-2026" },
  coordenacao: { email: "coordenacao.teste@klass.dev", senha: "klass-coord-2026" },
} as const;

// Só preenche e envia o formulário; quem chama decide o que esperar (sucesso ou erro).
export async function enviarLogin(page: Page, email: string, senha: string) {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
}

export async function entrarComSenha(page: Page, email: string, senha: string) {
  await enviarLogin(page, email, senha);
  await expect(page).not.toHaveURL(/\/entrar/);
}

export async function entrarComo(page: Page, papel: keyof typeof USUARIOS) {
  await entrarComSenha(page, USUARIOS[papel].email, USUARIOS[papel].senha);
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

// Aluno só dos roteiros de senha. Os usuários de demonstração não servem: o
// roteiro troca a senha, e isso quebraria todos os outros se a rodada fosse
// interrompida no meio. É recriado a cada chamada, com a senha de partida.
export const ALUNO_DE_SENHA = { email: "aluno.senha@klass.dev", senha: "senha-inicial-2026" } as const;
const ID_ALUNO_DE_SENHA = "a1000000-0000-4000-8000-0000000000e1";

export function recriarAlunoDeSenha() {
  sql(`
    delete from auth.users where id = '${ID_ALUNO_DE_SENHA}';
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', '${ID_ALUNO_DE_SENHA}', 'authenticated', 'authenticated',
      '${ALUNO_DE_SENHA.email}', extensions.crypt('${ALUNO_DE_SENHA.senha}', extensions.gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}',
      jsonb_build_object('nome_completo', 'Aluno de Senha'),
      now(), now(), '', '', '', ''
    );
    insert into auth.identities (
      id, provider_id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      'b1000000-0000-4000-8000-0000000000e1', '${ID_ALUNO_DE_SENHA}', '${ID_ALUNO_DE_SENHA}',
      jsonb_build_object('sub', '${ID_ALUNO_DE_SENHA}', 'email', '${ALUNO_DE_SENHA.email}'),
      'email', now(), now(), now()
    );
  `);
}

// ---------------------------------------------------------------------------
// E-mail de teste do banco local (Mailpit, `[local_smtp]` do config.toml). Tudo
// que o Auth "envia" no banco local cai aqui, e nada sai para a internet.
const CAIXA_DE_TESTE = process.env.KLASS_E2E_EMAIL_URL ?? "http://127.0.0.1:54324";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(CAIXA_DE_TESTE)) {
  throw new Error("Os roteiros e2e só leem a caixa de e-mail de teste do banco local.");
}

const buscaDoDestinatario = (para: string) => encodeURIComponent(`to:${para}`);

export async function esvaziarCaixaDe(para: string) {
  await fetch(`${CAIXA_DE_TESTE}/api/v1/search?query=${buscaDoDestinatario(para)}`, { method: "DELETE" });
}

export async function contarEmailsPara(para: string): Promise<number> {
  const busca = await fetch(`${CAIXA_DE_TESTE}/api/v1/search?query=${buscaDoDestinatario(para)}`);
  const { messages = [] } = (await busca.json()) as { messages?: unknown[] };
  return messages.length;
}

// Espera chegar um e-mail para `para` com o assunto dado e devolve o HTML. O
// envio do Auth é assíncrono, por isso a espera em vez de uma leitura só.
export async function esperarEmail(para: string, assunto: RegExp): Promise<{ assunto: string; html: string }> {
  const limite = Date.now() + 30_000;
  while (Date.now() < limite) {
    const busca = await fetch(`${CAIXA_DE_TESTE}/api/v1/search?query=${buscaDoDestinatario(para)}`);
    const { messages = [] } = (await busca.json()) as { messages?: { ID: string; Subject: string }[] };
    const achado = messages.find((m) => assunto.test(m.Subject));
    if (achado) {
      const mensagem = await fetch(`${CAIXA_DE_TESTE}/api/v1/message/${achado.ID}`);
      const { HTML } = (await mensagem.json()) as { HTML: string };
      return { assunto: achado.Subject, html: HTML };
    }
    await new Promise((resolver) => setTimeout(resolver, 500));
  }
  throw new Error(`Nenhum e-mail com assunto ${assunto} chegou para ${para} em 30 s.`);
}

// O botão do e-mail e o texto de apoio apontam para o mesmo endereço do Auth.
export function linkDoEmail(html: string): string {
  const achado = html.match(/href="([^"]*\/auth\/v1\/verify[^"]*)"/);
  if (!achado) throw new Error("O e-mail não traz o link de verificação do Auth.");
  return achado[1].replaceAll("&amp;", "&");
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
