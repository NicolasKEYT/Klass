import { useSyncExternalStore } from "react";

// Horário da última gravação concluída, fora do React para sobreviver a
// qualquer remontagem de tela. Lido pelo indicador de sincronização.
let ultimaGravacao: Date | null = null;
const ouvintes = new Set<() => void>();

export function registrarGravacaoConcluida() {
  ultimaGravacao = new Date();
  ouvintes.forEach((ouvinte) => ouvinte());
}

export function limparUltimaGravacao() {
  ultimaGravacao = null;
  ouvintes.forEach((ouvinte) => ouvinte());
}

export function useUltimaGravacao(): Date | null {
  return useSyncExternalStore(
    (ouvinte) => {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    () => ultimaGravacao,
  );
}
