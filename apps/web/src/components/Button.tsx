import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

// D2 (klass-uikit.pdf, Fundamentos) — alvo de toque: 48px no celular
// (abaixo de sm), 40px no desktop. Raio e cores extraídas dos botões
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
      // A transição é restrita a cor/brilho/sombra de propósito: o
      // `transition` genérico também animava a `opacity`, então cada vez
      // que um botão entrava/saía do estado disabled (num salvar rápido,
      // por exemplo) ele fazia um fade de 50% e voltava — lido como o
      // botão "sumindo e reaparecendo". Sem animar opacidade, o disabled
      // é instantâneo e o clique de reflexo duplicado desaparece.
      className={`inline-flex h-12 sm:h-10 items-center justify-center gap-2 rounded-klass-control px-4 text-klass-md font-medium transition-[color,background-color,border-color,box-shadow,filter] disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
}
