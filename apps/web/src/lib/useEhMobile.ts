import { useEffect, useState } from "react";

// Breakpoint `md` do Tailwind (768px) — mesmo limite que decide se a
// barra lateral (desktop) ou a barra inferior (mobile) aparece. Testa o
// complemento exato de `md` (not min-width: 768px), não max-width: 767px:
// com zoom ou densidade de pixel fracionária a largura pode ser 767,5px,
// que não casava com nenhum dos dois — sem barra lateral e sem o aviso. Usado
// onde a decisão precisa acontecer em JS, não só em CSS (ex.: D3 —
// coordenação não recebe navegação nenhuma fora de "Início" no celular).
const CONSULTA_MOBILE = "not all and (min-width: 768px)";

export function useEhMobile(): boolean {
  const [ehMobile, setEhMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia(CONSULTA_MOBILE).matches,
  );

  useEffect(() => {
    const consulta = window.matchMedia(CONSULTA_MOBILE);
    function aoMudar(evento: MediaQueryListEvent) {
      setEhMobile(evento.matches);
    }
    consulta.addEventListener("change", aoMudar);
    return () => consulta.removeEventListener("change", aoMudar);
  }, []);

  return ehMobile;
}
