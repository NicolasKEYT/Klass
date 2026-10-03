import { useNavigate } from "react-router-dom";
import { Avatar } from "@/components/Avatar";
import { IndicadorSincronizacao } from "@/components/IndicadorSincronizacao";
import { LinkComPrefetch } from "@/components/LinkComPrefetch";
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
          <span className="text-[13px] font-semibold leading-none">K</span>
        </div>
        <span className="text-klass-md font-semibold text-text-primary">Klass</span>
      </div>

      <div className="flex items-center gap-3">
        <IndicadorSincronizacao />
        {/* Menu do usuário no celular: o avatar abre o Perfil. A
            coordenação não tem Perfil no celular (só o Início é usável). */}
        {profile && profile.papel !== "coordenacao" && (
          <LinkComPrefetch
            to="/perfil"
            aria-label={`Perfil de ${profile.nome_completo}`}
            className="rounded-full md:hidden"
          >
            <Avatar nome={profile.nome_completo} />
          </LinkComPrefetch>
        )}
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
