import { useCallback } from "react";
import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";

/**
 * Toda gravação das telas passa por aqui: roda a função de lib/ (que fala
 * com o Supabase) como uma mutation — o indicador de sincronização vê
 * "Salvando…" enquanto houver alguma no ar e "Salvo às HH:MM" ao fim — e
 * depois invalida o que ficou desatualizado (ver invalidar.ts). Erros
 * sobem para o try/catch da tela, como antes.
 */
export function useGravacao() {
  const qc = useQueryClient();
  const { mutateAsync } = useMutation({
    mutationFn: (executar: () => Promise<unknown>) => executar(),
  });
  return useCallback(
    async <T>(
      executar: () => Promise<T>,
      depois?: (qc: QueryClient) => Promise<unknown> | void,
    ): Promise<T> => {
      const resultado = (await mutateAsync(executar)) as T;
      if (depois) await depois(qc);
      return resultado;
    },
    [mutateAsync, qc],
  );
}
