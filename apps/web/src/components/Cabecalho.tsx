import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { useAuth } from "@/auth";

// Links de navegação por papel — usados tanto na barra desktop quanto no
// menu mobile, para não duplicar a lógica de "o que cada papel vê".
function linksDoPapel(papel: string | undefined): Array<{ para: string; texto: string }> {
  const comuns = [{ para: "/catalogo", texto: "Catálogo" }];
  if (papel === "coordenacao") {
    return [
      ...comuns,
      { para: "/coordenacao/trilhas", texto: "Trilhas" },
      { para: "/coordenacao/turmas", texto: "Turmas" },
      { para: "/coordenacao/certificados", texto: "Certificados" },
    ];
  }
  if (papel === "aluno") {
    return [
      ...comuns,
      { para: "/aluno/matriculas", texto: "Minhas matrículas" },
      { para: "/aluno/certificados", texto: "Meus certificados" },
    ];
  }
  if (papel === "professor") {
    return [...comuns, { para: "/professor/turmas", texto: "Minhas turmas" }];
  }
  return comuns;
}

const linkClasse =
  "text-body-sm font-medium text-text-secondary hover:text-text-primary";

// Cabeçalho das rotas protegidas. Esquerda: logo + navegação clicável.
// Direita: identidade do usuário + Sair. No mobile a navegação colapsa
// num menu hambúrguer para não quebrar a barra.
export function Cabecalho() {
  const { profile, sair } = useAuth();
  const navigate = useNavigate();
  const [menuAberto, setMenuAberto] = useState(false);

  async function aoSair() {
    await sair();
    navigate("/entrar");
  }

  const links = linksDoPapel(profile?.papel);

  return (
    <header className="border-b border-border bg-surface-subtle">
      <div className="flex h-klass-header items-center justify-between px-4 sm:px-6">
        {/* Esquerda: logo + navegação (desktop) */}
        <div className="flex items-center gap-6">
          <Link to="/" className="font-serif text-klass-lg text-text-primary">
            Klass
          </Link>
          <nav className="hidden items-center gap-5 md:flex">
            {links.map((link) => (
              <Link key={link.para} to={link.para} className={linkClasse}>
                {link.texto}
              </Link>
            ))}
          </nav>
        </div>

        {/* Direita: identidade + Sair (desktop) */}
        <div className="hidden items-center gap-3 md:flex">
          {profile && (
            <>
              <span className="text-body-sm text-text-secondary">{profile.nome_completo}</span>
              <Badge variant="neutral">{profile.papel}</Badge>
            </>
          )}
          <Button variant="secondary" onClick={() => void aoSair()}>
            Sair
          </Button>
        </div>

        {/* Botão do menu (mobile) */}
        <button
          type="button"
          className="text-text-secondary hover:text-text-primary md:hidden"
          aria-label={menuAberto ? "Fechar menu" : "Abrir menu"}
          aria-expanded={menuAberto}
          onClick={() => setMenuAberto((v) => !v)}
        >
          {menuAberto ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Painel do menu (mobile) */}
      {menuAberto && (
        <div className="border-t border-border px-4 py-3 md:hidden">
          <nav className="flex flex-col gap-1">
            {links.map((link) => (
              <Link
                key={link.para}
                to={link.para}
                onClick={() => setMenuAberto(false)}
                className="rounded-klass-control px-2 py-2 text-body-sm font-medium text-text-secondary hover:bg-neutral-subtle hover:text-text-primary"
              >
                {link.texto}
              </Link>
            ))}
          </nav>
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
            {profile && (
              <div className="flex items-center gap-2">
                <span className="text-body-sm text-text-secondary">{profile.nome_completo}</span>
                <Badge variant="neutral">{profile.papel}</Badge>
              </div>
            )}
            <Button variant="secondary" onClick={() => void aoSair()}>
              Sair
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
