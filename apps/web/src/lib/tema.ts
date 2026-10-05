import { useSyncExternalStore } from "react";

// D1 (klass-uikit.pdf, pág. 1) — tema claro como padrão; o escuro é opção
// e segue o prefers-color-scheme do sistema. A preferência fica só neste
// navegador (localStorage): é gosto de aparelho, não dado de domínio, então
// não vai para o banco. Sem nada salvo = "sistema". O primeiro tema é
// aplicado pelo script inline de index.html, antes da primeira pintura;
// este módulo assume dali em diante (troca no Perfil, mudança do sistema,
// outra aba). As duas regras precisam ficar iguais.

export type PreferenciaTema = "sistema" | "claro" | "escuro";

const CHAVE = "klass:tema";

const consultaEscuro =
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;

function lerPreferencia(): PreferenciaTema {
  try {
    const salva = localStorage.getItem(CHAVE);
    return salva === "claro" || salva === "escuro" ? salva : "sistema";
  } catch {
    // Armazenamento bloqueado (modo privado, política do navegador).
    return "sistema";
  }
}

let preferencia: PreferenciaTema = lerPreferencia();
const ouvintes = new Set<() => void>();

function aplicar() {
  const escuro = preferencia === "escuro" || (preferencia === "sistema" && !!consultaEscuro?.matches);
  const raiz = document.documentElement;
  if (escuro === (raiz.dataset.tema === "escuro")) return;
  // Sem isto, botões e itens de menu com `transition` atravessam a troca
  // em câmera lenta, cada um num tempo.
  raiz.classList.add("trocando-tema");
  if (escuro) raiz.dataset.tema = "escuro";
  else delete raiz.dataset.tema;
  requestAnimationFrame(() => requestAnimationFrame(() => raiz.classList.remove("trocando-tema")));
}

function avisar() {
  for (const ouvinte of ouvintes) ouvinte();
}

/** Liga o tema ao sistema e às outras abas. Chamado uma vez, em main.tsx. */
export function iniciarTema() {
  aplicar();
  consultaEscuro?.addEventListener("change", aplicar);
  window.addEventListener("storage", (e) => {
    if (e.key !== CHAVE && e.key !== null) return;
    preferencia = lerPreferencia();
    aplicar();
    avisar();
  });
}

export function definirPreferenciaTema(nova: PreferenciaTema) {
  preferencia = nova;
  try {
    if (nova === "sistema") localStorage.removeItem(CHAVE);
    else localStorage.setItem(CHAVE, nova);
  } catch {
    // Sem armazenamento a escolha vale só até recarregar a página.
  }
  aplicar();
  avisar();
}

export function usePreferenciaTema(): PreferenciaTema {
  return useSyncExternalStore(
    (ouvinte) => {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    () => preferencia,
  );
}
