import { keepPreviousData, queryOptions, useQueries, useQuery } from "@tanstack/react-query";
import {
  buscarAula,
  buscarNotasDasAvaliacoes,
  buscarPresencasDaAula,
  buscarProgressoMatricula,
  filtrarAlunosMatriculados,
  identificarAlunosQuePedemAtencao,
  listarAulasDaTurma,
  listarAulasDeHojeDoProfessor,
  listarAvaliacoesComNotaDoAluno,
  listarAvaliacoesDaTurma,
  listarNovidadesDoAluno,
  listarPendenciasDoProfessor,
  type ProgressoMatricula,
} from "@/lib/diario";
import { chaves } from "./chaves";
import { queryClient } from "./cliente";
import { opcoesSelecao } from "./selecao";

// MS4 — Diário de Classe. As consultas compostas (painel "Hoje" do
// professor, novidades do aluno) pegam turmas, matrículas e progresso do
// próprio cache com fetchQuery: se outra tela já buscou, não há nova ida
// ao banco; se há uma busca em andamento, ela é compartilhada.

function alunosMatriculadosDaTurma(turmaId: string) {
  return queryClient
    .fetchQuery(opcoesSelecao.matriculasDaTurma(turmaId))
    .then(filtrarAlunosMatriculados);
}

export const opcoesDiario = {
  avaliacoes: (turmaId: string) =>
    queryOptions({
      queryKey: chaves.diario.avaliacoes(turmaId),
      queryFn: () => listarAvaliacoesDaTurma(turmaId),
    }),
  aulas: (turmaId: string) =>
    queryOptions({
      queryKey: chaves.diario.aulas(turmaId),
      queryFn: () => listarAulasDaTurma(turmaId),
    }),
  // As avaliações entram na chave: criar ou apagar uma muda a chave, e o
  // keepPreviousData mantém a grade com as notas atuais enquanto a nova
  // leitura chega (sem piscar).
  notas: (turmaId: string, avaliacaoIds: string[]) =>
    queryOptions({
      queryKey: chaves.diario.notas(turmaId, avaliacaoIds),
      queryFn: () => buscarNotasDasAvaliacoes(avaliacaoIds),
      placeholderData: keepPreviousData,
    }),
  aula: (aulaId: string) =>
    queryOptions({ queryKey: chaves.diario.aula(aulaId), queryFn: () => buscarAula(aulaId) }),
  presencas: (aulaId: string) =>
    queryOptions({
      queryKey: chaves.diario.presencas(aulaId),
      queryFn: () => buscarPresencasDaAula(aulaId),
    }),
  // Média, frequência e "pronto para encerrar" por matrícula: a mesma
  // entrada serve o diário da turma, a grade, o "Hoje" e o boletim.
  progresso: (matriculaId: string) =>
    queryOptions({
      queryKey: chaves.diario.progresso(matriculaId),
      queryFn: () => buscarProgressoMatricula(matriculaId),
    }),
  notasDoAluno: (matriculaId: string, turmaId: string) =>
    queryOptions({
      queryKey: chaves.diario.notasDoAluno(matriculaId, turmaId),
      queryFn: () => listarAvaliacoesComNotaDoAluno(matriculaId, turmaId),
    }),
  novidades: (alunoId: string) =>
    queryOptions({
      queryKey: chaves.diario.novidades(alunoId),
      queryFn: async () =>
        listarNovidadesDoAluno(
          alunoId,
          await queryClient.fetchQuery(opcoesSelecao.matriculasDoAluno(alunoId)),
        ),
    }),
  aulasDeHoje: (professorId: string) =>
    queryOptions({
      queryKey: [...chaves.diario.painelProfessor(professorId), "aulas-de-hoje"] as const,
      queryFn: async () =>
        listarAulasDeHojeDoProfessor(
          professorId,
          await queryClient.fetchQuery(opcoesSelecao.turmasDoProfessor(professorId)),
        ),
    }),
  pendenciasDoProfessor: (professorId: string) =>
    queryOptions({
      queryKey: [...chaves.diario.painelProfessor(professorId), "pendencias"] as const,
      queryFn: async () =>
        listarPendenciasDoProfessor(
          professorId,
          await queryClient.fetchQuery(opcoesSelecao.turmasDoProfessor(professorId)),
          alunosMatriculadosDaTurma,
        ),
    }),
  // Turmas em paralelo (antes: uma por vez) e progresso de cada aluno do
  // cache por matrícula.
  alunosQuePedemAtencao: (professorId: string) =>
    queryOptions({
      queryKey: [...chaves.diario.painelProfessor(professorId), "atencao"] as const,
      queryFn: async () => {
        const turmas = await queryClient.fetchQuery(opcoesSelecao.turmasDoProfessor(professorId));
        const alunos = await Promise.all(turmas.map((t) => alunosMatriculadosDaTurma(t.id)));
        const alunosPorTurma = new Map(turmas.map((t, i) => [t.id, alunos[i]]));
        const matriculaIds = alunos.flat().map((a) => a.matriculaId);
        const progressos = await Promise.all(
          matriculaIds.map((id) => queryClient.fetchQuery(opcoesDiario.progresso(id))),
        );
        return identificarAlunosQuePedemAtencao(
          turmas,
          alunosPorTurma,
          new Map(matriculaIds.map((id, i) => [id, progressos[i]])),
        );
      },
    }),
};

export function useAvaliacoesDaTurma(turmaId: string | undefined) {
  return useQuery({ ...opcoesDiario.avaliacoes(turmaId ?? ""), enabled: !!turmaId });
}

export function useAulasDaTurma(turmaId: string | undefined) {
  return useQuery({ ...opcoesDiario.aulas(turmaId ?? ""), enabled: !!turmaId });
}

export function useNotasDaTurma(turmaId: string | undefined, avaliacaoIds: string[] | undefined) {
  return useQuery({
    ...opcoesDiario.notas(turmaId ?? "", avaliacaoIds ?? []),
    enabled: !!turmaId && !!avaliacaoIds,
  });
}

export function useAula(aulaId: string | undefined) {
  return useQuery({ ...opcoesDiario.aula(aulaId ?? ""), enabled: !!aulaId });
}

export function usePresencasDaAula(aulaId: string | undefined) {
  return useQuery({ ...opcoesDiario.presencas(aulaId ?? ""), enabled: !!aulaId });
}

export function useProgresso(matriculaId: string | undefined) {
  return useQuery({ ...opcoesDiario.progresso(matriculaId ?? ""), enabled: !!matriculaId });
}

/**
 * Progresso de várias matrículas em paralelo, cada uma na sua entrada do
 * cache. `pendente` só é true enquanto alguma ainda não tem dado nenhum
 * (primeira carga) — atualização em segundo plano não conta.
 */
export function useProgressos(matriculaIds: string[]) {
  return useQueries({
    queries: matriculaIds.map((id) => opcoesDiario.progresso(id)),
    combine: (resultados) => {
      const porMatricula = new Map<string, ProgressoMatricula>();
      resultados.forEach((r, i) => {
        if (r.data) porMatricula.set(matriculaIds[i], r.data);
      });
      return {
        porMatricula,
        pendente: resultados.some((r) => r.isPending),
        erro: resultados.find((r) => r.error)?.error ?? null,
        tentarDeNovo: () => resultados.forEach((r) => r.error && void r.refetch()),
      };
    },
  });
}

export function useNotasDoAluno(matriculaId: string | undefined, turmaId: string | undefined) {
  return useQuery({
    ...opcoesDiario.notasDoAluno(matriculaId ?? "", turmaId ?? ""),
    enabled: !!matriculaId && !!turmaId,
  });
}

export function useNovidadesDoAluno(alunoId: string | undefined) {
  return useQuery({ ...opcoesDiario.novidades(alunoId ?? ""), enabled: !!alunoId });
}

export function useAulasDeHoje(professorId: string | undefined) {
  return useQuery({ ...opcoesDiario.aulasDeHoje(professorId ?? ""), enabled: !!professorId });
}

export function usePendenciasDoProfessor(professorId: string | undefined) {
  return useQuery({ ...opcoesDiario.pendenciasDoProfessor(professorId ?? ""), enabled: !!professorId });
}

export function useAlunosQuePedemAtencao(professorId: string | undefined) {
  return useQuery({ ...opcoesDiario.alunosQuePedemAtencao(professorId ?? ""), enabled: !!professorId });
}
