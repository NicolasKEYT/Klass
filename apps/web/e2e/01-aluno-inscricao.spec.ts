import { expect, test } from "@playwright/test";
import { entrarComo, IDS, semearCenario, sql } from "./apoio";

test("o aluno se inscreve, a coordenação aprova e o aluno passa a cursar", async ({ browser }) => {
  semearCenario();
  const aluno = await (await browser.newContext()).newPage();
  const coordenacao = await (await browser.newContext()).newPage();

  // Aluno: abre o módulo, vê a turma e envia a inscrição.
  await entrarComo(aluno, "aluno");
  await aluno.goto(`/catalogo/trilha-e2e/modulos/${IDS.moduloA}`);
  await expect(aluno.getByRole("heading", { name: "Modulo E2E A", level: 1 })).toBeVisible();
  await expect(aluno.getByText(/E2E-A1/)).toBeVisible();
  await aluno.getByRole("button", { name: "Inscrever-se" }).click();
  await expect(aluno.getByText("Inscrição enviada")).toBeVisible();
  await expect(aluno.getByText("Em análise", { exact: true })).toBeVisible();

  // Coordenação: vê a inscrição pendente da turma e a aprova.
  await entrarComo(coordenacao, "coordenacao");
  await coordenacao.goto(`/coordenacao/turmas/${IDS.turmaA}`);
  await coordenacao.getByRole("tab", { name: /Inscrições/ }).click();
  await coordenacao.getByRole("checkbox", { name: "Selecionar Aluno de Teste" }).check();
  await coordenacao.getByRole("button", { name: /Aprovar/ }).first().click();

  // A tela do aluno reage sem recarregar (Realtime): a inscrição deixa de estar "em análise".
  await expect(aluno.getByText("Em análise", { exact: true })).toBeHidden();
  // O deferimento ficou registrado no banco, com quem deferiu.
  expect(sql(`select status || ' ' || (deferido_por is not null) from selecao.matriculas where aluno_id = '${IDS.aluno}' and turma_id = '${IDS.turmaA}'`)).toBe("matriculada true");
  await aluno.goto("/aluno/boletim");
  await expect(aluno.getByRole("heading", { name: "Modulo E2E A", level: 3 })).toBeVisible();
});
