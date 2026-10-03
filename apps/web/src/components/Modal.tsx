import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

// Modal simples: overlay + card central. Fecha no Esc, no clique fora e
// no X. Sem biblioteca — o projeto não usa nenhuma de dialog e o caso de
// uso (aviso de pré-requisito) é pequeno.
interface ModalProps {
  aberto: boolean;
  titulo: string;
  onFechar: () => void;
  children: ReactNode;
  /** Rodapé opcional (botões de ação). */
  rodape?: ReactNode;
}

export function Modal({ aberto, titulo, onFechar, children, rodape }: ModalProps) {
  useEffect(() => {
    if (!aberto) return;
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") onFechar();
    }
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [aberto, onFechar]);

  if (!aberto) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-text-primary/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      onClick={onFechar}
    >
      <div
        className="w-full max-w-md rounded-klass-card border border-border bg-surface shadow-klass-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-klass-lg font-semibold text-text-primary">{titulo}</h2>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="text-text-muted hover:text-text-primary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {rodape && (
          <div className="flex justify-end gap-2 border-t border-border px-5 py-3">{rodape}</div>
        )}
      </div>
    </div>
  );
}
