import {
  Atom,
  BarChart3,
  Book,
  BookOpen,
  Brain,
  Briefcase,
  Calculator,
  Camera,
  Code,
  Cpu,
  Database,
  FlaskConical,
  Globe,
  GraduationCap,
  HeartPulse,
  Languages,
  Leaf,
  Library,
  Lightbulb,
  type LucideIcon,
  Microscope,
  Music,
  Palette,
  PenTool,
  Scale,
  Sigma,
  TerminalSquare,
} from "lucide-react";

// Conjunto curado de ícones relevantes ao domínio educacional (não a
// biblioteca inteira). A chave kebab-case é o que fica salvo em
// catalogo.trilhas.icone / catalogo.modulos.icone; o componente é
// resolvido aqui, no frontend, sem import dinâmico.
// "book-open" NÃO entra na lista: ele já é o ícone padrão (ICONE_PADRAO
// abaixo), então a primeira casinha do seletor — a de "sem ícone" — já o
// mostra. Tê-lo também aqui punha dois livros abertos idênticos lado a
// lado no grid; era a "duplicação de ícone" relatada na edição.
export const ICONES_CATALOGO: Record<string, LucideIcon> = {
  book: Book,
  library: Library,
  "graduation-cap": GraduationCap,
  code: Code,
  terminal: TerminalSquare,
  cpu: Cpu,
  database: Database,
  calculator: Calculator,
  sigma: Sigma,
  "bar-chart": BarChart3,
  brain: Brain,
  atom: Atom,
  "flask-conical": FlaskConical,
  microscope: Microscope,
  globe: Globe,
  languages: Languages,
  palette: Palette,
  music: Music,
  camera: Camera,
  "pen-tool": PenTool,
  briefcase: Briefcase,
  "heart-pulse": HeartPulse,
  scale: Scale,
  leaf: Leaf,
  lightbulb: Lightbulb,
};

// Ícone padrão neutro quando a trilha/módulo não escolheu nenhum.
const ICONE_PADRAO = BookOpen;

export function IconeCatalogo({
  nome,
  className = "",
}: {
  nome: string | null | undefined;
  className?: string;
}) {
  const Componente = (nome && ICONES_CATALOGO[nome]) || ICONE_PADRAO;
  return <Componente className={className} aria-hidden />;
}

// Grade de seleção de ícone. valor null = "sem ícone" (usa o padrão).
export function IconePicker({
  valor,
  onChange,
}: {
  valor: string | null;
  onChange: (nome: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {/* Opção "padrão": limpa a escolha. */}
      <button
        type="button"
        aria-label="Ícone padrão"
        aria-pressed={valor === null}
        onClick={() => onChange(null)}
        className={`flex h-10 w-10 items-center justify-center rounded-klass-control border ${
          valor === null
            ? "border-primary bg-primary-subtle text-primary"
            : "border-transparent bg-surface-subtle text-text-secondary transition hover:bg-neutral-subtle"
        }`}
      >
        <BookOpen className="h-5 w-5" aria-hidden />
      </button>
      {Object.entries(ICONES_CATALOGO).map(([nome, Componente]) => (
        <button
          key={nome}
          type="button"
          aria-label={nome}
          aria-pressed={valor === nome}
          onClick={() => onChange(nome)}
          className={`flex h-10 w-10 items-center justify-center rounded-klass-control border ${
            valor === nome
              ? "border-primary bg-primary-subtle text-primary"
              : "border-transparent bg-surface-subtle text-text-secondary transition hover:bg-neutral-subtle"
          }`}
        >
          <Componente className="h-5 w-5" aria-hidden />
        </button>
      ))}
    </div>
  );
}
