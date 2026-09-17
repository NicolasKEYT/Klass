import type { ReactNode } from "react";

// Escala tipográfica central do app (antes cada tela aplicava classes à
// mão, o que deixava título de card do mesmo tamanho — ou menor — que o
// corpo). Um único componente garante a hierarquia: página > seção >
// item de lista, sempre acima do corpo (text-body-sm, 13px) e dos
// metadados (text-label, 12px). Os tamanhos vêm dos tokens do design
// (klass-xl = título de página, klass-lg = título de card/seção).
type Nivel = "pagina" | "secao" | "item";

type Tag = "h1" | "h2" | "h3" | "h4";

const estilos: Record<Nivel, string> = {
  pagina: "font-serif text-klass-xl text-text-primary",
  secao: "font-serif text-klass-lg text-text-primary",
  item: "text-klass-lg font-semibold text-text-primary",
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
