import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";
import {
  buscarIndicadores,
  buscarPaginaRelatorio,
  buscarRelatorioCompleto,
  contarRelatorio,
  type ConjuntoRelatorio,
  type FiltrosIndicadores,
  type FiltrosRelatorio,
} from "@/lib/relatorios";
import { chaves } from "./chaves";

export const opcoesRelatorios = {
  contagem: (conjunto: ConjuntoRelatorio, filtros: FiltrosRelatorio) =>
    queryOptions({
      queryKey: chaves.relatorios.contagem(conjunto, filtros),
      queryFn: () => contarRelatorio(conjunto, filtros),
    }),
  pagina: <C extends ConjuntoRelatorio>(
    conjunto: C,
    filtros: FiltrosRelatorio,
    pagina: number,
    tamanho: number,
  ) =>
    queryOptions({
      queryKey: chaves.relatorios.pagina(conjunto, filtros, pagina, tamanho),
      queryFn: () => buscarPaginaRelatorio(conjunto, filtros, pagina, tamanho),
    }),
  // Para queryClient.fetchQuery no clique de exportar: o arquivo sai sempre do
  // que o servidor tem agora, e a lista inteira não fica guardada no navegador.
  completo: <C extends ConjuntoRelatorio>(conjunto: C, filtros: FiltrosRelatorio) =>
    queryOptions({
      queryKey: chaves.relatorios.completo(conjunto, filtros),
      queryFn: () => buscarRelatorioCompleto(conjunto, filtros),
      staleTime: 0,
      gcTime: 0,
    }),
  indicadores: (filtros: FiltrosIndicadores) =>
    queryOptions({
      queryKey: chaves.relatorios.indicadores(filtros),
      queryFn: () => buscarIndicadores(filtros),
    }),
};

export function useContagemRelatorio(conjunto: ConjuntoRelatorio, filtros: FiltrosRelatorio) {
  return useQuery(opcoesRelatorios.contagem(conjunto, filtros));
}

export function usePaginaRelatorio<C extends ConjuntoRelatorio>(
  conjunto: C,
  filtros: FiltrosRelatorio,
  pagina: number,
  tamanho: number,
) {
  // Mantém a página anterior na tela enquanto a próxima carrega: a tabela não pisca.
  return useQuery({ ...opcoesRelatorios.pagina(conjunto, filtros, pagina, tamanho), placeholderData: keepPreviousData });
}

export function useIndicadoresCoordenacao(filtros: FiltrosIndicadores, habilitado = true) {
  return useQuery({ ...opcoesRelatorios.indicadores(filtros), enabled: habilitado });
}
