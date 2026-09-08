import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "@/auth";
import { Aviso } from "@/components/Aviso";
import { Badge } from "@/components/Badge";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Button } from "@/components/Button";
import { Cabecalho } from "@/components/Cabecalho";
import { Card } from "@/components/Card";
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
  concluida: "Concluída",
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
      setErro(e instanceof Error ? e.message : "Não foi possível se inscrever nesta turma.");
    } finally {
      setInscrevendoId(null);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Cabecalho />
      <div className="mx-auto max-w-3xl p-6">
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
            <h1 className="font-serif text-klass-xl text-text-primary">{trilha.nome}</h1>
            <p className="mt-2 text-body-sm text-text-secondary">{trilha.descricao}</p>
            <p className="mt-2 text-label text-text-muted">
              Carga horária total: {trilha.carga_horaria_total}h
            </p>

            <div className="mt-6 flex flex-col gap-4">
              {modulos.map((modulo) => {
                const turmasDoModulo = modulosComTurmas.get(modulo.id)?.turmas ?? [];
                return (
                  <Card key={modulo.id} className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <h2 className="text-klass-md text-text-primary">
                        {modulo.ordem}. {modulo.nome}
                      </h2>
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
      </div>
    </div>
  );
}
