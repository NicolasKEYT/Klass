import { Award, Check, Clock, Minus, TriangleAlert, X } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/Badge";
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
  { texto: string; variante: BadgeVariant; Icone: typeof Check }
> = {
  // "Em análise" é o único status de matrícula tracejado (estado ainda em
  // espera); "Concluído" o único preenchido a preto; os demais são
  // contorno, com o ícone dizendo o sentido (✓, ×, −).
  // `matriculada` aparece como "Cursando" em todo o sistema: é o rótulo do
  // Boletim e do checklist do UI Kit, e diz o que o aluno está fazendo.
  inscrita: { texto: "Em análise", variante: "tracejado", Icone: Clock },
  matriculada: { texto: "Cursando", variante: "contorno", Icone: Check },
  concluida: { texto: "Concluído", variante: "preenchido", Icone: Award },
  reprovada: { texto: "Reprovado(a)", variante: "contorno", Icone: X },
  rejeitada: { texto: "Rejeitada", variante: "contorno", Icone: X },
  cancelada: { texto: "Cancelada", variante: "contorno", Icone: Minus },
};

/** O texto do selo de matrícula, para onde não cabe o selo (CSV, tabela). */
export function textoDoStatusMatricula(status: StatusMatricula): string {
  return MATRICULA[status].texto;
}

const AULA_AVALIACAO: Record<
  StatusAulaAvaliacao,
  { texto: string; variante: BadgeVariant; Icone: typeof Check }
> = {
  chamada_feita: { texto: "Chamada feita", variante: "contorno", Icone: Check },
  // "Chamada pendente" é preenchida a preto no Fundamentos e na tela
  // Hoje (é a ação mais urgente do dia) — "Abaixo da média" é alerta:
  // contorno com ícone (é uma coluna de status numa grade, não uma
  // chamada à ação), nunca vermelho/amarelo.
  chamada_pendente: { texto: "Chamada pendente", variante: "preenchido", Icone: TriangleAlert },
  abaixo_da_media: { texto: "Abaixo da média", variante: "alerta", Icone: TriangleAlert },
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
