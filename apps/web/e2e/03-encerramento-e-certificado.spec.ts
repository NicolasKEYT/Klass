import { expect, test } from "@playwright/test";
import { entrarComo, IDS, semearCenario, sql } from "./apoio";

test("o professor encerra a matrícula, o aluno recebe o certificado e a coordenação o revoga", async ({ browser }) => {
  semearCenario();
  // Aluno matriculado na turma C, com chamada feita e nota 9 lançada: pronto para encerrar.
  sql(`
    insert into selecao.matriculas (aluno_id, turma_id, status, deferido_por, deferido_em)
      select '${IDS.aluno}', '${IDS.turmaC}', 'matriculada', '${IDS.coordenacao}', now()
      where not exists (select 1 from selecao.matriculas where aluno_id = '${IDS.aluno}' and turma_id = '${IDS.turmaC}');
    insert into diario.aulas (turma_id, data, horario)
      select '${IDS.turmaC}', diario.hoje() - 1, '19:00'
      where not exists (select 1 from diario.aulas where turma_id = '${IDS.turmaC}');
    insert into diario.avaliacoes (turma_id, titulo, peso, ordem)
      select '${IDS.turmaC}', 'Prova E2E', 1, 1
      where not exists (select 1 from diario.avaliacoes where turma_id = '${IDS.turmaC}');
    insert into diario.presencas (aula_id, matricula_id, presente, registrada_por)
      select a.id, m.id, true, '${IDS.professor}' from diario.aulas a, selecao.matriculas m
      where a.turma_id = '${IDS.turmaC}' and m.turma_id = '${IDS.turmaC}'
        and not exists (select 1 from diario.presencas p where p.aula_id = a.id);
    insert into diario.notas (avaliacao_id, matricula_id, valor, lancada_por)
      select v.id, m.id, 9, '${IDS.professor}' from diario.avaliacoes v, selecao.matriculas m
      where v.turma_id = '${IDS.turmaC}' and m.turma_id = '${IDS.turmaC}'
        and not exists (select 1 from diario.notas n where n.avaliacao_id = v.id);
  `);

  const professor = await (await browser.newContext()).newPage();
  const aluno = await (await browser.newContext()).newPage();
  const coordenacao = await (await browser.newContext()).newPage();
  const publico = await (await browser.newContext()).newPage();

  // Professor encerra a matrícula do aluno.
  await entrarComo(professor, "professor");
  await professor.goto(`/professor/turmas/${IDS.turmaC}?aba=alunos`);
  await professor.getByRole("button", { name: "Encerrar aluno" }).click();
  await expect(professor.getByText("Concluído")).toBeVisible();

  // O registro do certificado nasce por trigger no banco.
  const codigo = sql(`select hash_publico from certificacao.certificados where turma_codigo = 'E2E-C1' and revogado_em is null`);
  expect(codigo).toMatch(/^KLASS-\d{4}-[A-Z0-9]{8}$/);

  // Aluno vê o certificado do módulo.
  await entrarComo(aluno, "aluno");
  await aluno.goto("/aluno/certificados");
  await expect(aluno.getByText("Modulo E2E C").first()).toBeVisible();

  // Qualquer pessoa verifica o código, sem login.
  await publico.goto(`/verificar/${codigo}`);
  await expect(publico.getByText("Aluno de Teste")).toBeVisible();
  await expect(publico.getByText(/revogado/i)).toBeHidden();

  // Coordenação desfaz o encerramento com motivo; o certificado passa a constar como revogado.
  await entrarComo(coordenacao, "coordenacao");
  await coordenacao.goto(`/coordenacao/turmas/${IDS.turmaC}`);
  await coordenacao.getByRole("tab", { name: /Alunos/ }).click();
  await coordenacao.getByRole("button", { name: /Desfazer encerramento/ }).click();
  await coordenacao.getByRole("textbox").fill("Nota lançada para o aluno errado");
  await coordenacao.getByRole("button", { name: /Confirmar|Desfazer/ }).last().click();

  await publico.goto(`/verificar/${codigo}`);
  await expect(publico.getByText(/revogado/i).first()).toBeVisible();

  // No banco: o certificado está revogado com o motivo, e a matrícula voltou a ficar ativa.
  expect(sql(`select (revogado_em is not null) || ' ' || motivo_revogacao from certificacao.certificados where hash_publico = '${codigo}'`))
    .toContain("true");
  expect(sql(`select status from selecao.matriculas where aluno_id = '${IDS.aluno}' and turma_id = '${IDS.turmaC}'`)).toBe("matriculada");
});
