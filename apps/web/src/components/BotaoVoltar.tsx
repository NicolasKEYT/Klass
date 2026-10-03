import { ArrowLeft } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";

const CLASSES = "mb-4 flex items-center gap-1.5 text-body-sm font-medium text-text-secondary hover:text-text-primary";

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
}

// Sem `para`, navigate(-1): a mesma tela pode ser alcançada por caminhos
// diferentes, e quem decide pra onde faz sentido voltar é o histórico do
// navegador, não a tela.
export function BotaoVoltar({ para, seSemHistorico, rotulo = "Voltar" }: BotaoVoltarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  if (para) {
    return (
      <Link to={para} className={CLASSES}>
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {rotulo}
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
      className={CLASSES}
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      {rotulo}
    </button>
  );
}
