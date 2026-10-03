import { useState } from "react";
import { Link } from "react-router-dom";
import { Aviso } from "@/components/Aviso";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EsqueletoCards } from "@/components/Esqueleto";
import { ErroConsulta } from "@/components/ErroConsulta";
import { IconeCatalogo } from "@/components/IconeCatalogo";
import { LinkComPrefetch } from "@/components/LinkComPrefetch";
import { PaginaAutenticada } from "@/components/PaginaAutenticada";
import { Titulo } from "@/components/Titulo";
import { apagarTrilha, definirPublicacaoTrilha } from "@/lib/catalogo";
import { useTrilhasComContagem } from "@/lib/consultas/catalogo";
import { useGravacao } from "@/lib/consultas/gravacao";
import { invalidar } from "@/lib/consultas/invalidar";
import type { Trilha } from "@klass/types";

type TrilhaComContagem = Trilha & { totalModulos: number };

export function Trilhas() {
  const consulta = useTrilhasComContagem();
  const trilhas = consulta.data;
  const gravar = useGravacao();
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  // Confirmação inline, não window.confirm — dialogs nativos ficam
  // desabilitados em vários contextos embutidos/automatizados de browser.
  const [confirmandoApagarId, setConfirmandoApagarId] = useState<string | null>(null);
  // Trava enquanto publicar/apagar está no ar, para o clique de reflexo
  // não disparar a mesma ação duas vezes.
  const [processando, setProcessando] = useState(false);

  async function alternarPublicacao(trilha: TrilhaComContagem) {
    if (processando) return;
    setErro(null);
    setMensagem(null);
    setProcessando(true);
    try {
      await gravar(() => definirPublicacaoTrilha(trilha.id, !trilha.publicada), invalidar.catalogo);
      setMensagem(trilha.publicada ? "Trilha voltou para rascunho." : "Trilha publicada.");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível atualizar a trilha.");
    } finally {
      setProcessando(false);
    }
  }

  async function apagar(trilha: TrilhaComContagem) {
    if (processando) return;
    setErro(null);
    setMensagem(null);
    setProcessando(true);
    try {
      await gravar(() => apagarTrilha(trilha.id), invalidar.catalogo);
      setMensagem("Trilha apagada.");
      setConfirmandoApagarId(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível apagar a trilha.");
    } finally {
      setProcessando(false);
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

        {consulta.isError && !trilhas && (
          <ErroConsulta
            className="mb-4"
            erro={consulta.error}
            padrao="Não foi possível carregar as trilhas."
            tentarDeNovo={() => void consulta.refetch()}
          />
        )}
        {consulta.isPending && <EsqueletoCards quantidade={4} altura="h-24" />}
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
                    <Button
                      variant="secondary"
                      disabled={processando}
                      onClick={() => void apagar(trilha)}
                    >
                      Sim, apagar
                    </Button>
                    <Button variant="secondary" onClick={() => setConfirmandoApagarId(null)}>
                      Cancelar
                    </Button>
                  </>
                ) : (
                  <>
                    <LinkComPrefetch
                      to={`/coordenacao/trilhas/${trilha.slug}/editar`}
                      className="text-body-sm font-medium text-primary hover:underline"
                    >
                      Editar
                    </LinkComPrefetch>
                    <Button
                      variant="secondary"
                      disabled={processando}
                      onClick={() => void alternarPublicacao(trilha)}
                    >
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
