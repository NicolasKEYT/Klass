import type { InputHTMLAttributes } from "react";

// Campo de texto: borda, raio e padding horizontal (14px) extraídos dos
// seletores de turma/disciplina em 05-professor-diario.svg e dos campos
// de nota/faltas na mesma tela.
// Reforma flat: fundo branco, borda hairline e um foco intencional com a
// cor do projeto (borda primary sólida + anel primary/20), no lugar do
// azul padrão do navegador. Como é o Input atômico, propaga a todos os
// formulários.
// D2 — alvo de toque 48px no celular, 40px no desktop (mesmo padrão do Button).
export function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`h-12 sm:h-10 rounded-klass-control border border-border bg-surface px-3.5 text-body-sm text-text-primary placeholder:text-text-muted transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 ${className}`}
      {...props}
    />
  );
}
