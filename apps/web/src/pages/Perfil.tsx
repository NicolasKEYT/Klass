import { useNavigate } from "react-router-dom";
import { Monitor, Moon, Search, Sun } from "lucide-react";
import { useAuth } from "@/auth";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { LinkBotao } from "@/components/LinkBotao";
import { PaginaAutenticada } from "@/components/PaginaAutenticada";
import { Titulo } from "@/components/Titulo";
import { TrocarSenha } from "@/components/TrocarSenha";
import { rotuloDoPapel } from "@/lib/identidade";
import { definirPreferenciaTema, usePreferenciaTema, type PreferenciaTema } from "@/lib/tema";

// D3 (klass-uikit.pdf, pág. 7) — "Perfil" é o terceiro item da barra
// inferior do professor; o aluno chega aqui pelo avatar (menu do usuário).
// Só mostra o que a sessão já tem (perfil e e-mail do Auth): nenhuma
// consulta nova. Edição de dados pessoais não faz parte do escopo; a única
// alteração de conta é a troca de senha.

const OPCOES_TEMA: { valor: PreferenciaTema; texto: string; Icone: typeof Sun }[] = [
  { valor: "sistema", texto: "Sistema", Icone: Monitor },
  { valor: "claro", texto: "Claro", Icone: Sun },
  { valor: "escuro", texto: "Escuro", Icone: Moon },
];

// D1 — tema claro como padrão, escuro como opção. "Sistema" (o padrão)
// acompanha o aparelho. Rádios de verdade (setas trocam a opção, leitor
// de tela anuncia o grupo) com a aparência do controle segmentado do D5;
// o círculo nativo fica escondido porque o único rádio azul do sistema é o
// de "Escolha a turma".
function SeletorTema() {
  const preferencia = usePreferenciaTema();
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-label font-medium text-text-primary">Tema</legend>
      <div className="flex w-full overflow-hidden rounded-klass-control border border-controle sm:w-fit">
        {OPCOES_TEMA.map(({ valor, texto, Icone }, i) => (
          <label key={valor} className={`min-w-0 flex-1 sm:flex-none ${i > 0 ? "border-l border-controle" : ""}`}>
            <input
              type="radio"
              name="tema"
              value={valor}
              checked={preferencia === valor}
              onChange={() => definirPreferenciaTema(valor)}
              className="peer sr-only accent-primary"
            />
            <span className="flex h-12 cursor-pointer items-center justify-center gap-1.5 px-2 text-klass-md font-medium text-text-secondary sm:px-4 transition hover:text-text-primary peer-checked:bg-primary peer-checked:text-primary-contraste peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:-outline-offset-4 peer-focus-visible:outline-primary-contraste sm:h-10">
              <Icone className="h-4 w-4" aria-hidden />
              {texto}
            </span>
          </label>
        ))}
      </div>
      <p className="text-label text-text-muted">
        {preferencia === "sistema"
          ? "Segue a configuração de aparência deste aparelho."
          : "Vale só para este navegador."}
      </p>
    </fieldset>
  );
}

export function Perfil() {
  const { usuario, profile, sair } = useAuth();
  const navigate = useNavigate();

  async function aoSair() {
    await sair();
    navigate("/entrar");
  }

  return (
    <PaginaAutenticada largura="estreita" titulo="Perfil">
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
      <Card className="mt-6 flex flex-col gap-4">
        <Titulo nivel="item" as="h2">
          Aparência
        </Titulo>
        <SeletorTema />
      </Card>
      <Card className="mt-6 flex flex-col gap-4">
        <Titulo nivel="item" as="h2">
          Trocar senha
        </Titulo>
        <TrocarSenha />
      </Card>
      <p className="mt-6 text-label text-text-muted">Klass v{__VERSAO_KLASS__}</p>
    </PaginaAutenticada>
  );
}
