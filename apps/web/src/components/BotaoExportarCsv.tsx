import { Download } from "lucide-react";
import { Button } from "@/components/Button";
import { baixarCsv, nomeDoArquivoCsv, type ColunaCsv } from "@/lib/csv";

interface BotaoExportarCsvProps<T> {
  /** Partes do nome do arquivo (tela, turma…); a data é acrescentada. */
  nome: string[];
  colunas: ColunaCsv<T>[];
  linhas: T[];
  /** Descreve a tabela para leitor de tela ("Exportar notas da turma X em CSV"). */
  rotulo: string;
  className?: string;
}

// D12 — exportação de tabela. Desabilitado sem linhas: um arquivo só com
// cabeçalho não ajuda ninguém.
export function BotaoExportarCsv<T>({ nome, colunas, linhas, rotulo, className = "" }: BotaoExportarCsvProps<T>) {
  return (
    <Button
      type="button"
      variant="secondary"
      className={className}
      aria-label={rotulo}
      title={linhas.length === 0 ? "Nada para exportar" : rotulo}
      disabled={linhas.length === 0}
      onClick={() => baixarCsv(nomeDoArquivoCsv(nome), colunas, linhas)}
    >
      <Download className="h-4 w-4" aria-hidden />
      Exportar CSV
    </Button>
  );
}
