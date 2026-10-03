import type { InputHTMLAttributes } from "react";

// Campo de texto: borda, raio e padding horizontal (14px) extraídos dos
// seletores de turma/disciplina em 05-professor-diario.svg e dos campos
// de nota/faltas na mesma tela.
// Fundo branco e borda de controle (border-controle, ≥ 3:1 — WCAG 1.4.11).
// No foco a borda escurece e o anel vem da regra base de :focus-visible
// (index.css), o mesmo de todo elemento interativo.
// D2 — alvo de toque 48px no celular, 40px no desktop (mesmo padrão do Button).
export function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`h-12 sm:h-10 rounded-klass-control border border-controle bg-surface px-3.5 text-body-sm text-text-primary placeholder:text-text-muted transition focus:border-primary ${className}`}
      {...props}
    />
  );
}
