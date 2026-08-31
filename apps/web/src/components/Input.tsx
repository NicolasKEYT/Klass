import type { InputHTMLAttributes } from "react";

// Campo de texto: borda, raio e padding horizontal (14px) extraídos dos
// seletores de turma/disciplina em 05-professor-diario.svg e dos campos
// de nota/faltas na mesma tela.
export function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`h-9 rounded-klass-control border border-border bg-surface px-3.5 text-body-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/40 ${className}`}
      {...props}
    />
  );
}
