// Fábrica única das chaves do cache de leitura (TanStack Query), agrupadas
// pelos cinco bounded contexts. A chave é o endereço do dado no cache:
// duas telas que pedem a mesma chave compartilham a mesma busca, e uma
// gravação invalida pelo prefixo (ex.: chaves.diario.turma(id) cobre
// avaliações, aulas e notas daquela turma). Chaves dependem só de ids —
// nunca do objeto `usuario` — para a revalidação de sessão do Supabase ao
// focar a aba não disparar busca nenhuma.
export const chaves = {
  catalogo: {
    tudo: () => ["catalogo"] as const,
    trilhas: () => ["catalogo", "trilhas"] as const,
    trilhasComContagem: () => ["catalogo", "trilhas", "com-contagem"] as const,
    trilhaPorSlug: (slug: string) => ["catalogo", "trilha", "slug", slug] as const,
    trilhaPorId: (id: string) => ["catalogo", "trilha", "id", id] as const,
    modulos: (trilhaId: string) => ["catalogo", "modulos", trilhaId] as const,
    preRequisitosDaTrilha: (trilhaId: string) =>
      ["catalogo", "pre-requisitos", "trilha", trilhaId, "nomes"] as const,
    preRequisitosIdsDaTrilha: (trilhaId: string) =>
      ["catalogo", "pre-requisitos", "trilha", trilhaId, "ids"] as const,
    preRequisitosDoModulo: (moduloId: string) =>
      ["catalogo", "pre-requisitos", "modulo", moduloId] as const,
  },
  identidade: {
    tudo: () => ["identidade"] as const,
    professores: () => ["identidade", "professores"] as const,
    pessoas: () => ["identidade", "pessoas"] as const,
    buscaAlunos: (termo: string) => ["identidade", "busca-alunos", termo] as const,
  },
  selecao: {
    tudo: () => ["selecao"] as const,
    /** Prefixo das listas com contagem de matrículas/vagas. */
    listas: () => ["selecao", "listas"] as const,
    turmasDaCoordenacao: () => ["selecao", "listas", "coordenacao"] as const,
    turmasDoProfessor: (professorId: string) =>
      ["selecao", "listas", "professor", professorId] as const,
    turmasDaTrilha: (trilhaId: string, alunoId: string | null) =>
      ["selecao", "listas", "trilha", trilhaId, alunoId ?? "-"] as const,
    turma: (turmaId: string) => ["selecao", "turma", turmaId] as const,
    matriculasDaTurma: (turmaId: string) => ["selecao", "matriculas", "turma", turmaId] as const,
    matriculasDoAluno: (alunoId: string) => ["selecao", "matriculas", "aluno", alunoId] as const,
  },
  diario: {
    tudo: () => ["diario"] as const,
    /** Prefixo de tudo do diário de uma turma (avaliações, aulas, notas). */
    turma: (turmaId: string) => ["diario", "turma", turmaId] as const,
    avaliacoes: (turmaId: string) => ["diario", "turma", turmaId, "avaliacoes"] as const,
    aulas: (turmaId: string) => ["diario", "turma", turmaId, "aulas"] as const,
    notas: (turmaId: string, avaliacaoIds: string[]) =>
      ["diario", "turma", turmaId, "notas", avaliacaoIds] as const,
    aula: (aulaId: string) => ["diario", "aula", aulaId] as const,
    presencas: (aulaId: string) => ["diario", "aula", aulaId, "presencas"] as const,
    progressos: () => ["diario", "progresso"] as const,
    progresso: (matriculaId: string) => ["diario", "progresso", matriculaId] as const,
    /** Prefixo do que o boletim mostra de uma matrícula (notas por avaliação). */
    matricula: (matriculaId: string) => ["diario", "matricula", matriculaId] as const,
    notasDoAluno: (matriculaId: string, turmaId: string) =>
      ["diario", "matricula", matriculaId, "notas", turmaId] as const,
    notasDosAlunos: () => ["diario", "matricula"] as const,
    painelProfessor: (professorId: string) => ["diario", "painel-professor", professorId] as const,
    paineisDeProfessor: () => ["diario", "painel-professor"] as const,
    novidades: (alunoId: string) => ["diario", "painel-aluno", alunoId, "novidades"] as const,
  },
  certificacao: {
    tudo: () => ["certificacao"] as const,
    doAluno: (alunoId: string) => ["certificacao", "aluno", alunoId] as const,
    todos: () => ["certificacao", "todos"] as const,
    trilhaTemCertificados: (trilhaId: string) => ["certificacao", "trilha", trilhaId] as const,
    verificacao: (hash: string) => ["certificacao", "verificacao", hash] as const,
  },
  // Painel agregador da coordenação (lê catalogo, selecao e diario).
  painelCoordenacao: {
    tudo: () => ["painel-coordenacao"] as const,
    frequencias: () => ["painel-coordenacao", "frequencias"] as const,
    indicadoresDasViews: () => ["painel-coordenacao", "views"] as const,
    pendencias: () => ["painel-coordenacao", "pendencias"] as const,
  },
};
