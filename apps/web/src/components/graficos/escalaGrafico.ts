/** Topo "redondo" do eixo (1, 2, 5 × 10ⁿ) para o maior valor da série. */
export function topoDoEixo(maior: number): number {
  if (maior <= 1) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(maior)));
  const f = maior / exp;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * exp;
}

/** "2026-03" → "03/26": curto para caber no eixo. */
export function rotuloDoMes(mes: string): string {
  const [ano, m] = mes.split("-");
  return `${m}/${ano.slice(2)}`;
}

/** Todos os meses entre o primeiro e o último, com zero onde nada aconteceu. */
export function completarMeses<T extends { mes: string; total: number }>(serie: T[]): { mes: string; total: number }[] {
  if (serie.length === 0) return [];
  const porMes = new Map(serie.map((s) => [s.mes, s.total]));
  const meses = [...porMes.keys()].sort();
  const [a0, m0] = meses[0].split("-").map(Number);
  const [a1, m1] = meses[meses.length - 1].split("-").map(Number);
  const saida: { mes: string; total: number }[] = [];
  for (let a = a0, m = m0; a < a1 || (a === a1 && m <= m1); m === 12 ? ((a += 1), (m = 1)) : (m += 1)) {
    const chave = `${a}-${String(m).padStart(2, "0")}`;
    saida.push({ mes: chave, total: porMes.get(chave) ?? 0 });
  }
  return saida;
}
