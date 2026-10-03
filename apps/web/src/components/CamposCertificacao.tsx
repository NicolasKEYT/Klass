import type { ReactNode } from "react";
import { Input } from "@/components/Input";
import type { TipoCertificacao } from "@klass/types";

// Bloco compartilhado por NovaTrilha e EditarTrilha: tipo de certificação
// + média mínima de aprovação. Centralizado para as duas telas não
// divergirem no texto de ajuda nem nas opções.
export function CamposCertificacao({
  tipoCertificacao,
  onTipoChange,
  mediaMinima,
  onMediaChange,
  aviso,
}: {
  tipoCertificacao: TipoCertificacao;
  onTipoChange: (valor: TipoCertificacao) => void;
  // string (não number) para o campo aceitar digitação decimal com
  // conforto; a página converte com Number() ao salvar.
  mediaMinima: string;
  onMediaChange: (valor: string) => void;
  // Slot opcional (usado na edição para avisar sobre certificados já emitidos).
  aviso?: ReactNode;
}) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <span className="text-label font-medium text-text-secondary">Tipo de certificação</span>
        <select
          className="h-12 sm:h-10 rounded-klass-control border border-controle bg-surface px-3.5 text-body-sm text-text-primary transition focus:border-primary"
          value={tipoCertificacao}
          onChange={(e) => onTipoChange(e.target.value as TipoCertificacao)}
        >
          <option value="trilha">Só ao concluir a trilha inteira</option>
          <option value="modulo">Por módulo concluído</option>
        </select>
        <span className="text-label text-text-muted">
          "Por módulo concluído": cada módulo que o aluno termina já gera um certificado próprio.
          "Só ao concluir a trilha inteira": um único certificado, emitido quando o aluno conclui
          todos os módulos.
        </span>
        {aviso}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-label font-medium text-text-secondary">Média mínima de aprovação</span>
        <Input
          type="number"
          min={0}
          max={10}
          step={0.1}
          required
          value={mediaMinima}
          onChange={(e) => onMediaChange(e.target.value)}
        />
        <span className="text-label text-text-muted">
          Nota de 0 a 10 que o aluno precisa atingir para ser aprovado nos módulos desta trilha
          (padrão 6,0).
        </span>
      </label>
    </>
  );
}
