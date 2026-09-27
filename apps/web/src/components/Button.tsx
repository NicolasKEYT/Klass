import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "tracejado";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

// D2 (klass-uikit.pdf, Fundamentos) — alvo de toque: 48px no celular
// (abaixo de sm), 40px no desktop.
// Prompt 17 (correção de fidelidade) — o UI Kit de alta-fidelidade não usa
// sombra de elevação em botão nenhum (comparado por pixel com "Ver
// boletim", "Fazer chamada", "Salvar chamada" — todos preenchimento preto
// chapado, sem sombra). Primário = preto sólido, texto branco; hover
// escurece (brightness) em vez de opacidade, pra não "sumir e voltar".
// Secundário = contorno. "Tracejado" é o terceiro estado visto em
// "Inscrever-se" bloqueado por pré-requisito — mesma forma de botão, só
// com borda tracejada e tom apagado, sem fingir que a ação está disponível.
const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white hover:brightness-95 active:brightness-90",
  secondary:
    "bg-surface text-text-primary border border-border hover:bg-neutral-subtle active:bg-neutral-subtle",
  tracejado: "border border-dashed border-border bg-neutral-subtle text-text-muted",
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
