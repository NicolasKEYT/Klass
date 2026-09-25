import { useEffect, useState } from "react";

// Breakpoint `md` do Tailwind (768px) — mesmo limite que decide se a
// barra lateral (desktop) ou a barra inferior (mobile) aparece. Usado
// onde a decisão precisa acontecer em JS, não só em CSS (ex.: D3 —
// coordenação não recebe navegação nenhuma fora de "Início" no celular).
export function useEhMobile(): boolean {
  const [ehMobile, setEhMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches,
  );

  useEffect(() => {
    const consulta = window.matchMedia("(max-width: 767px)");
    function aoMudar(evento: MediaQueryListEvent) {
      setEhMobile(evento.matches);
    }
    consulta.addEventListener("change", aoMudar);
    return () => consulta.removeEventListener("change", aoMudar);
  }, []);

  return ehMobile;
}
