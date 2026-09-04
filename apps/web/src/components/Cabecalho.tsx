import { Link, useNavigate } from "react-router-dom";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { useAuth } from "@/auth";

// Cabeçalho enxuto das rotas protegidas — muda o que aparece conforme o papel.
export function Cabecalho() {
  const { profile, sair } = useAuth();
  const navigate = useNavigate();

  async function aoSair() {
    await sair();
    navigate("/entrar");
  }

  return (
    <header className="flex h-klass-header items-center justify-between border-b border-border bg-surface-subtle px-6">
      <Link to="/" className="font-serif text-klass-lg text-text-primary">
        Klass
      </Link>

      <nav className="flex items-center gap-6">
        <Link
          to="/catalogo"
          className="text-body-sm font-medium text-text-secondary hover:text-text-primary"
        >
          Catálogo
        </Link>
        {profile?.papel === "coordenacao" && (
          <>
            <Link
              to="/coordenacao/trilhas"
              className="text-body-sm font-medium text-text-secondary hover:text-text-primary"
            >
              Trilhas
            </Link>
            <Link
              to="/coordenacao/turmas"
              className="text-body-sm font-medium text-text-secondary hover:text-text-primary"
            >
              Turmas
            </Link>
          </>
        )}
        {profile?.papel === "aluno" && (
          <Link
            to="/aluno/matriculas"
            className="text-body-sm font-medium text-text-secondary hover:text-text-primary"
          >
            Minhas matrículas
          </Link>
        )}
        {profile?.papel === "professor" && (
          <Link
            to="/professor/turmas"
            className="text-body-sm font-medium text-text-secondary hover:text-text-primary"
          >
            Minhas turmas
          </Link>
        )}

        <div className="flex items-center gap-3">
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
      </nav>
    </header>
  );
}
