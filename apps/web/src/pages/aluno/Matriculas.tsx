import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/auth";
import { Aviso } from "@/components/Aviso";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Cabecalho } from "@/components/Cabecalho";
import { Card } from "@/components/Card";
import {
  cancelarInscricao,
  listarMatriculasDoAluno,
  type MatriculaDoAluno,
} from "@/lib/selecao";
import type { StatusMatricula } from "@klass/types";

const STATUS_VARIANTE: Record<StatusMatricula, "success" | "neutral" | "danger"> = {
  inscrita: "neutral",
  matriculada: "success",
  rejeitada: "danger",
  cancelada: "neutral",
  concluida: "success",
};

const STATUS_LABEL: Record<StatusMatricula, string> = {
  inscrita: "Em análise",
  matriculada: "Matriculado(a)",
  rejeitada: "Rejeitada",
  cancelada: "Cancelada",
  concluida: "Concluída",
};

export function Matriculas() {
  const { usuario } = useAuth();
  const [matriculas, setMatriculas] = useState<MatriculaDoAluno[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [cancelandoId, setCancelandoId] = useState<string | null>(null);

  async function carregar() {
    if (!usuario) return;
    try {
      setMatriculas(await listarMatriculasDoAluno(usuario.id));
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
    <div className="min-h-screen bg-background">
      <Cabecalho />
      <div className="mx-auto max-w-3xl p-6">
        <h1 className="mb-6 font-serif text-klass-xl text-text-primary">Minhas matrículas</h1>

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
          {matriculas?.map((matricula) => (
            <Card key={matricula.id} className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-klass-md text-text-primary">{matricula.trilhaNome}</h2>
                  <Badge variant={STATUS_VARIANTE[matricula.status]}>
                    {STATUS_LABEL[matricula.status]}
                  </Badge>
                </div>
                <p className="text-label text-text-muted">
                  Turma {matricula.turmaCodigo} · {matricula.professorNome} ·{" "}
                  {matricula.periodoInicio} a {matricula.periodoFim}
                </p>
              </div>

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
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
