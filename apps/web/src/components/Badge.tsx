import type { HTMLAttributes } from "react";

type BadgeVariant = "success" | "neutral" | "live";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

// "success"/"neutral": badge de status em tabela (ex.: "Aberta"/"Fechada"
// em 01-gestor-visao-geral.svg, "Aprovado" em 04-aluno-boletim.svg e
// 05-professor-diario.svg).
// "live": indicador de tempo real ("tempo real"/"sincronizando"),
// pill com ponto colorido — mesmo padrão nas 5 telas de app.
const variantClasses: Record<BadgeVariant, string> = {
  success: "rounded-klass-badge bg-success-subtle text-success",
  neutral: "rounded-klass-badge bg-neutral-subtle text-text-secondary",
  live: "rounded-klass-pill border border-border bg-surface text-text-secondary",
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
        <span className="h-2 w-2 rounded-full bg-success" aria-hidden />
      )}
      {children}
    </span>
  );
}
