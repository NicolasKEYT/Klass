import { Link } from "react-router-dom";
import { caminhoDeVerificacao } from "@/lib/certificacao";

// "Verificar": abre a página pública do certificado — a mesma que o QR do
// PDF abre — em outra aba, para a pessoa conferir o que um terceiro verá
// sem sair da lista.
export function LinkVerificar({ hash, className = "" }: { hash: string; className?: string }) {
  return (
    <Link
      to={caminhoDeVerificacao(hash)}
      target="_blank"
      rel="noopener"
      className={`text-body-sm font-medium text-primary hover:underline ${className}`}
    >
      Verificar
      <span className="sr-only"> o código {hash} (abre em nova aba)</span>
    </Link>
  );
}
