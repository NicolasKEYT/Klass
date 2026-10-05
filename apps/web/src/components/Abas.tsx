import type { ReactNode } from "react";

export interface Aba<T extends string> {
  valor: T;
  rotulo: string;
  /** Contador ao lado do rótulo: "Alunos (8)" ou o círculo de "Inscrições 5". */
  contador?: number;
  /** "circulo" mostra o contador num círculo com contorno (pág. 11). */
  formaContador?: "parenteses" | "circulo";
}

// Abas do cabeçalho de página (pág. 9 e 11 do UI Kit): texto, a ativa em
// preto e semibold com sublinhado de 2px. O estado mora na URL (?aba=)
// de quem usa — este componente só desenha e avisa a troca.
export function Abas<T extends string>({
  abas,
  ativa,
  aoTrocar,
  rotulo,
}: {
  abas: Aba<T>[];
  ativa: T;
  aoTrocar: (valor: T) => void;
  rotulo: string;
}) {
  return (
    <div role="tablist" aria-label={rotulo} className="-mb-px flex gap-1 overflow-x-auto">
      {abas.map((aba) => {
        const selecionada = aba.valor === ativa;
        let contador: ReactNode = null;
        if (aba.contador !== undefined) {
          contador =
            aba.formaContador === "circulo" ? (
              <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-border px-1.5 font-mono text-label tabular-nums">
                {aba.contador}
              </span>
            ) : (
              ` (${aba.contador})`
            );
        }
        return (
          <button
            key={aba.valor}
            type="button"
            role="tab"
            aria-selected={selecionada}
            onClick={() => aoTrocar(aba.valor)}
            className={`flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-body-sm ${
              selecionada
                ? "border-primary font-semibold text-text-primary"
                : "border-transparent font-medium text-text-secondary hover:text-text-primary"
            }`}
          >
            {aba.rotulo}
            {contador}
          </button>
        );
      })}
    </div>
  );
}
