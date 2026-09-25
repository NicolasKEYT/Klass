import { Award, Check, Clock, Minus, TriangleAlert, X } from "lucide-react";
import { Badge } from "@/components/Badge";
import type { StatusMatricula } from "@klass/types";

// D8 (klass-uikit.pdf, Fundamentos) — "todo status no sistema passa a ter
// ícone + texto + cor (nunca só cor, por acessibilidade)". Este componente
// centraliza o vocabulário completo (matrícula, aula, avaliação) para não
// repetir mapa de label/cor em cada tela — antes cada página tinha seu
// próprio STATUS_LABEL/STATUS_VARIANTE quase-idênticos.
type StatusAulaAvaliacao = "chamada_feita" | "chamada_pendente" | "abaixo_da_media";

const MATRICULA: Record<
  StatusMatricula,
  { texto: string; variante: "success" | "neutral" | "danger" | "warning"; Icone: typeof Check }
> = {
  inscrita: { texto: "Em análise", variante: "neutral", Icone: Clock },
  matriculada: { texto: "Matriculado(a)", variante: "success", Icone: Check },
  concluida: { texto: "Concluído", variante: "success", Icone: Award },
  reprovada: { texto: "Reprovado(a)", variante: "danger", Icone: X },
  rejeitada: { texto: "Rejeitada", variante: "danger", Icone: X },
  cancelada: { texto: "Cancelada", variante: "neutral", Icone: Minus },
};

const AULA_AVALIACAO: Record<
  StatusAulaAvaliacao,
  { texto: string; variante: "success" | "neutral" | "danger" | "warning"; Icone: typeof Check }
> = {
  chamada_feita: { texto: "Chamada feita", variante: "success", Icone: Check },
  chamada_pendente: { texto: "Chamada pendente", variante: "warning", Icone: TriangleAlert },
  abaixo_da_media: { texto: "Abaixo da média", variante: "warning", Icone: TriangleAlert },
};

interface StatusBadgeMatriculaProps {
  tipo: "matricula";
  status: StatusMatricula;
  className?: string;
}
interface StatusBadgeDiarioProps {
  tipo: "aula" | "avaliacao";
  status: StatusAulaAvaliacao;
  className?: string;
}

export function StatusBadge(props: StatusBadgeMatriculaProps | StatusBadgeDiarioProps) {
  const { texto, variante, Icone } =
    props.tipo === "matricula" ? MATRICULA[props.status] : AULA_AVALIACAO[props.status];
  return (
    <Badge variant={variante} className={props.className}>
      <Icone className="h-3.5 w-3.5" aria-hidden />
      {texto}
    </Badge>
  );
}
