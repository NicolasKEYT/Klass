import type { HTMLAttributes, ReactNode } from "react";

// Esqueleto de carregamento: aparece só na primeira visita a uma tela,
// enquanto ainda não há dado nenhum em cache, e só dentro da área de
// conteúdo (a casca — barra lateral, faixa superior — nunca pisca). Tem o
// formato do que vai aparecer, para a tela não "pular" quando o dado
// chega. Cores dos tokens existentes (surface-subtle), sem tom novo.

/** Bloco cinza pulsante; o tamanho vem da className (ex.: "h-4 w-32"). */
export function Esqueleto({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div aria-hidden className={`animate-pulse rounded-klass-control bg-surface-subtle ${className}`} {...props} />
  );
}

/** Região ocupada por esqueletos: leitores de tela ouvem "Carregando". */
export function RegiaoCarregando({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div role="status" aria-busy="true" aria-label="Carregando" className={className}>
      {children}
    </div>
  );
}

/** Lista de cards (ex.: turmas, trilhas, alunos, aulas). */
export function EsqueletoCards({
  quantidade = 3,
  altura = "h-20",
  className = "",
}: {
  quantidade?: number;
  altura?: string;
  className?: string;
}) {
  return (
    <RegiaoCarregando className={`flex flex-col gap-3 ${className}`}>
      {Array.from({ length: quantidade }).map((_, i) => (
        <div
          key={i}
          aria-hidden
          className={`${altura} animate-pulse rounded-klass-card border border-border bg-surface-subtle`}
        />
      ))}
    </RegiaoCarregando>
  );
}

/** Linhas de texto dentro de um card já desenhado (ex.: "Aulas de hoje"). */
export function EsqueletoLinhas({ quantidade = 3, className = "" }: { quantidade?: number; className?: string }) {
  return (
    <RegiaoCarregando className={`flex flex-col gap-3 ${className}`}>
      {Array.from({ length: quantidade }).map((_, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <Esqueleto className={`h-4 ${i % 2 === 0 ? "w-2/3" : "w-1/2"}`} />
          <Esqueleto className="h-3 w-1/3" />
        </div>
      ))}
    </RegiaoCarregando>
  );
}

/** Tabela (grade de notas, turmas em andamento, certificados). */
export function EsqueletoTabela({ linhas = 4, colunas = 5 }: { linhas?: number; colunas?: number }) {
  return (
    <RegiaoCarregando className="overflow-hidden rounded-klass-card border border-border bg-surface">
      {Array.from({ length: linhas + 1 }).map((_, i) => (
        <div key={i} className="flex h-[52px] items-center gap-4 border-b border-border px-4 last:border-b-0">
          {Array.from({ length: colunas }).map((__, j) => (
            <Esqueleto key={j} className={`h-4 flex-1 ${i === 0 ? "max-w-24" : ""}`} />
          ))}
        </div>
      ))}
    </RegiaoCarregando>
  );
}

/** Página genérica: título + cards. Usado enquanto o código de uma tela sob demanda chega. */
export function EsqueletoPagina() {
  return (
    <RegiaoCarregando className="flex flex-col gap-6">
      <Esqueleto className="h-8 w-56" />
      <EsqueletoCards />
    </RegiaoCarregando>
  );
}
