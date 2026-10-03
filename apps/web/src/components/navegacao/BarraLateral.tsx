import { useLocation, useNavigate } from "react-router-dom";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/auth";
import { LinkComPrefetch } from "@/components/LinkComPrefetch";
import { rotuloDoPapel } from "@/lib/identidade";
import { INSTITUICAO } from "@/lib/instituicao";
import { navPorPapel } from "./itensDeNavegacao";

// D3 (klass-uikit.pdf, decisão de desenho) — "barra lateral com rótulos no
// desktop e barra inferior no celular. No máximo 5 itens por papel. A
// navegação vertical é escalável e fácil de escanear, e 80% do tempo de
// olhar a tela se concentra à esquerda". Substitui o cabeçalho horizontal
// (Cabecalho.tsx, aposentado por este componente).
export function BarraLateral() {
  const { profile, sair } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const itens = navPorPapel(profile?.papel);

  async function aoSair() {
    await sair();
    navigate("/entrar");
  }

  return (
    // Presa à viewport (sticky + altura da tela): o conteúdo rola ao lado e
    // "Sair" fica sempre visível; antes a barra esticava com a página. Se
    // a navegação não couber, só ela rola.
    <aside className="hidden shrink-0 flex-col border-r border-border bg-surface md:sticky md:top-0 md:flex md:h-screen md:w-klass-sidebar">
      <div className="flex h-klass-header items-center gap-2.5 border-b border-border px-5">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-klass-control bg-text-primary text-white"
          aria-hidden
        >
          <span className="text-klass-md font-semibold">K</span>
        </div>
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="text-klass-md font-semibold text-text-primary">Klass</span>
          {/* Uma linha só: o cabeçalho tem altura fixa e o nome pode ser longo. */}
          <span className="truncate text-label text-text-muted" title={INSTITUICAO.nome}>
            {INSTITUICAO.nome}
          </span>
        </div>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
        {itens.map((item) => {
          if (item.aindaNaoExiste) {
            return (
              <span
                key={item.texto}
                title="Ainda não implementado"
                className="flex items-center gap-3 rounded-klass-control border border-dashed border-border px-3 py-2.5 text-klass-md text-text-muted"
              >
                <item.Icone className="h-5 w-5" aria-hidden />
                {item.texto}
              </span>
            );
          }
          const ativo =
            location.pathname === item.para ||
            (item.para !== "/" && location.pathname.startsWith(item.para));
          return (
            <LinkComPrefetch
              key={item.para}
              to={item.para}
              className={`flex items-center gap-3 rounded-klass-control px-3 py-2.5 text-klass-md font-medium transition ${
                ativo
                  ? "bg-primary-subtle text-primary"
                  : "text-text-secondary hover:bg-neutral-subtle hover:text-text-primary"
              }`}
            >
              <item.Icone className="h-5 w-5" aria-hidden />
              {item.texto}
            </LinkComPrefetch>
          );
        })}
      </nav>

      {/* D3 (pág. 7) — rodapé: avatar de iniciais, nome e papel. O bloco é
          o menu do usuário e leva ao Perfil; Sair fica ao lado. */}
      {profile && (
        <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-3">
          <LinkComPrefetch
            to="/perfil"
            className={`flex min-w-0 flex-1 items-center gap-3 rounded-klass-control px-2 py-1.5 transition ${
              location.pathname === "/perfil" ? "bg-primary-subtle" : "hover:bg-neutral-subtle"
            }`}
          >
            <Avatar nome={profile.nome_completo} />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-body-sm font-semibold text-text-primary">
                {profile.nome_completo}
              </span>
              <span className="truncate text-label text-text-secondary">
                {rotuloDoPapel(profile.papel)}
              </span>
            </span>
          </LinkComPrefetch>
          <button
            type="button"
            onClick={() => void aoSair()}
            className="shrink-0 rounded-klass-control px-2 py-1.5 text-label font-medium text-text-secondary hover:text-text-primary"
          >
            Sair
          </button>
        </div>
      )}
    </aside>
  );
}
