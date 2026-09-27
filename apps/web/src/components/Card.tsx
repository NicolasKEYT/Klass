import type { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Variante densa (24px), para uso pontual — o padrão do card é 22px. */
  dense?: boolean;
}

// Card de conteúdo: superfície branca com borda visível, sem sombra de
// elevação. Prompt 17 (correção de fidelidade) — comparado por pixel com
// as 7 telas de alta-fidelidade: o padrão do UI Kit é borda sólida (não
// sombra); a rodada "flat/moderno" anterior ao UI Kit tinha adicionado
// shadow-klass-card aqui, que sai agora. Raio e padding vêm dos tokens.
export function Card({ dense = false, className = "", ...props }: CardProps) {
  return (
    <div
      className={`rounded-klass-card border border-border bg-surface py-6 ${dense ? "px-klass-card-x-dense" : "px-klass-card-x"} ${className}`}
      {...props}
    />
  );
}
