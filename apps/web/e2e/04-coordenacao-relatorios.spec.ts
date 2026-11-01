import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { entrarComo } from "./apoio";

test.describe("Coordenação: acompanhamento e exports", () => {
  test("o relatório do período mostra indicadores e gráficos e o filtro vai para a URL", async ({ page }) => {
    await entrarComo(page, "coordenacao");
    await page.goto("/coordenacao/acompanhamento");
    await expect(page.getByRole("heading", { name: "Acompanhamento" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Relatório do período" })).toBeVisible();
    await expect(page.getByText("Alunos com matrícula ativa")).toBeVisible();
    await expect(page.getByText("Ocupação das turmas abertas")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Matrículas por mês" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Distribuição de notas" })).toBeVisible();

    // Os filtros valem só para o relatório e ficam na URL (podem ser compartilhados).
    await page.getByRole("combobox", { name: "Período" }).selectOption("tudo");
    await expect(page).toHaveURL(/periodo=tudo/);
    await page.getByRole("combobox", { name: "Trilha" }).selectOption({ label: "Ciência de Dados Aplicada" });
    await expect(page).toHaveURL(/trilha=/);
    await expect(page.getByText("Alunos com matrícula ativa")).toBeVisible();
  });

  test("a tela de exports conta cada lista e baixa um CSV que abre no Excel", async ({ page }) => {
    await entrarComo(page, "coordenacao");
    await page.goto("/coordenacao/exports");
    await expect(page.getByRole("button", { name: /^Alunos/ })).toBeVisible();
    for (const nome of ["Docentes", "Trilhas", "Turmas", "Matrículas", "Notas e frequência", "Certificados"]) {
      await expect(page.getByRole("button", { name: new RegExp(`^${nome}`) })).toBeVisible();
    }
    await page.getByRole("button", { name: /^Alunos/ }).click();

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: /CSV/ }).click();
    const arquivo = await download;
    expect(arquivo.suggestedFilename()).toMatch(/\.csv$/);

    const caminho = await arquivo.path();
    const bytes = await readFile(caminho);
    // UTF-8 com BOM, para o Excel em português ler os acentos.
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const texto = bytes.toString("utf-8");
    expect(texto).toContain("Nome;E-mail");
    expect(texto).toContain("aluno.teste@klass.dev");
  });
});
