import { expect, test } from "@playwright/test";
import {
  ALUNO_DE_SENHA,
  contarEmailsPara,
  enviarLogin,
  entrarComSenha,
  esperarEmail,
  esvaziarCaixaDe,
  linkDoEmail,
  recriarAlunoDeSenha,
} from "./apoio";

const SENHA_NOVA = "senha-nova-2026";
const SENHA_DO_PERFIL = "senha-do-perfil-2026";

test.beforeEach(async () => {
  recriarAlunoDeSenha();
  await esvaziarCaixaDe(ALUNO_DE_SENHA.email);
});

test("esqueci a senha: do pedido ao login com a senha nova", async ({ browser }) => {
  const contexto = await browser.newContext();
  const pagina = await contexto.newPage();

  // Pedido: a partir da tela de entrada.
  await pagina.goto("/entrar");
  await pagina.getByRole("link", { name: "Esqueci minha senha" }).click();
  // Espera o título da tela nova, não só a URL: a URL muda antes de o React
  // trocar a tela, e um fill nesse intervalo cairia no campo da tela de entrada.
  await expect(pagina.getByRole("heading", { name: "Esqueci minha senha", level: 1 })).toBeVisible();
  await pagina.getByLabel("E-mail").fill(ALUNO_DE_SENHA.email);
  await pagina.getByRole("button", { name: "Enviar link" }).click();
  await expect(pagina.getByRole("heading", { name: "Confira seu e-mail" })).toBeVisible();

  // E-mail: o modelo do Klass, de redefinição (não o de confirmação de cadastro).
  const email = await esperarEmail(ALUNO_DE_SENHA.email, /Redefina sua senha do Klass/);
  expect(email.html).toContain("Criar nova senha");
  expect(email.html).not.toContain("Confirmar e-mail");
  const link = linkDoEmail(email.html);

  // O link é aberto como a pessoa faria, num navegador sem sessão nenhuma.
  const aberturaDoLink = await (await browser.newContext()).newPage();
  await aberturaDoLink.goto(link);
  await expect(aberturaDoLink).toHaveURL(/\/redefinir-senha/);
  await expect(aberturaDoLink.getByRole("heading", { name: "Defina uma nova senha" })).toBeVisible();

  // Senhas diferentes não passam; iguais, sim.
  await aberturaDoLink.getByLabel("Nova senha", { exact: true }).fill(SENHA_NOVA);
  await aberturaDoLink.getByLabel("Confirmar nova senha").fill(`${SENHA_NOVA}-outra`);
  await aberturaDoLink.getByRole("button", { name: "Salvar nova senha" }).click();
  await expect(aberturaDoLink.getByText("As senhas não coincidem.")).toBeVisible();
  await aberturaDoLink.getByLabel("Confirmar nova senha").fill(SENHA_NOVA);
  await aberturaDoLink.getByRole("button", { name: "Salvar nova senha" }).click();
  await expect(aberturaDoLink.getByRole("heading", { name: "Senha alterada" })).toBeVisible();

  // Login: a senha antiga deixou de valer e a nova entra.
  const login = await (await browser.newContext()).newPage();
  await enviarLogin(login, ALUNO_DE_SENHA.email, ALUNO_DE_SENHA.senha);
  await expect(login.getByText("E-mail ou senha incorretos.")).toBeVisible();
  await entrarComSenha(login, ALUNO_DE_SENHA.email, SENHA_NOVA);

  // O link só vale uma vez: abrir de novo cai em "inválido", com saída para pedir outro.
  const reuso = await (await browser.newContext()).newPage();
  await reuso.goto(link);
  await expect(reuso.getByRole("heading", { name: "Link inválido ou expirado" })).toBeVisible();
  await expect(reuso.getByRole("link", { name: "Pedir um novo link" })).toBeVisible();
});

test("a tela de nova senha não serve a quem só está logado", async ({ page }) => {
  // Quem tem a sessão aberta (sem ter vindo do link) não troca a senha sem a atual.
  await entrarComSenha(page, ALUNO_DE_SENHA.email, ALUNO_DE_SENHA.senha);
  await page.goto("/redefinir-senha");
  await expect(page.getByRole("heading", { name: "Link inválido ou expirado" })).toBeVisible();
  await expect(page.getByLabel("Nova senha")).toHaveCount(0);
});

test("pedir link para um e-mail sem conta responde igual e não envia nada", async ({ page }) => {
  const semConta = "ninguem.aqui@klass.dev";
  await esvaziarCaixaDe(semConta);
  await page.goto("/esqueci-senha");
  await page.getByLabel("E-mail").fill(semConta);
  await page.getByRole("button", { name: "Enviar link" }).click();
  await expect(page.getByRole("heading", { name: "Confira seu e-mail" })).toBeVisible();
  // Ausência não se espera: dá o tempo que o Auth leva para enviar quando envia.
  await page.waitForTimeout(3_000);
  expect(await contarEmailsPara(semConta)).toBe(0);
});

test("perfil: trocar senha exige a atual e vale no login seguinte", async ({ page, browser }) => {
  await entrarComSenha(page, ALUNO_DE_SENHA.email, ALUNO_DE_SENHA.senha);
  await page.goto("/perfil");
  await expect(page.getByRole("heading", { name: "Trocar senha" })).toBeVisible();

  // Senha atual errada: recusa, sem trocar nada.
  await page.getByLabel("Senha atual").fill("senha-que-nao-e-essa");
  await page.getByLabel("Nova senha", { exact: true }).fill(SENHA_DO_PERFIL);
  await page.getByLabel("Confirmar nova senha").fill(SENHA_DO_PERFIL);
  await page.getByRole("button", { name: "Trocar senha" }).click();
  await expect(page.getByText("A senha atual está incorreta.")).toBeVisible();

  // Senha atual certa: troca.
  await page.getByLabel("Senha atual").fill(ALUNO_DE_SENHA.senha);
  await page.getByRole("button", { name: "Trocar senha" }).click();
  await expect(page.getByText("Senha alterada.")).toBeVisible();

  // No login seguinte, só a nova entra.
  const outro = await (await browser.newContext()).newPage();
  await enviarLogin(outro, ALUNO_DE_SENHA.email, ALUNO_DE_SENHA.senha);
  await expect(outro.getByText("E-mail ou senha incorretos.")).toBeVisible();
  await entrarComSenha(outro, ALUNO_DE_SENHA.email, SENHA_DO_PERFIL);
});
