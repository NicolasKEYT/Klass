import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/auth";
import { Aviso } from "@/components/Aviso";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { PaginaAutenticada } from "@/components/PaginaAutenticada";
import { Titulo } from "@/components/Titulo";
import { buscarProgressoMatricula, type ProgressoMatricula } from "@/lib/diario";
import {
  cancelarInscricao,
  listarMatriculasDoAluno,
  type MatriculaDoAluno,
} from "@/lib/selecao";
import type { StatusMatricula } from "@klass/types";

const STATUS_COM_DIARIO: StatusMatricula[] = ["matriculada", "concluida", "reprovada"];

const STATUS_VARIANTE: Record<StatusMatricula, "success" | "neutral" | "danger"> = {
  inscrita: "neutral",
  matriculada: "success",
  rejeitada: "danger",
  cancelada: "neutral",
  concluida: "success",
  reprovada: "danger",
};

const STATUS_LABEL: Record<StatusMatricula, string> = {
  inscrita: "Em análise",
  matriculada: "Matriculado(a)",
  rejeitada: "Rejeitada",
  cancelada: "Cancelada",
  concluida: "Aprovado(a)",
  reprovada: "Reprovado(a)",
};

export function Matriculas() {
  const { usuario } = useAuth();
  const [matriculas, setMatriculas] = useState<MatriculaDoAluno[] | null>(null);
  const [progressos, setProgressos] = useState<Map<string, ProgressoMatricula>>(new Map());
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [cancelandoId, setCancelandoId] = useState<string | null>(null);

  async function carregar() {
    if (!usuario) return;
    try {
      const lista = await listarMatriculasDoAluno(usuario.id);
      setMatriculas(lista);

      const comDiario = lista.filter((m) => STATUS_COM_DIARIO.includes(m.status));
      const progressosCarregados = await Promise.all(
        comDiario.map((m) => buscarProgressoMatricula(m.id)),
      );
      setProgressos(new Map(comDiario.map((m, i) => [m.id, progressosCarregados[i]])));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar suas matrículas.");
    }
  }

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario?.id]);

  async function aoCancelar(matriculaId: string) {
    setErro(null);
    setMensagem(null);
    try {
      await cancelarInscricao(matriculaId);
      setMensagem("Inscrição cancelada.");
      setCancelandoId(null);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível cancelar a inscrição.");
    }
  }

  return (
    <PaginaAutenticada>
        <Titulo className="mb-6">Minhas matrículas</Titulo>

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

        {!erro && matriculas === null && (
          <p className="text-body-sm text-text-secondary">Carregando...</p>
        )}
        {matriculas?.length === 0 && (
          <p className="text-body-sm text-text-secondary">
            Você ainda não se inscreveu em nenhuma turma — explore o{" "}
            <Link to="/catalogo" className="font-medium text-primary hover:underline">
              catálogo
            </Link>
            .
          </p>
        )}

        <div className="flex flex-col gap-3">
          {matriculas?.map((matricula) => {
            const progresso = progressos.get(matricula.id);
            return (
              <Card key={matricula.id} className="flex items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Titulo nivel="item" as="h2">
                      {matricula.moduloNome}
                    </Titulo>
                    <Badge variant={STATUS_VARIANTE[matricula.status]}>
                      {STATUS_LABEL[matricula.status]}
                    </Badge>
                  </div>
                  <p className="text-label text-text-muted">
                    {matricula.trilhaNome} · Turma {matricula.turmaCodigo} ·{" "}
                    {matricula.professorNome} · {matricula.periodoInicio} a {matricula.periodoFim}
                  </p>
                  {progresso && (
                    <p className="text-label text-text-muted">
                      Média: {progresso.media !== null ? progresso.media.toFixed(1) : "—"} ·
                      Frequência:{" "}
                      {progresso.frequencia !== null ? `${progresso.frequencia.toFixed(0)}%` : "—"}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {STATUS_COM_DIARIO.includes(matricula.status) && (
                    <Link to={`/aluno/matriculas/${matricula.id}`}>
                      <Button variant="secondary" className="whitespace-nowrap">
                        Ver boletim
                      </Button>
                    </Link>
                  )}

                  {matricula.status === "inscrita" &&
                    (cancelandoId === matricula.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-label text-text-secondary">Cancelar de vez?</span>
                        <Button variant="secondary" onClick={() => void aoCancelar(matricula.id)}>
                          Sim
                        </Button>
                        <Button variant="secondary" onClick={() => setCancelandoId(null)}>
                          Não
                        </Button>
                      </div>
                    ) : (
                      <Button variant="secondary" onClick={() => setCancelandoId(matricula.id)}>
                        Cancelar inscrição
                      </Button>
                    ))}
                </div>
              </Card>
            );
          })}
        </div>
    </PaginaAutenticada>
  );
}
