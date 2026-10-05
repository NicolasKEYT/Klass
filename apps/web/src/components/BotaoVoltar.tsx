import { ArrowLeft, ChevronLeft } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";

const CLASSES = "mb-4 flex items-center gap-1.5 text-body-sm font-medium text-text-secondary hover:text-text-primary";
// Variantes do cabeçalho de página (pág. 6 e 8 do UI Kit). Só o chevron:
// alvo de toque de 40px, o rótulo vira nome acessível. Chevron + rótulo:
// linha acima do título.
const CLASSES_SO_ICONE =
  "-ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-klass-control text-text-primary hover:bg-neutral-subtle";
const CLASSES_COM_ROTULO =
  "-ml-1 mb-2 flex min-h-10 w-fit items-center gap-1 text-body-sm text-text-primary hover:underline";

interface BotaoVoltarProps {
  /**
   * Destino fixo: vira um link comum e ignora o histórico. Usado onde a
   * hierarquia é clara (módulo → trilha → catálogo) — com navigate(-1),
   * "← trilha" no módulo + "Voltar" na trilha formavam um loop sem fim
   * entre as duas telas.
   */
  para?: string;
  /**
   * Destino só para quando não há tela anterior do app no histórico (link
   * direto, aba nova). Com histórico, continua navigate(-1) — é o que
   * preserva estado da URL de origem, ex.: a Chamada volta para a turma
   * já na aba ?aba=aulas.
   */
  seSemHistorico?: string;
  rotulo?: string;
  /** Variantes do cabeçalho de página: só o chevron, ou chevron + rótulo. */
  chevron?: "so-icone" | "com-rotulo";
}

// Sem `para`, navigate(-1): a mesma tela pode ser alcançada por caminhos
// diferentes, e quem decide pra onde faz sentido voltar é o histórico do
// navegador, não a tela.
export function BotaoVoltar({ para, seSemHistorico, rotulo = "Voltar", chevron }: BotaoVoltarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const classes =
    chevron === "so-icone" ? CLASSES_SO_ICONE : chevron === "com-rotulo" ? CLASSES_COM_ROTULO : CLASSES;
  const conteudo =
    chevron === "so-icone" ? (
      <ChevronLeft className="h-6 w-6" aria-hidden />
    ) : chevron === "com-rotulo" ? (
      <>
        <ChevronLeft className="h-5 w-5" aria-hidden />
        {rotulo}
      </>
    ) : (
    <>
      <ArrowLeft className="h-4 w-4" aria-hidden />
      {rotulo}
    </>
  );

  if (para) {
    return (
      <Link to={para} className={classes} aria-label={chevron === "so-icone" ? rotulo : undefined}>
        {conteudo}
      </Link>
    );
  }

  // O React Router marca com key "default" a primeira entrada carregada
  // na aba — nesse caso navigate(-1) sairia do app (ou não faria nada).
  const semHistorico = location.key === "default";

  return (
    <button
      type="button"
      onClick={() =>
        semHistorico && seSemHistorico ? navigate(seSemHistorico, { replace: true }) : navigate(-1)
      }
      className={classes}
      aria-label={chevron === "so-icone" ? rotulo : undefined}
    >
      {conteudo}
    </button>
  );
}
