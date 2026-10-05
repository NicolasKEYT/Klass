import { listarMateriaisDaTurma } from "@/lib/materiais";
import { keepPreviousData, queryOptions, useQueries, useQuery } from "@tanstack/react-query";
import {
  buscarAula,
  buscarNotasDasAvaliacoes,
  buscarPresencasDaAula,
  buscarProgressoDaTurma,
  buscarProgressoMatricula,
  filtrarAlunosMatriculados,
  identificarAlunosQuePedemAtencao,
  listarAulasDaTurma,
  listarAulasDaSemanaDoProfessor,
  listarAulasDeHojeDoProfessor,
  listarAulasComPresencaDoAluno,
  listarAvaliacoesComNotaDoAluno,
  listarAvaliacoesDaTurma,
  listarChamadasPendentesDaTurma,
  listarHistoricoEncerramentos,
  listarIdsDePresenca,
  listarNotasDaSemanaDoAluno,
  montarAulasDaSemanaDoAluno,
  listarNovidadesDoAluno,
  listarPendenciasDoProfessor,
  type ProgressoMatricula,
} from "@/lib/diario";
import type { MatriculaDoAluno } from "@/lib/selecao";
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
  historico: (turmaId: string) =>
    queryOptions({
      queryKey: chaves.diario.historico(turmaId),
      queryFn: () => listarHistoricoEncerramentos(turmaId),
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
  // Progresso da turma inteira numa RPC só (diario.progresso_da_turma):
  // diário do professor e da coordenação, grade de notas e "Alunos que
  // pedem atenção". Fica debaixo de progressos(), então toda invalidação
  // de progresso já existente também o alcança.
  progressoDaTurma: (turmaId: string) =>
    queryOptions({
      queryKey: chaves.diario.progressoDaTurma(turmaId),
      queryFn: () => buscarProgressoDaTurma(turmaId),
    }),
  chamadasPendentesDaTurma: (turmaId: string) =>
    queryOptions({
      queryKey: chaves.diario.chamadasPendentesDaTurma(turmaId),
      queryFn: () => listarChamadasPendentesDaTurma(turmaId),
    }),
  notasDoAluno: (matriculaId: string, turmaId: string) =>
    queryOptions({
      queryKey: chaves.diario.notasDoAluno(matriculaId, turmaId),
      queryFn: () => listarAvaliacoesComNotaDoAluno(matriculaId, turmaId),
    }),
  // Mesmo prefixo de matrícula das notas: o Realtime de presenças do
  // aluno (chaves.diario.matricula) já invalida esta entrada.
  aulasDoAluno: (matriculaId: string, turmaId: string) =>
    queryOptions({
      queryKey: chaves.diario.aulasDoAluno(matriculaId, turmaId),
      queryFn: () => listarAulasComPresencaDoAluno(matriculaId, turmaId),
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
  // Debaixo do prefixo do painel: criar/apagar aula e salvar chamada já
  // invalidam (paineisDeProfessor).
  aulasDaSemana: (professorId: string) =>
    queryOptions({
      queryKey: [...chaves.diario.painelProfessor(professorId), "semana"] as const,
      queryFn: async () =>
        listarAulasDaSemanaDoProfessor(
          professorId,
          await queryClient.fetchQuery(opcoesSelecao.turmasDoProfessor(professorId)),
        ),
    }),
  // Debaixo da chave das novidades: o Realtime do aluno, que já invalida
  // as novidades a cada nota, atualiza esta lista junto.
  notasDaSemana: (alunoId: string) =>
    queryOptions({
      queryKey: [...chaves.diario.novidades(alunoId), "semana"] as const,
      queryFn: async () =>
        listarNotasDaSemanaDoAluno(
          await queryClient.fetchQuery(opcoesSelecao.matriculasDoAluno(alunoId)),
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
  // Turmas em paralelo e progresso de cada turma numa RPC só (antes: três
  // RPCs por aluno).
  alunosQuePedemAtencao: (professorId: string) =>
    queryOptions({
      queryKey: [...chaves.diario.painelProfessor(professorId), "atencao"] as const,
      queryFn: async () => {
        const turmas = await queryClient.fetchQuery(opcoesSelecao.turmasDoProfessor(professorId));
        const alunos = await Promise.all(turmas.map((t) => alunosMatriculadosDaTurma(t.id)));
        const alunosPorTurma = new Map(turmas.map((t, i) => [t.id, alunos[i]]));
        const progressos = await Promise.all(
          turmas.map((t) => queryClient.fetchQuery(opcoesDiario.progressoDaTurma(t.id))),
        );
        return identificarAlunosQuePedemAtencao(
          turmas,
          alunosPorTurma,
          new Map(progressos.flatMap((p) => Object.entries(p))),
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

export function useMateriaisDaTurma(turmaId: string | undefined) {
  return useQuery({
    queryKey: chaves.diario.materiais(turmaId ?? ""),
    queryFn: () => listarMateriaisDaTurma(turmaId!),
    enabled: !!turmaId,
  });
}

export function useHistoricoEncerramentos(turmaId: string | undefined) {
  return useQuery({ ...opcoesDiario.historico(turmaId ?? ""), enabled: !!turmaId });
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

/**
 * Progresso das matrículas da turma, no mesmo formato de useProgressos
 * (porMatricula / pendente / erro / tentarDeNovo) para as telas trocarem
 * uma pela outra sem mudar o resto.
 */
export function useProgressoDaTurma(turmaId: string | undefined) {
  const consulta = useQuery({ ...opcoesDiario.progressoDaTurma(turmaId ?? ""), enabled: !!turmaId });
  return {
    porMatricula: new Map(Object.entries(consulta.data ?? {})),
    pendente: consulta.isPending,
    erro: consulta.error,
    tentarDeNovo: () => void consulta.refetch(),
  };
}

/** Das aulas pedidas, as que ainda não têm nenhuma presença (mesma entrada da tela de chamada). */
export function useAulasSemChamada(aulaIds: string[]) {
  return useQueries({
    queries: aulaIds.map((id) => opcoesDiario.presencas(id)),
    combine: (resultados) => aulaIds.filter((_, i) => resultados[i].data?.size === 0),
  });
}

export function useChamadasPendentesDaTurma(turmaId: string | undefined) {
  return useQuery({ ...opcoesDiario.chamadasPendentesDaTurma(turmaId ?? ""), enabled: !!turmaId });
}

export function useNotasDoAluno(matriculaId: string | undefined, turmaId: string | undefined) {
  return useQuery({
    ...opcoesDiario.notasDoAluno(matriculaId ?? "", turmaId ?? ""),
    enabled: !!matriculaId && !!turmaId,
  });
}

export function useAulasDoAluno(matriculaId: string | undefined, turmaId: string | undefined) {
  return useQuery({
    ...opcoesDiario.aulasDoAluno(matriculaId ?? "", turmaId ?? ""),
    enabled: !!matriculaId && !!turmaId,
  });
}

export function useNovidadesDoAluno(alunoId: string | undefined) {
  return useQuery({ ...opcoesDiario.novidades(alunoId ?? ""), enabled: !!alunoId });
}

/** Ids das presenças do aluno — só para o Realtime conferir exclusões. */
export function useIdsDePresenca(alunoId: string | undefined, matriculaIds: string[]) {
  return useQuery({
    queryKey: chaves.diario.idsDePresenca(alunoId ?? "", matriculaIds),
    queryFn: () => listarIdsDePresenca(matriculaIds),
    enabled: !!alunoId && matriculaIds.length > 0,
  });
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

export function useAulasDaSemana(professorId: string | undefined) {
  return useQuery({ ...opcoesDiario.aulasDaSemana(professorId ?? ""), enabled: !!professorId });
}

export function useNotasDaSemana(alunoId: string | undefined) {
  return useQuery({ ...opcoesDiario.notasDaSemana(alunoId ?? ""), enabled: !!alunoId });
}

/**
 * Próximas aulas do aluno, de todas as turmas que está cursando. Cada
 * turma lê a sua entrada de aulasDoAluno — a mesma da margem de faltas,
 * já atualizada pelo Realtime de presenças.
 */
export function useAulasDaSemanaDoAluno(matriculas: MatriculaDoAluno[] | undefined) {
  const cursando = (matriculas ?? []).filter((m) => m.status === "matriculada");
  return useQueries({
    queries: cursando.map((m) => opcoesDiario.aulasDoAluno(m.id, m.turmaId)),
    combine: (resultados) => ({
      aulas:
        matriculas && resultados.every((r) => r.data)
          ? montarAulasDaSemanaDoAluno(cursando.map((m, i) => ({ matricula: m, aulas: resultados[i].data! })))
          : undefined,
      erro: resultados.find((r) => r.error)?.error ?? null,
      tentarDeNovo: () => resultados.forEach((r) => r.error && void r.refetch()),
    }),
  });
}
