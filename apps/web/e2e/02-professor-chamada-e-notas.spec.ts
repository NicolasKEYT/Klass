import { expect, test } from "@playwright/test";
import { entrarComo, IDS, semearCenario, sql } from "./apoio";

test("o professor faz a chamada e lança a nota, e o aluno vê o resultado sem recarregar", async ({ browser }) => {
  semearCenario();
  // Aluno já matriculado na turma B, com uma aula de ontem sem chamada e uma avaliação sem nota.
  sql(`
    insert into selecao.matriculas (aluno_id, turma_id, status, deferido_por, deferido_em)
      select '${IDS.aluno}', '${IDS.turmaB}', 'matriculada', '${IDS.coordenacao}', now()
      where not exists (select 1 from selecao.matriculas where aluno_id = '${IDS.aluno}' and turma_id = '${IDS.turmaB}');
    insert into diario.aulas (turma_id, data, horario)
      select '${IDS.turmaB}', diario.hoje() - 1, '19:00'
      where not exists (select 1 from diario.aulas where turma_id = '${IDS.turmaB}');
    insert into diario.avaliacoes (turma_id, titulo, peso, ordem)
      select '${IDS.turmaB}', 'Prova E2E', 1, 1
      where not exists (select 1 from diario.avaliacoes where turma_id = '${IDS.turmaB}');
  `);

  const aluno = await (await browser.newContext()).newPage();
  const professor = await (await browser.newContext()).newPage();

  // O aluno deixa o boletim aberto: a nota deve aparecer nele sem recarregar a página.
  await entrarComo(aluno, "aluno");
  await aluno.goto("/aluno/boletim");
  await expect(aluno.getByRole("heading", { name: "Modulo E2E B", level: 3 })).toBeVisible();

  await entrarComo(professor, "professor");

  // Chamada: todos começam presentes; o professor salva.
  await professor.goto(`/professor/turmas/${IDS.turmaB}?aba=aulas`);
  await professor.getByRole("link", { name: "Fazer chamada" }).click();
  await expect(professor.getByRole("heading", { name: /Chamada/ })).toBeVisible();
  await professor.getByRole("button", { name: "Salvar chamada" }).click();
  await expect(professor.getByText(/chamada salva|salva/i).first()).toBeVisible();

  // Nota: valor fora da faixa é recusado com mensagem clara; o valor válido é salvo.
  await professor.goto(`/professor/turmas/${IDS.turmaB}?aba=avaliacoes`);
  const campo = professor.getByRole("textbox", { name: "Nota de Aluno de Teste em Prova E2E" });
  await campo.fill("11");
  await campo.press("Enter");
  await expect(professor.getByText(/A nota precisa ser um número entre 0 e 10/)).toBeVisible();
  await campo.fill("8");
  await campo.press("Enter");
  await expect(professor.getByRole("cell", { name: "8,0" }).first()).toBeVisible();

  // Realtime: o boletim do aluno, aberto desde o início, mostra a nota.
  await expect(aluno.getByText(/Média 8,0/)).toBeVisible();
});
