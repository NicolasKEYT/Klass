import { useNavigate } from "react-router-dom";
import { IndicadorSincronizacao } from "@/components/IndicadorSincronizacao";
import { useAuth } from "@/auth";

// D13 — o indicador de sincronização fica sempre visível no topo de toda
// tela autenticada, celular ou desktop. No desktop a identidade e o Sair
// já vivem no rodapé da BarraLateral; no celular, que não tem barra
// lateral nenhuma, esta tira também é o único lugar com um botão de Sair
// visível em toda tela (a barra inferior, quando existe, só tem os 3–4
// itens de conteúdo do papel — ver itensDeNavegacao.ts).
export function TiraSuperior() {
  const { profile, sair } = useAuth();
  const navigate = useNavigate();

  async function aoSair() {
    await sair();
    navigate("/entrar");
  }

  return (
    <div className="flex items-center justify-between gap-3 border-b border-border bg-surface-subtle px-4 py-2.5 sm:px-6 md:justify-end md:border-none md:bg-transparent md:px-0 md:py-2">
      <div className="flex items-center gap-2 md:hidden">
        <div
          className="flex h-6 w-6 items-center justify-center rounded-klass-badge bg-text-primary text-white"
          aria-hidden
        >
          <span className="font-serif text-[13px] font-semibold leading-none">K</span>
        </div>
        <span className="font-serif text-klass-md font-semibold text-text-primary">Klass</span>
      </div>

      <div className="flex items-center gap-3">
        <IndicadorSincronizacao />
        {profile && (
          <button
            type="button"
            onClick={() => void aoSair()}
            className="text-label font-medium text-text-secondary hover:text-text-primary md:hidden"
          >
            Sair
          </button>
        )}
      </div>
    </div>
  );
}
