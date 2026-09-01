import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Aviso } from "@/components/Aviso";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Cabecalho } from "@/components/Cabecalho";
import { Card } from "@/components/Card";
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
      setMensagem(trilha.publicada ? "Trilha despublicada." : "Trilha publicada.");
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
    <div className="min-h-screen bg-background">
      <Cabecalho />
      <div className="mx-auto max-w-4xl p-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-serif text-klass-xl text-text-primary">Trilhas</h1>
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

        <div className="flex flex-col gap-3">
          {trilhas?.map((trilha) => (
            <Card key={trilha.id} className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-klass-md text-text-primary">{trilha.nome}</h2>
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
                      {trilha.publicada ? "Despublicar" : "Publicar"}
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
      </div>
    </div>
  );
}
