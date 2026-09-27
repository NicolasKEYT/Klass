import { Award, Check, Clock, Minus, TriangleAlert, X } from "lucide-react";
import { Badge } from "@/components/Badge";
import type { StatusMatricula } from "@klass/types";

// D8 (klass-uikit.pdf, Fundamentos) — "todo status no sistema passa a ter
// ícone + texto + cor (nunca só cor, por acessibilidade)". Prompt 17
// corrigiu o mapeamento de cor por pixel-comparação direta com a página
// de Fundamentos: NÃO é um vocabulário verde/vermelho/âmbar — é
// monocromático (preto sólido / contorno / tracejado), com o ícone
// carregando o significado específico.
type StatusAulaAvaliacao = "chamada_feita" | "chamada_pendente" | "abaixo_da_media";

const MATRICULA: Record<
  StatusMatricula,
  { texto: string; variante: "success" | "neutral" | "danger" | "tracejado"; Icone: typeof Check }
> = {
  // "Em análise" é o único status de matrícula com borda tracejada no
  // Fundamentos (estado ainda incerto/em espera) — os demais são contorno
  // sólido, exceto "Concluído", que é o único preenchido a preto.
  inscrita: { texto: "Em análise", variante: "tracejado", Icone: Clock },
  matriculada: { texto: "Matriculado(a)", variante: "neutral", Icone: Check },
  concluida: { texto: "Concluído", variante: "success", Icone: Award },
  reprovada: { texto: "Reprovado(a)", variante: "danger", Icone: X },
  rejeitada: { texto: "Rejeitada", variante: "danger", Icone: X },
  cancelada: { texto: "Cancelada", variante: "neutral", Icone: Minus },
};

const AULA_AVALIACAO: Record<
  StatusAulaAvaliacao,
  { texto: string; variante: "success" | "neutral" | "danger" | "tracejado"; Icone: typeof Check }
> = {
  chamada_feita: { texto: "Chamada feita", variante: "neutral", Icone: Check },
  // "Chamada pendente" é preenchida a preto no Fundamentos e na tela
  // Hoje (é a ação mais urgente do dia) — "Abaixo da média" é contorno
  // (é uma coluna de status numa grade, não uma chamada à ação).
  chamada_pendente: { texto: "Chamada pendente", variante: "success", Icone: TriangleAlert },
  abaixo_da_media: { texto: "Abaixo da média", variante: "danger", Icone: TriangleAlert },
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
