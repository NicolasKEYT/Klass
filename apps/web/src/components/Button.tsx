import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

// Dimensões (altura 38px, raio 8px) e cores extraídas dos botões
// "Nova turma" (02-gestor-turmas.svg) e "Lançar notas" (05-professor-diario.svg).
// Reforma flat: cor sólida, sem gradiente/relevo; hover ESCURECE
// levemente (brightness, não opacidade — opacidade clareava o azul) e o
// active afunda mais um degrau. Primário ganha uma sombra sutil de
// elevação; secundário fica só com a borda hairline.
const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white shadow-klass-card hover:brightness-95 active:brightness-90",
  secondary:
    "bg-surface text-text-primary border border-border hover:bg-neutral-subtle active:bg-neutral-subtle",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex h-[38px] items-center justify-center gap-2 rounded-klass-control px-4 text-klass-md font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
}
