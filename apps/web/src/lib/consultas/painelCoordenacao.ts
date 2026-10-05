import { queryOptions, useQuery } from "@tanstack/react-query";
import {
  buscarChamadasAtrasadas,
  buscarLinhasDasViews,
  calcularFrequencias,
  listarInscricoesRecentes,
  listarPendenciasCoordenacao,
  resumirViews,
} from "@/lib/painelCoordenacao";
import { chaves } from "./chaves";
import { queryClient } from "./cliente";

// Painel "Início" da coordenação (D7) e a tela Acompanhamento: frequências
// (agregadas no banco, uma linha por turma) lidas uma vez só e compartilhadas entre os indicadores, a tabela de
// turmas e o gráfico de frequência; as views do artigo lidas linha a linha
// uma vez e resumidas para os indicadores; a lista de turmas é a mesma da
// tela "Turmas" (opcoesSelecao.turmasDaCoordenacao).
export const opcoesPainelCoordenacao = {
  frequencias: () =>
    queryOptions({ queryKey: chaves.painelCoordenacao.frequencias(), queryFn: calcularFrequencias }),
  linhasDasViews: () =>
    queryOptions({ queryKey: chaves.painelCoordenacao.linhasDasViews(), queryFn: buscarLinhasDasViews }),
  indicadoresDasViews: () =>
    queryOptions({
      queryKey: chaves.painelCoordenacao.indicadoresDasViews(),
      queryFn: async () =>
        resumirViews(await queryClient.fetchQuery(opcoesPainelCoordenacao.linhasDasViews())),
    }),
  chamadasAtrasadas: () =>
    queryOptions({
      queryKey: chaves.painelCoordenacao.chamadasAtrasadas(),
      queryFn: buscarChamadasAtrasadas,
    }),
  inscricoesRecentes: () =>
    queryOptions({
      queryKey: chaves.painelCoordenacao.inscricoesRecentes(),
      queryFn: listarInscricoesRecentes,
    }),
  pendencias: () =>
    queryOptions({
      queryKey: chaves.painelCoordenacao.pendencias(),
      queryFn: () =>
        listarPendenciasCoordenacao(
          () => queryClient.fetchQuery(opcoesPainelCoordenacao.chamadasAtrasadas()),
          () => queryClient.fetchQuery(opcoesPainelCoordenacao.frequencias()),
        ),
    }),
};

export function useFrequenciasCoordenacao() {
  return useQuery(opcoesPainelCoordenacao.frequencias());
}

export function useIndicadoresDasViews() {
  return useQuery(opcoesPainelCoordenacao.indicadoresDasViews());
}

export function useLinhasDasViews() {
  return useQuery(opcoesPainelCoordenacao.linhasDasViews());
}

export function useChamadasAtrasadas() {
  return useQuery(opcoesPainelCoordenacao.chamadasAtrasadas());
}

export function useInscricoesRecentes() {
  return useQuery(opcoesPainelCoordenacao.inscricoesRecentes());
}

export function usePendenciasCoordenacao() {
  return useQuery(opcoesPainelCoordenacao.pendencias());
}
