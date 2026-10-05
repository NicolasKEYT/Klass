import { queryOptions, useQuery } from "@tanstack/react-query";
import {
  buscarIndicadoresDasViews,
  calcularFrequencias,
  listarPendenciasCoordenacao,
} from "@/lib/painelCoordenacao";
import { chaves } from "./chaves";

// Painel "Início" da coordenação (D7): frequências calculadas uma vez só e
// compartilhadas entre os indicadores e a tabela de turmas; a lista de
// turmas é a mesma da tela "Turmas" (opcoesSelecao.turmasDaCoordenacao).
export const opcoesPainelCoordenacao = {
  frequencias: () =>
    queryOptions({ queryKey: chaves.painelCoordenacao.frequencias(), queryFn: calcularFrequencias }),
  indicadoresDasViews: () =>
    queryOptions({
      queryKey: chaves.painelCoordenacao.indicadoresDasViews(),
      queryFn: buscarIndicadoresDasViews,
    }),
  pendencias: () =>
    queryOptions({
      queryKey: chaves.painelCoordenacao.pendencias(),
      queryFn: listarPendenciasCoordenacao,
    }),
};

export function useFrequenciasCoordenacao() {
  return useQuery(opcoesPainelCoordenacao.frequencias());
}

export function useIndicadoresDasViews() {
  return useQuery(opcoesPainelCoordenacao.indicadoresDasViews());
}

export function usePendenciasCoordenacao() {
  return useQuery(opcoesPainelCoordenacao.pendencias());
}
