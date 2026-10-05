import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";
import {
  buscarTurmaDetalhada,
  listarMatriculasDaTurma,
  listarMatriculasDoAluno,
  listarModulosComTurmasDaTrilha,
  listarTurmasDoProfessor,
  listarTurmasParaCoordenacao,
} from "@/lib/selecao";
import { chaves } from "./chaves";
import { queryClient } from "./cliente";
import { opcoesCatalogo } from "./catalogo";

// MS3 — Motor de Seleção: turmas e matrículas.
export const opcoesSelecao = {
  turmasDaCoordenacao: () =>
    queryOptions({
      queryKey: chaves.selecao.turmasDaCoordenacao(),
      queryFn: listarTurmasParaCoordenacao,
    }),
  turmasDoProfessor: (professorId: string) =>
    queryOptions({
      queryKey: chaves.selecao.turmasDoProfessor(professorId),
      queryFn: () => listarTurmasDoProfessor(professorId),
    }),
  turmasDaTrilha: (trilhaId: string, alunoId: string | null) =>
    queryOptions({
      queryKey: chaves.selecao.turmasDaTrilha(trilhaId, alunoId),
      queryFn: async () =>
        listarModulosComTurmasDaTrilha(
          trilhaId,
          alunoId,
          await queryClient.fetchQuery(opcoesCatalogo.modulos(trilhaId)),
        ),
      placeholderData: keepPreviousData,
    }),
  turma: (turmaId: string) =>
    queryOptions({
      queryKey: chaves.selecao.turma(turmaId),
      queryFn: () => buscarTurmaDetalhada(turmaId),
    }),
  // Uma lista por turma, de onde saem os "alunos do diário" e os
  // "matriculados" (filtros puros em lib/diario) — antes eram buscas
  // separadas da mesma tabela.
  matriculasDaTurma: (turmaId: string) =>
    queryOptions({
      queryKey: chaves.selecao.matriculasDaTurma(turmaId),
      queryFn: () => listarMatriculasDaTurma(turmaId),
    }),
  matriculasDoAluno: (alunoId: string) =>
    queryOptions({
      queryKey: chaves.selecao.matriculasDoAluno(alunoId),
      queryFn: () => listarMatriculasDoAluno(alunoId),
    }),
};

export function useTurmasDaCoordenacao() {
  return useQuery(opcoesSelecao.turmasDaCoordenacao());
}

export function useTurmasDoProfessor(professorId: string | undefined) {
  return useQuery({ ...opcoesSelecao.turmasDoProfessor(professorId ?? ""), enabled: !!professorId });
}

export function useTurmasDaTrilha(trilhaId: string | undefined, alunoId: string | null) {
  return useQuery({ ...opcoesSelecao.turmasDaTrilha(trilhaId ?? "", alunoId), enabled: !!trilhaId });
}

export function useTurma(turmaId: string | undefined) {
  return useQuery({ ...opcoesSelecao.turma(turmaId ?? ""), enabled: !!turmaId });
}

export function useMatriculasDaTurma(turmaId: string | undefined) {
  return useQuery({ ...opcoesSelecao.matriculasDaTurma(turmaId ?? ""), enabled: !!turmaId });
}

export function useMatriculasDoAluno(alunoId: string | undefined) {
  return useQuery({ ...opcoesSelecao.matriculasDoAluno(alunoId ?? ""), enabled: !!alunoId });
}
