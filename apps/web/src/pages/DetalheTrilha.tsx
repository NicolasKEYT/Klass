import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "@/auth";
import { Aviso } from "@/components/Aviso";
import { Badge } from "@/components/Badge";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { IconeCatalogo } from "@/components/IconeCatalogo";
import { Modal } from "@/components/Modal";
import { PaginaAutenticada } from "@/components/PaginaAutenticada";
import { Titulo } from "@/components/Titulo";
import {
  buscarTrilhaPorSlug,
  listarModulosDaTrilha,
  listarPreRequisitosDaTrilha,
} from "@/lib/catalogo";
import {
  inscreverAluno,
  listarModulosComTurmasDaTrilha,
  type ModuloComTurmas,
} from "@/lib/selecao";
import type { Modulo, NivelModulo, StatusMatricula, Trilha } from "@klass/types";

const NIVEL_LABEL: Record<NivelModulo, string> = {
  iniciante: "Iniciante",
  intermediario: "Intermediário",
  avancado: "Avançado",
};

const STATUS_LABEL: Record<StatusMatricula, string> = {
  inscrita: "Inscrição em análise",
  matriculada: "Matriculado(a)",
  rejeitada: "Inscrição rejeitada",
  cancelada: "Inscrição cancelada",
  concluida: "Aprovado(a)",
  reprovada: "Reprovado(a)",
};

export function DetalheTrilha() {
  const { slug } = useParams<{ slug: string }>();
  const { usuario, profile } = useAuth();
  const [trilha, setTrilha] = useState<Trilha | null | undefined>(undefined);
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [preRequisitos, setPreRequisitos] = useState<Map<string, string[]>>(new Map());
  const [modulosComTurmas, setModulosComTurmas] = useState<Map<string, ModuloComTurmas>>(new Map());
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [inscrevendoId, setInscrevendoId] = useState<string | null>(null);
  // Nomes dos módulos pré-requisito que faltam (null = modal fechado).
  const [preReqFaltantes, setPreReqFaltantes] = useState<string[] | null>(null);

  const moduloIdPorNome = new Map(modulos.map((m) => [m.nome, m.id]));

  function irParaModulo(nome: string) {
    const moduloId = moduloIdPorNome.get(nome);
    setPreReqFaltantes(null);
    if (moduloId) {
      document
        .getElementById(`modulo-${moduloId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  async function carregar() {
    if (!slug) return;
    try {
      const encontrada = await buscarTrilhaPorSlug(slug);
      setTrilha(encontrada);
      if (!encontrada) return;
      const [listaModulos, mapaPreRequisitos, listaModulosComTurmas] = await Promise.all([
        listarModulosDaTrilha(encontrada.id),
        listarPreRequisitosDaTrilha(encontrada.id),
        listarModulosComTurmasDaTrilha(encontrada.id, usuario?.id ?? null),
      ]);
      setModulos(listaModulos);
      setPreRequisitos(mapaPreRequisitos);
      setModulosComTurmas(new Map(listaModulosComTurmas.map((m) => [m.moduloId, m])));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar a trilha.");
    }
  }

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function aoInscrever(turmaId: string) {
    setErro(null);
    setMensagem(null);
    setInscrevendoId(turmaId);
    try {
      await inscreverAluno(turmaId);
      setMensagem("Inscrição enviada — a coordenação vai avaliar em breve.");
      await carregar();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Não foi possível se inscrever nesta turma.";
      // Erro de pré-requisito (P0001) vira modal com a lista de módulos
      // faltantes; o resto continua como banner de erro.
      const match = msg.match(/concluir o módulo (.+?) antes de se inscrever/i);
      if (match) {
        setPreReqFaltantes(match[1].split(/,\s*/));
      } else {
        setErro(msg);
      }
    } finally {
      setInscrevendoId(null);
    }
  }

  return (
    <PaginaAutenticada>
        <BotaoVoltar />
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
        {trilha === null && (
          <p className="text-body-sm text-text-secondary">Trilha não encontrada.</p>
        )}
        {trilha === undefined && !erro && (
          <p className="text-body-sm text-text-secondary">Carregando...</p>
        )}

        {trilha && (
          <>
            <div className="flex items-center gap-2">
              <IconeCatalogo nome={trilha.icone} className="h-6 w-6 text-primary" />
              <Titulo>{trilha.nome}</Titulo>
            </div>
            <p className="mt-2 text-body-sm text-text-secondary">{trilha.descricao}</p>
            <p className="mt-2 text-label text-text-muted">
              Carga horária total: {trilha.carga_horaria_total}h
            </p>

            <div className="mt-6 flex flex-col gap-4">
              {modulos.map((modulo) => {
                const turmasDoModulo = modulosComTurmas.get(modulo.id)?.turmas ?? [];
                return (
                  <Card
                    key={modulo.id}
                    id={`modulo-${modulo.id}`}
                    className="flex flex-col gap-2 scroll-mt-6"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <IconeCatalogo
                          nome={modulo.icone}
                          className="h-5 w-5 text-text-secondary"
                        />
                        <Titulo nivel="item" as="h2">
                          {modulo.ordem}. {modulo.nome}
                        </Titulo>
                      </div>
                      <Badge variant="neutral">{NIVEL_LABEL[modulo.nivel]}</Badge>
                    </div>
                    <p className="text-body-sm text-text-secondary">{modulo.descricao}</p>
                    <p className="text-label text-text-muted">{modulo.carga_horaria_horas}h</p>
                    {(preRequisitos.get(modulo.id)?.length ?? 0) > 0 && (
                      <p className="text-label text-text-muted">
                        Requer: {preRequisitos.get(modulo.id)!.join(", ")}
                      </p>
                    )}

                    {/* Turma é oferta deste módulo específico — cada disciplina
                        tem suas próprias turmas e professor, não a trilha inteira. */}
                    <div className="mt-2 flex flex-col gap-2 border-t border-border pt-3">
                      {turmasDoModulo.length === 0 && (
                        <p className="text-label text-text-muted">
                          Nenhuma turma aberta para este módulo no momento.
                        </p>
                      )}
                      {turmasDoModulo.map((turma) => (
                        <div
                          key={turma.id}
                          className="flex items-center justify-between gap-4 rounded-klass-control bg-neutral-subtle px-3 py-2"
                        >
                          <div className="flex flex-col gap-0.5">
                            <span className="text-body-sm font-medium text-text-primary">
                              {turma.codigo}
                            </span>
                            <span className="text-label text-text-muted">
                              {turma.professorNome} · {turma.periodoInicio} a{" "}
                              {turma.periodoFim} · {turma.vagasRestantes} vaga(s) restante(s)
                            </span>
                          </div>

                          {turma.minhaMatricula ? (
                            <Badge
                              variant={
                                turma.minhaMatricula.status === "matriculada" ||
                                turma.minhaMatricula.status === "concluida"
                                  ? "success"
                                  : "neutral"
                              }
                            >
                              {STATUS_LABEL[turma.minhaMatricula.status]}
                            </Badge>
                          ) : profile?.papel === "aluno" ? (
                            <Button
                              disabled={turma.vagasRestantes <= 0 || inscrevendoId === turma.id}
                              onClick={() => void aoInscrever(turma.id)}
                            >
                              {inscrevendoId === turma.id
                                ? "Inscrevendo..."
                                : turma.vagasRestantes <= 0
                                  ? "Sem vagas"
                                  : "Inscrever-se"}
                            </Button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </Card>
                );
              })}
            </div>
          </>
        )}

        <Modal
          aberto={preReqFaltantes !== null}
          titulo="Pré-requisito não cumprido"
          onFechar={() => setPreReqFaltantes(null)}
          rodape={
            <Button variant="secondary" onClick={() => setPreReqFaltantes(null)}>
              Cancelar
            </Button>
          }
        >
          <p className="mb-3 text-body-sm text-text-secondary">
            Você precisa concluir{" "}
            {preReqFaltantes?.length === 1 ? "o módulo abaixo" : "os módulos abaixo"} antes de se
            inscrever neste módulo:
          </p>
          <ul className="flex flex-col gap-2">
            {preReqFaltantes?.map((nome) => {
              const moduloId = moduloIdPorNome.get(nome);
              const temPreReqProprio = moduloId
                ? (preRequisitos.get(moduloId)?.length ?? 0) > 0
                : false;
              return (
                <li key={nome} className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => irParaModulo(nome)}
                    className="text-left text-body-sm font-medium text-primary hover:underline"
                  >
                    {nome}
                  </button>
                  {temPreReqProprio && (
                    <span className="text-label text-text-muted">
                      Este módulo também tem pré-requisitos próprios.
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </Modal>
    </PaginaAutenticada>
  );
}
