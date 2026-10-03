import type { ReactNode } from "react";

// Escala tipográfica central do app — D2 (klass-uikit.pdf, Fundamentos):
// título de página 32px, título de seção 24px, título de card 20px,
// sempre acima do corpo (text-body-sm, 16px) e dos metadados (text-label,
// 14px, mínimo absoluto do sistema).
//
// Títulos em sans-serif (IBM Plex Sans semibold, o peso vem do token),
// como no UI Kit. O serif fica só no certificado em PDF.
type Nivel = "pagina" | "secao" | "item";

type Tag = "h1" | "h2" | "h3" | "h4";

const estilos: Record<Nivel, string> = {
  pagina: "text-klass-xl text-text-primary", // 32px
  secao: "text-klass-2xl text-text-primary", // 24px
  item: "text-klass-lg font-semibold text-text-primary", // 20px
};

const tagPadrao: Record<Nivel, Tag> = {
  pagina: "h1",
  secao: "h2",
  item: "h3",
};

interface TituloProps {
  children: ReactNode;
  /** pagina (h1, maior), secao (h2) ou item de lista (h3). Default: pagina. */
  nivel?: Nivel;
  /** Sobrescreve a tag HTML sem mudar o estilo (para semântica/aninhamento). */
  as?: Tag;
  className?: string;
}

export function Titulo({ children, nivel = "pagina", as, className = "" }: TituloProps) {
  const Tag = as ?? tagPadrao[nivel];
  return <Tag className={`${estilos[nivel]} ${className}`}>{children}</Tag>;
}
