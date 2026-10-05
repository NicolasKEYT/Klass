import { CalendarClock, Lock, LockOpen } from "lucide-react";
import { Badge } from "@/components/Badge";
import { formatarData } from "@/lib/formato";
import type { AulaComPrazo } from "@klass/types";

// Situação do prazo da chamada (decidida pelo banco): o professor faz ou
// altera a chamada até 7 dias depois da aula; depois, só com liberação da
// coordenação; aula futura nunca. Ícone + texto: a cor não carrega o
// significado sozinha (UI Kit).
export function SituacaoDaChamada({ aula }: { aula: Pick<AulaComPrazo, "situacao_chamada" | "chamada_aberta_ate"> }) {
  switch (aula.situacao_chamada) {
    case "futura":
      return (
        <Badge variant="tracejado">
          <CalendarClock className="h-3.5 w-3.5" aria-hidden />
          Aula futura
        </Badge>
      );
    case "aberta":
      return (
        <Badge variant="contorno">
          <LockOpen className="h-3.5 w-3.5" aria-hidden />
          Chamada até {formatarData(aula.chamada_aberta_ate)}
        </Badge>
      );
    case "liberada":
      return (
        <Badge variant="contorno">
          <LockOpen className="h-3.5 w-3.5" aria-hidden />
          Liberada até {formatarData(aula.chamada_aberta_ate)}
        </Badge>
      );
    default:
      return (
        <Badge variant="alerta">
          <Lock className="h-3.5 w-3.5" aria-hidden />
          Prazo encerrado
        </Badge>
      );
  }
}

/** O professor ainda pode fazer ou alterar a chamada desta aula? */
export function professorPodeFazerChamada(aula: Pick<AulaComPrazo, "situacao_chamada">): boolean {
  return aula.situacao_chamada === "aberta" || aula.situacao_chamada === "liberada";
}
