// Esclarecimento de formato do UI Kit (Prompt 17) — "avatares: círculos
// com iniciais do nome". Sem foto de perfil no domínio (não existe coluna
// pra isso), então todo avatar do sistema é este círculo com iniciais.
function iniciais(nomeCompleto: string): string {
  const partes = nomeCompleto.trim().split(/\s+/);
  const primeira = partes[0]?.[0] ?? "";
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primeira + ultima).toUpperCase();
}

export function Avatar({ nome, className = "" }: { nome: string; className?: string }) {
  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-subtle text-label font-semibold text-text-secondary ${className}`}
      aria-hidden
    >
      {iniciais(nome)}
    </span>
  );
}
