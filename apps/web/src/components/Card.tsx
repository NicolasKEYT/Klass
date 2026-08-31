import type { HTMLAttributes } from "react";

// Card de conteúdo: fundo branco, borda e raio recorrentes em todas as
// telas de app (01, 02, 04, 05). Padding horizontal (22px) extraído do
// mesmo grupo de telas.
export function Card({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-klass-card border border-border bg-surface px-klass-card-x py-6 ${className}`}
      {...props}
    />
  );
}
