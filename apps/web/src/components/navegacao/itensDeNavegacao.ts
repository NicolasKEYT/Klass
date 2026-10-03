import {
  Award,
  BookOpen,
  Calendar,
  FileText,
  Home,
  Layers,
  Search,
  User,
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
  /** Item reservado no desenho, ainda sem tela: borda tracejada, sem link. */
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
  // Ordem da pág. 7 do UI Kit: Pessoas antes de Certificados.
  { para: "/coordenacao/pessoas", texto: "Pessoas", Icone: Users },
  { para: "/coordenacao/certificados", texto: "Certificados", Icone: Award },
];

// Barra inferior do professor (pág. 7 do UI Kit): Hoje · Turmas · Perfil.
// O Catálogo sai da barra (fica como atalho na tela Perfil) e "Minhas
// turmas" encurta para caber com o rótulo sempre visível.
const PROFESSOR_MOBILE: ItemNav[] = [
  { para: "/", texto: "Hoje", Icone: Calendar },
  { para: "/professor/turmas", texto: "Turmas", Icone: Layers },
  { para: "/perfil", texto: "Perfil", Icone: User },
];

export function navPorPapel(papel: Papel | undefined): ItemNav[] {
  if (papel === "aluno") return ALUNO;
  if (papel === "professor") return PROFESSOR;
  if (papel === "coordenacao") return COORDENACAO;
  return [];
}

// D3 (celular) — barra inferior fixa. O aluno usa os mesmos 4 itens do
// desktop e chega ao Perfil pelo avatar da tira superior (menu do
// usuário); o professor tem Perfil na própria barra. Sair fica na tira
// superior e na tela Perfil.
export function navMobilePorPapel(papel: Papel | undefined): ItemNav[] {
  if (papel === "aluno") return ALUNO;
  if (papel === "professor") return PROFESSOR_MOBILE;
  return [];
}
