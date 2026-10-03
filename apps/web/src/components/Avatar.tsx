// Esclarecimento de formato do UI Kit (Prompt 17) — "avatares: círculos
// com iniciais do nome". Sem foto de perfil no domínio (não existe coluna
// pra isso), então todo avatar do sistema é este círculo com iniciais.
function iniciais(nomeCompleto: string): string {
  const partes = nomeCompleto
    .trim()
    .split(/\s+/)
    // "Prof. Rafael Lima" vira "RL", não "PL".
    .filter((p) => !p.endsWith("."));
  const primeira = partes[0]?.[0] ?? "";
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primeira + ultima).toUpperCase();
}

const TAMANHOS = {
  normal: "h-8 w-8 text-label",
  grande: "h-14 w-14 text-klass-lg",
};

export function Avatar({
  nome,
  tamanho = "normal",
  className = "",
}: {
  nome: string;
  tamanho?: keyof typeof TAMANHOS;
  className?: string;
}) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-neutral-subtle font-semibold text-text-secondary ${TAMANHOS[tamanho]} ${className}`}
      aria-hidden
    >
      {iniciais(nome)}
    </span>
  );
}
