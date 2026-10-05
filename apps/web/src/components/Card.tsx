import type { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Variante densa (24px), para uso pontual — o padrão do card é 22px. */
  dense?: boolean;
  /**
   * Borda de 2px na cor de destaque: o card que é "a" ação da tela
   * ("Seu próximo passo", pág. 4 do UI Kit). Um por tela, no máximo.
   */
  destaque?: boolean;
}

// Card de conteúdo: superfície branca com borda visível, sem sombra de
// elevação. Prompt 17 (correção de fidelidade) — comparado por pixel com
// as 7 telas de alta-fidelidade: o padrão do UI Kit é borda sólida (não
// sombra); a rodada "flat/moderno" anterior ao UI Kit tinha adicionado
// shadow-klass-card aqui, que sai agora. Raio e padding vêm dos tokens.
export function Card({ dense = false, destaque = false, className = "", ...props }: CardProps) {
  return (
    <div
      className={`rounded-klass-card ${destaque ? "border-2 border-text-primary" : "border border-border"} bg-surface py-6 ${dense ? "px-klass-card-x-dense" : "px-klass-card-x"} ${className}`}
      {...props}
    />
  );
}
