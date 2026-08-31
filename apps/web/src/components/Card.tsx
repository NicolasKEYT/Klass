import type { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Variante densa (24px), para uso pontual — o padrão do card é 22px. */
  dense?: boolean;
}

// Card de conteúdo: fundo branco, borda e raio recorrentes em todas as
// telas de app (01, 02, 04, 05). Padding horizontal 22px por padrão.
export function Card({ dense = false, className = "", ...props }: CardProps) {
  return (
    <div
      className={`rounded-klass-card border border-border bg-surface py-6 ${dense ? "px-klass-card-x-dense" : "px-klass-card-x"} ${className}`}
      {...props}
    />
  );
}
