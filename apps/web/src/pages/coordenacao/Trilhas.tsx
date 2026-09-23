import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Aviso } from "@/components/Aviso";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { IconeCatalogo } from "@/components/IconeCatalogo";
import { PaginaAutenticada } from "@/components/PaginaAutenticada";
import { Titulo } from "@/components/Titulo";
import { apagarTrilha, definirPublicacaoTrilha, listarTrilhasComContagem } from "@/lib/catalogo";
import type { Trilha } from "@klass/types";

type TrilhaComContagem = Trilha & { totalModulos: number };

export function Trilhas() {
  const [trilhas, setTrilhas] = useState<TrilhaComContagem[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  // Confirmação inline, não window.confirm — dialogs nativos ficam
  // desabilitados em vários contextos embutidos/automatizados de browser.
  const [confirmandoApagarId, setConfirmandoApagarId] = useState<string | null>(null);

  async function carregar() {
    try {
      setTrilhas(await listarTrilhasComContagem());
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar as trilhas.");
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  async function alternarPublicacao(trilha: TrilhaComContagem) {
    setErro(null);
    setMensagem(null);
    try {
      await definirPublicacaoTrilha(trilha.id, !trilha.publicada);
      setMensagem(trilha.publicada ? "Trilha voltou para rascunho." : "Trilha publicada.");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível atualizar a trilha.");
    }
  }

  async function apagar(trilha: TrilhaComContagem) {
    setErro(null);
    setMensagem(null);
    try {
      await apagarTrilha(trilha.id);
      setMensagem("Trilha apagada.");
      setConfirmandoApagarId(null);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível apagar a trilha.");
    }
  }

  return (
    <PaginaAutenticada>
        <div className="mb-6 flex items-center justify-between">
          <Titulo>Trilhas</Titulo>
          <Link to="/coordenacao/trilhas/nova">
            <Button>Nova trilha</Button>
          </Link>
        </div>

        {erro && (
          <Aviso variant="danger" className="mb-4">
            {erro}
          </Aviso>
        )}
        {mensagem && (
          <Aviso variant="success" className="mb-4">
            {mensagem}
          </Aviso>
        )}

        {/* Sem isso, a navegação client-side entre rotas (onde o
            "Carregando..." do <Autenticado> já resolveu antes) deixava a
            tela em branco — sem indicação nenhuma — pelo tempo do
            fetch, o que lia como travado. Num reload cheio isso passava
            despercebido porque o carregando da autenticação mascarava
            parte da espera. */}
        {!erro && trilhas === null && (
          <p className="text-body-sm text-text-secondary">Carregando...</p>
        )}
        {trilhas?.length === 0 && (
          <p className="text-body-sm text-text-secondary">Nenhuma trilha cadastrada ainda.</p>
        )}

        <div className="flex flex-col gap-3">
          {trilhas?.map((trilha) => (
            <Card
              key={trilha.id}
              className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <IconeCatalogo nome={trilha.icone} className="h-5 w-5 text-text-secondary" />
                  <Titulo nivel="item" as="h2">
                    {trilha.nome}
                  </Titulo>
                  <Badge variant={trilha.publicada ? "success" : "neutral"}>
                    {trilha.publicada ? "Publicada" : "Rascunho"}
                  </Badge>
                </div>
                <p className="text-label text-text-muted">
                  {trilha.totalModulos} módulos · {trilha.carga_horaria_total}h
                </p>
              </div>

              <div className="flex items-center gap-2">
                {confirmandoApagarId === trilha.id ? (
                  <>
                    <span className="text-label text-text-secondary">Apagar de vez?</span>
                    <Button variant="secondary" onClick={() => void apagar(trilha)}>
                      Sim, apagar
                    </Button>
                    <Button variant="secondary" onClick={() => setConfirmandoApagarId(null)}>
                      Cancelar
                    </Button>
                  </>
                ) : (
                  <>
                    <Link
                      to={`/coordenacao/trilhas/${trilha.slug}/editar`}
                      className="text-body-sm font-medium text-primary hover:underline"
                    >
                      Editar
                    </Link>
                    <Button variant="secondary" onClick={() => void alternarPublicacao(trilha)}>
                      {trilha.publicada ? "Voltar para rascunho" : "Publicar"}
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={trilha.publicada}
                      onClick={() => setConfirmandoApagarId(trilha.id)}
                    >
                      Apagar
                    </Button>
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
    </PaginaAutenticada>
  );
}
