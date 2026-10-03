import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { useAuth } from "@/auth";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { LinkBotao } from "@/components/LinkBotao";
import { PaginaAutenticada } from "@/components/PaginaAutenticada";
import { Titulo } from "@/components/Titulo";
import { rotuloDoPapel } from "@/lib/identidade";

// D3 (klass-uikit.pdf, pág. 7) — "Perfil" é o terceiro item da barra
// inferior do professor; o aluno chega aqui pelo avatar (menu do usuário).
// Só mostra o que a sessão já tem (perfil e e-mail do Auth): nenhuma
// consulta nova. Edição de dados pessoais não faz parte do escopo.
export function Perfil() {
  const { usuario, profile, sair } = useAuth();
  const navigate = useNavigate();

  async function aoSair() {
    await sair();
    navigate("/entrar");
  }

  return (
    <PaginaAutenticada largura="estreita">
      <Titulo className="mb-6">Perfil</Titulo>
      {profile && (
        <Card className="flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <Avatar nome={profile.nome_completo} tamanho="grande" />
            <div className="min-w-0">
              <Titulo nivel="item" as="h2" className="break-words">
                {profile.nome_completo}
              </Titulo>
              <p className="text-body-sm text-text-secondary">{rotuloDoPapel(profile.papel)}</p>
            </div>
          </div>

          <dl className="flex flex-col gap-1">
            <dt className="text-label text-text-muted">E-mail</dt>
            <dd className="break-all text-body-sm text-text-primary">{usuario?.email ?? "—"}</dd>
          </dl>

          <div className="flex flex-col gap-3 sm:flex-row">
            <LinkBotao to="/catalogo" variant="secondary">
              <Search className="h-4 w-4" aria-hidden />
              Abrir o Catálogo
            </LinkBotao>
            <Button type="button" variant="secondary" onClick={() => void aoSair()}>
              Sair
            </Button>
          </div>
        </Card>
      )}
    </PaginaAutenticada>
  );
}
