import { BotaoExportarCsv } from "@/components/BotaoExportarCsv";
import type { ColunaCsv } from "@/lib/csv";

interface TabelaDoGraficoProps<T> {
  titulo: string;
  linhas: T[];
  colunas: ColunaCsv<T>[];
  nomeCsv: string[];
  chave: (linha: T) => string;
}

// Alternativa acessível de todo gráfico (D11): os mesmos números em tabela,
// recolhida, com o CSV logo abaixo. O GraficoBarras traz a sua própria
// versão desta tabela; os demais gráficos usam esta.
export function TabelaDoGrafico<T>({ titulo, linhas, colunas, nomeCsv, chave }: TabelaDoGraficoProps<T>) {
  return (
    <details className="mt-3 border-t border-border pt-3">
      <summary className="w-fit cursor-pointer rounded-sm text-body-sm font-medium text-text-primary hover:underline">
        Ver como tabela
      </summary>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left">
          <caption className="sr-only">{titulo}</caption>
          <thead>
            <tr className="border-b border-border text-label text-text-secondary">
              {colunas.map((c) => (
                <th key={c.titulo} scope="col" className="px-2 py-2 font-medium first:pl-0">
                  {c.titulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha) => (
              <tr key={chave(linha)} className="border-b border-border last:border-b-0">
                {colunas.map((c, j) => {
                  const v = c.valor(linha);
                  return j === 0 ? (
                    <th key={c.titulo} scope="row" className="whitespace-nowrap px-2 py-2 text-body-sm font-normal text-text-primary first:pl-0">
                      {v ?? "—"}
                    </th>
                  ) : (
                    <td key={c.titulo} className="px-2 py-2 font-mono text-body-sm tabular-nums text-text-primary">
                      {typeof v === "number" ? v.toLocaleString("pt-BR") : (v ?? "—")}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <BotaoExportarCsv
        className="mt-3"
        nome={nomeCsv}
        rotulo={`Exportar "${titulo}" em CSV`}
        linhas={linhas}
        colunas={colunas}
      />
    </details>
  );
}
