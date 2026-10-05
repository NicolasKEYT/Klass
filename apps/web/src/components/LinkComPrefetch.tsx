import { forwardRef } from "react";
import { createPath, Link, type LinkProps } from "react-router-dom";
import { usePrefetch } from "@/lib/consultas/prefetch";

// Link que começa a buscar os dados do destino na intenção de clique
// (mouse em cima, foco do teclado, toque) — quando o clique chega, a tela
// abre com o cache já preenchido ou a caminho.
export const LinkComPrefetch = forwardRef<HTMLAnchorElement, LinkProps>(function LinkComPrefetch(
  { onMouseEnter, onFocus, onTouchStart, ...props },
  ref,
) {
  const prefetch = usePrefetch();
  const destino = typeof props.to === "string" ? props.to : createPath(props.to);
  return (
    <Link
      ref={ref}
      {...props}
      onMouseEnter={(e) => {
        onMouseEnter?.(e);
        prefetch(destino);
      }}
      onFocus={(e) => {
        onFocus?.(e);
        prefetch(destino);
      }}
      onTouchStart={(e) => {
        onTouchStart?.(e);
        prefetch(destino);
      }}
    />
  );
});
