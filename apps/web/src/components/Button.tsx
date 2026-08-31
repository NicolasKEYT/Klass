import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

// Dimensões (altura 38px, raio 8px) e cores extraídas dos botões
// "Nova turma" (02-gestor-turmas.svg) e "Lançar notas" (05-professor-diario.svg).
const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white hover:bg-primary/90",
  secondary:
    "bg-surface text-text-primary border border-border hover:bg-neutral-subtle",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex h-[38px] items-center justify-center gap-2 rounded-klass-control px-4 text-klass-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
}
