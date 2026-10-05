import type { HTMLAttributes } from "react";

// Os nomes dizem a forma, não o significado: "success"/"danger" enganavam
// (não há verde nem vermelho no sistema).
export type BadgeVariant = "preenchido" | "contorno" | "tracejado" | "alerta";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  /**
   * Exceção à regra de não quebrar: badge com texto variável e longo
   * ("Pendente: Programação para Dados, Cálculo Aplicado") dentro de
   * célula de tabela pode quebrar, senão empurra as colunas para fora.
   */
  quebraLinha?: boolean;
}

// Vocabulário monocromático do UI Kit (klass-uikit.pdf, Fundamentos pág. 2,
// Boletim pág. 5, Notas pág. 9): preenchido preto só para o estado mais
// digno de nota de cada contexto (Concluído, Chamada pendente); contorno
// para os demais estados, situações de turma e tags (nível, carga
// horária, trilha); tracejado para o que está em espera (Em análise,
// Bloqueado); alerta é contorno com a borda de controle, mais escura,
// como "Abaixo da média" na grade de notas. Cor nunca carrega o
// significado sozinha — ícone + texto sempre acompanham (ver StatusBadge).
const variantClasses: Record<BadgeVariant, string> = {
  preenchido: "bg-primary text-primary-contraste",
  contorno: "border border-border bg-surface text-text-primary",
  tracejado: "border border-dashed border-border bg-surface text-text-secondary",
  alerta: "border border-controle bg-surface text-text-primary",
};

export function Badge({
  variant = "contorno",
  quebraLinha = false,
  className = "",
  children,
  ...props
}: BadgeProps) {
  return (
    // whitespace-nowrap + shrink-0: badge nunca quebra em duas linhas nem
    // espreme o título ao lado. Se faltar espaço, quem o contém usa
    // flex-wrap e o badge desce inteiro para baixo do título.
    <span
      className={`inline-flex items-center gap-1.5 rounded-klass-pill px-3 py-1 text-label font-medium ${quebraLinha ? "" : "shrink-0 whitespace-nowrap"} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
