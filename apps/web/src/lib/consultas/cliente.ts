import { MutationCache, QueryClient } from "@tanstack/react-query";
import { registrarGravacaoConcluida } from "./estadoGravacao";

// Cache único de leitura do frontend. O frontend continua falando direto
// com o Supabase (as funções de lib/ fazem as chamadas); o cache só evita
// repetir a mesma leitura a cada troca de tela.
// - staleTime 60 s: revisitar uma tela dentro de um minuto não busca nada.
// - gcTime 30 min: dado fora de tela continua disponível para a volta.
// - refetchOnWindowFocus desligado: quem mantém o dado fresco são as
//   invalidações após cada gravação e os eventos do Realtime.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 30 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
  // Toda gravação passa por useGravacao (uma mutation); o fim com sucesso
  // alimenta o "Salvo às HH:MM" do indicador de sincronização (D13).
  mutationCache: new MutationCache({
    onSuccess: () => registrarGravacaoConcluida(),
  }),
});
