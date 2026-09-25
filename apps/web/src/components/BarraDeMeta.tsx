// D11 (klass-uikit.pdf, decisão de desenho) — "indicadores com barra
// contra a meta (bullet chart), sem velocímetro nem pizza: comprimento e
// posição são lidos com mais precisão que ângulo ou área". Um componente
// único reaproveitado em toda parte que mostra "valor atual vs. mínimo/
// meta" — frequência do aluno, e os três indicadores do painel da
// coordenação (frequência média, aprovação, evasão).
interface BarraDeMetaProps {
  /** Valor atual, na mesma escala de `max` (default 0–100, ex.: percentual). */
  valor: number;
  /** Posição da marca de meta/mínimo, mesma escala de `valor`. */
  meta: number;
  /** Escala máxima do eixo — default 100 (percentuais). */
  max?: number;
  /** Rótulo acessível descrevendo o que a barra representa. */
  rotulo: string;
  className?: string;
}

export function BarraDeMeta({ valor, meta, max = 100, rotulo, className = "" }: BarraDeMetaProps) {
  const percentualValor = Math.max(0, Math.min(100, (valor / max) * 100));
  const percentualMeta = Math.max(0, Math.min(100, (meta / max) * 100));

  return (
    <div
      className={`relative h-2 w-full rounded-full bg-neutral-subtle ${className}`}
      role="img"
      aria-label={`${rotulo}: ${valor} de ${max}, meta ${meta}`}
    >
      <div
        className="h-2 rounded-full bg-text-primary transition-[width]"
        style={{ width: `${percentualValor}%` }}
      />
      {/* Marca vertical da meta/mínimo — cruza a barra, sempre visível
          mesmo quando o valor atual já passou dela. */}
      <div
        className="absolute -top-1 h-4 w-0.5 rounded-full bg-warning"
        style={{ left: `${percentualMeta}%` }}
        aria-hidden
      />
    </div>
  );
}
