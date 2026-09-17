import type { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Variante densa (24px), para uso pontual — o padrão do card é 22px. */
  dense?: boolean;
}

// Card de conteúdo: superfície branca com borda hairline + sombra sutil
// (reforma flat/moderna — antes era só borda, o que dava aparência chapada
// e "bordery"). Raio e padding vêm dos tokens do design.
export function Card({ dense = false, className = "", ...props }: CardProps) {
  return (
    <div
      className={`rounded-klass-card border border-border bg-surface shadow-klass-card py-6 ${dense ? "px-klass-card-x-dense" : "px-klass-card-x"} ${className}`}
      {...props}
    />
  );
}
