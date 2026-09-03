import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

// navigate(-1) em vez de um destino fixo: a mesma tela pode ser
// alcançada por caminhos diferentes (ex.: /catalogo/:slug a partir do
// catálogo público ou de um link direto), e quem decide pra onde faz
// sentido voltar é o histórico do navegador, não a tela.
export function BotaoVoltar() {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate(-1)}
      className="mb-4 flex items-center gap-1.5 text-body-sm font-medium text-text-secondary hover:text-text-primary"
    >
      <ArrowLeft className="h-4 w-4" />
      Voltar
    </button>
  );
}
