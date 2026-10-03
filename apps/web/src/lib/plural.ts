// Concordância de número nos textos da interface, no lugar de "aula(s)"
// e "serão criada(s)". Recebe as duas formas prontas (não tenta derivar
// o plural), porque em português o plural muitas vezes arrasta verbo e
// particípio junto: plural(n, "aula será criada", "aulas serão criadas").

/** Só a forma flexionada, sem o número: flexionar(2, "aluno", "alunos") → "alunos". */
export function flexionar(quantidade: number, singular: string, plural: string): string {
  return Math.abs(quantidade) === 1 ? singular : plural;
}

/** Número + forma flexionada: plural(1, "aula", "aulas") → "1 aula". */
export function plural(quantidade: number, singular: string, formaPlural: string): string {
  return `${quantidade} ${flexionar(quantidade, singular, formaPlural)}`;
}
