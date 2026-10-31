import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { chaves } from "./chaves";

// O que cada gravação deixa desatualizado. invalidateQueries marca as
// entradas como velhas: as que estão na tela são relidas na hora (em
// segundo plano, sem esqueleto), as demais só quando a tela abrir de novo.
// Invalidar por prefixo é deliberado — vários resumos (painel "Hoje",
// painel da coordenação, listas com contagem) derivam do mesmo dado.
function invalidarTudo(qc: QueryClient, chavesAfetadas: QueryKey[]) {
  return Promise.all(chavesAfetadas.map((queryKey) => qc.invalidateQueries({ queryKey })));
}

export const invalidar = {
  /** Trilha, módulo ou ordem dos módulos (criar, editar, publicar, apagar, reordenar). */
  catalogo: (qc: QueryClient) =>
    // selecao/certificacao também: turmas, matrículas e certificados mostram
    // nome de trilha e módulo, e a média mínima da trilha entra no diário.
    invalidarTudo(qc, [
      chaves.catalogo.tudo(),
      chaves.selecao.tudo(),
      chaves.certificacao.tudo(),
      chaves.painelCoordenacao.tudo(),
      chaves.relatorios.tudo(),
    ]),

  /**
   * Módulo criado, editado, apagado ou reordenado. Mais estreito que
   * `catalogo`: não toca nas listas de trilhas além da contagem/carga. O
   * formulário da trilha na edição é estado local da tela (inicializado
   * uma vez), então reler a trilha em segundo plano não apaga o que o
   * usuário digitou e ainda não salvou.
   */
  modulos: (qc: QueryClient, trilhaId: string) =>
    invalidarTudo(qc, [
      chaves.catalogo.modulos(trilhaId),
      ["catalogo", "pre-requisitos"],
      // Carga horária total e contagem de módulos (recalculadas por trigger).
      chaves.catalogo.trilhasComContagem(),
      ["catalogo", "trilha"],
      // Turmas, matrículas e certificados mostram o nome do módulo.
      chaves.selecao.tudo(),
      chaves.painelCoordenacao.tudo(),
      chaves.relatorios.tudo(),
    ]),

  /**
   * Pré-requisito marcado/desmarcado na edição de trilha. A lista de ids
   * da própria tela já foi atualizada na hora (otimista) e não é relida —
   * reler no meio de cliques seguidos desfazia a marca do clique seguinte.
   */
  preRequisitos: (qc: QueryClient, trilhaId: string) =>
    invalidarTudo(qc, [
      chaves.catalogo.preRequisitosDaTrilha(trilhaId),
      ["catalogo", "pre-requisitos", "modulo"],
      chaves.relatorios.tudo(),
    ]),

  /** Avaliação criada, editada, apagada ou restaurada (apagar leva as notas junto, em cascata). */
  avaliacoes: (qc: QueryClient, turmaId: string) =>
    invalidarTudo(qc, [
      chaves.diario.turma(turmaId),
      chaves.diario.progressos(),
      chaves.diario.notasDosAlunos(),
      chaves.diario.paineisDeProfessor(),
      chaves.relatorios.tudo(),
    ]),

  /** Aula criada, gerada em lote, editada ou apagada. */
  aulas: (qc: QueryClient, turmaId: string, aulaId?: string) =>
    invalidarTudo(qc, [
      chaves.diario.aulas(turmaId),
      ...(aulaId ? [chaves.diario.aula(aulaId)] : []),
      chaves.diario.progressos(),
      chaves.diario.paineisDeProfessor(),
      chaves.painelCoordenacao.tudo(),
      chaves.relatorios.tudo(),
    ]),

  /** Nota lançada/alterada (a grade já atualiza a própria célula no cache). */
  nota: (qc: QueryClient, matriculaId: string) =>
    invalidarTudo(qc, [
      chaves.diario.progresso(matriculaId),
      // Progresso em lote das turmas (a matrícula está numa delas).
      ["diario", "progresso", "turma"],
      chaves.diario.paineisDeProfessor(),
      chaves.relatorios.tudo(),
    ]),

  /** Coordenação liberou a chamada de uma aula fora do prazo. */
  liberacaoDeChamada: (qc: QueryClient, turmaId: string, aulaId: string) =>
    invalidarTudo(qc, [
      chaves.diario.aulas(turmaId),
      chaves.diario.chamadasPendentesDaTurma(turmaId),
      chaves.diario.aula(aulaId),
      chaves.diario.paineisDeProfessor(),
      chaves.painelCoordenacao.tudo(),
      chaves.relatorios.tudo(),
    ]),

  /** Chamada salva. */
  chamada: (qc: QueryClient, aulaId: string) =>
    invalidarTudo(qc, [
      chaves.diario.presencas(aulaId),
      chaves.diario.progressos(),
      chaves.diario.paineisDeProfessor(),
      chaves.painelCoordenacao.tudo(),
      chaves.relatorios.tudo(),
    ]),

  /**
   * Situação de matrícula mudou: aprovar, rejeitar, remover, encerrar
   * aluno/turma, desfazer encerramento, reativar turma. Encerrar pode
   * emitir certificado e desfazer pode revogá-lo (no banco); as três ações
   * entram no histórico de encerramentos da turma.
   */
  matriculas: (qc: QueryClient, turmaId: string) =>
    invalidarTudo(qc, [
      chaves.selecao.matriculasDaTurma(turmaId),
      chaves.diario.historico(turmaId),
      // Histórico do aluno no painel lateral e pré-requisitos das demais
      // inscrições (aprovar/encerrar muda o que o aluno já concluiu).
      ["selecao", "matriculas", "aluno"],
      ["selecao", "pre-requisitos"],
      chaves.selecao.listas(),
      chaves.diario.progressos(),
      chaves.diario.paineisDeProfessor(),
      chaves.painelCoordenacao.tudo(),
      chaves.relatorios.tudo(),
      chaves.certificacao.tudo(),
    ]),

  /** Turma criada ou editada (código, professor, período, vagas, frequência). */
  turma: (qc: QueryClient, turmaId?: string) =>
    invalidarTudo(qc, [
      ...(turmaId ? [chaves.selecao.turma(turmaId)] : []),
      chaves.selecao.listas(),
      chaves.diario.paineisDeProfessor(),
      chaves.painelCoordenacao.tudo(),
      chaves.relatorios.tudo(),
    ]),

  /**
   * Papel de uma pessoa trocado na tela Pessoas. Listas de pessoas e de
   * professores (seleção de professor da turma) e a busca de alunos do
   * painel dependem do papel.
   */
  papel: (qc: QueryClient) => invalidarTudo(qc, [chaves.identidade.tudo(), chaves.relatorios.tudo()]),

  /** Inscrição do próprio aluno numa turma. */
  inscricao: (qc: QueryClient, alunoId: string) =>
    invalidarTudo(qc, [
      chaves.selecao.matriculasDoAluno(alunoId),
      chaves.selecao.listas(),
      chaves.diario.novidades(alunoId),
    ]),
};
