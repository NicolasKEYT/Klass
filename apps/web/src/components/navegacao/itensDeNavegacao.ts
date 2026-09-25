import {
  Award,
  BookOpen,
  Calendar,
  FileText,
  Home,
  Layers,
  Search,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Papel } from "@klass/types";

// D3 (klass-uikit.pdf) — "cada papel vê só o que usa, no máximo 5 itens".
// Fonte única para barra lateral (desktop) e barra inferior (mobile), que
// usam subconjuntos desta mesma lista — evita duas listas divergirem.
export interface ItemNav {
  para: string;
  texto: string;
  Icone: LucideIcon;
  /** D3 — "Pessoas": reservado no desenho, ainda sem tela no código. */
  aindaNaoExiste?: boolean;
}

const ALUNO: ItemNav[] = [
  { para: "/", texto: "Início", Icone: Home },
  { para: "/catalogo", texto: "Catálogo", Icone: Search },
  // D3/D8 — "Minhas matrículas" renomeado para "Boletim": é como o aluno
  // de fato procura essa informação, segundo a pesquisa de UX do kit.
  { para: "/aluno/boletim", texto: "Boletim", Icone: FileText },
  { para: "/aluno/certificados", texto: "Certificados", Icone: Award },
];

const PROFESSOR: ItemNav[] = [
  { para: "/", texto: "Hoje", Icone: Calendar },
  { para: "/professor/turmas", texto: "Minhas turmas", Icone: Layers },
  { para: "/catalogo", texto: "Catálogo", Icone: Search },
];

const COORDENACAO: ItemNav[] = [
  { para: "/", texto: "Início", Icone: Home },
  { para: "/coordenacao/turmas", texto: "Turmas", Icone: Layers },
  { para: "/coordenacao/trilhas", texto: "Trilhas", Icone: BookOpen },
  { para: "/coordenacao/certificados", texto: "Certificados", Icone: Award },
  // D3 — espaço reservado para a tela "Pessoas" (gestão de usuários), que
  // ainda não existe no código; fica com borda tracejada, sem link.
  { para: "", texto: "Pessoas", Icone: Users, aindaNaoExiste: true },
];

export function navPorPapel(papel: Papel | undefined): ItemNav[] {
  if (papel === "aluno") return ALUNO;
  if (papel === "professor") return PROFESSOR;
  if (papel === "coordenacao") return COORDENACAO;
  return [];
}

// D3 (celular) — barra inferior fixa, subconjunto da navegação de cada
// papel. Professor troca "Catálogo" aqui por decisão própria (ver
// BarraLateral/PaginaAutenticada): o wireframe original mostra "Perfil"
// como terceiro item, mas essa tela não existe em nenhuma parte deste
// prompt — inventar uma tela de perfil não pedida ficaria fora de escopo.
// Sair no celular fica na tira superior (todos os papéis), não na barra
// inferior.
export function navMobilePorPapel(papel: Papel | undefined): ItemNav[] {
  if (papel === "aluno") return ALUNO;
  if (papel === "professor") return PROFESSOR;
  return [];
}
