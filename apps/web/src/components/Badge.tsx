import type { HTMLAttributes } from "react";

type BadgeVariant = "success" | "neutral" | "live" | "danger" | "tracejado";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

// Prompt 17 (klass-uikit.pdf, correção de fidelidade) — o vocabulário de
// badges do UI Kit de alta-fidelidade é monocromático: preenchimento
// preto sólido para o estado mais "digno de nota" de cada contexto
// (Concluído, Chamada pendente, Sem conexão), contorno cinza para os
// demais (Matriculado, Reprovado, Cursando...), e borda tracejada para
// estados incertos/em espera (Em análise, Salvando..., Bloqueado). Cor
// nunca carrega o significado sozinha — ícone + texto sempre acompanham
// (ver StatusBadge). Os nomes de variante ficam os mesmos de antes da
// correção (menos código pra tocar), só o mapeamento de classe mudou.
const variantClasses: Record<BadgeVariant, string> = {
  success: "rounded-klass-pill bg-primary text-white", // preenchido preto — estado positivo/definitivo
  neutral: "rounded-klass-pill bg-neutral-subtle text-text-secondary", // tag informativa (nível, carga horária...)
  live: "rounded-klass-pill border border-border bg-surface text-text-secondary", // contorno + ponto (sincronização)
  danger: "rounded-klass-pill border border-border bg-surface text-text-primary", // contorno — negativo/recusado
  tracejado: "rounded-klass-pill border border-dashed border-border bg-surface text-text-secondary", // incerto/em espera
};

export function Badge({
  variant = "neutral",
  className = "",
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 text-label font-medium ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {variant === "live" && (
        <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />
      )}
      {children}
    </span>
  );
}
