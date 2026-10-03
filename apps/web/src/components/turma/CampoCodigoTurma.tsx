import { useId } from "react";
import { Input } from "@/components/Input";
import { AJUDA_CODIGO_TURMA, validarCodigoTurma } from "@/lib/selecao";

// Campo "Código" de Nova/Editar turma: a ajuda mostra a regra inteira do
// check turmas_codigo_formato e o erro aparece enquanto se digita, em vez
// de só depois de enviar (quando o banco recusava com mensagem genérica).
export function CampoCodigoTurma({ valor, aoMudar }: { valor: string; aoMudar: (codigo: string) => void }) {
  const idAjuda = useId();
  const erro = valor ? validarCodigoTurma(valor) : null;
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-label font-medium text-text-secondary">Código</span>
      <Input
        required
        placeholder="Ex.: CDA-2026-1"
        value={valor}
        aria-invalid={erro ? true : undefined}
        aria-describedby={idAjuda}
        className={erro ? "border-danger" : ""}
        onChange={(e) => aoMudar(e.target.value.toUpperCase())}
      />
      <span id={idAjuda} className={`text-label ${erro ? "font-medium text-danger" : "text-text-muted"}`}>
        {erro ?? AJUDA_CODIGO_TURMA}
      </span>
    </label>
  );
}
