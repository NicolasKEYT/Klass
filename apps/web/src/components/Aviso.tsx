import type { HTMLAttributes } from "react";

type AvisoVariant = "success" | "danger";

interface AvisoProps extends HTMLAttributes<HTMLDivElement> {
  variant: AvisoVariant;
}

// Banner de feedback pós-ação (salvar, publicar, apagar...). Reaproveita
// as cores de success/danger já no design system — sem introduzir um
// sistema de toast novo, fora do escopo desta etapa.
const variantClasses: Record<AvisoVariant, string> = {
  success: "bg-success-subtle text-success",
  danger: "bg-danger-subtle text-danger",
};

export function Aviso({ variant, className = "", ...props }: AvisoProps) {
  return (
    <div
      role="status"
      className={`rounded-klass-control px-4 py-2.5 text-body-sm font-medium ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
}
