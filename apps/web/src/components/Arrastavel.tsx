import type { ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

// Linha arrastável para listas ordenáveis (dnd-kit). A alça de arraste
// (grip) fica à esquerda; o conteúdo é passado como children. Os botões
// subir/descer continuam nos filhos como alternativa acessível — a alça
// é só um atalho para quem consegue arrastar.
export function Arrastavel({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    // Fica por cima e opaco enquanto arrasta, para o item não sumir sob os vizinhos.
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.85 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-start gap-2">
      <button
        type="button"
        aria-label="Arrastar para reordenar"
        className="mt-1 cursor-grab touch-none rounded-klass-control p-1 text-text-muted hover:bg-neutral-subtle active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5" aria-hidden />
      </button>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
