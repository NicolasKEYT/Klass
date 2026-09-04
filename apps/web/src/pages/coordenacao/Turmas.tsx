import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Aviso } from "@/components/Aviso";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Cabecalho } from "@/components/Cabecalho";
import { Card } from "@/components/Card";
import { listarTurmasParaCoordenacao, type TurmaListagem } from "@/lib/selecao";

export function Turmas() {
  const [turmas, setTurmas] = useState<TurmaListagem[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    listarTurmasParaCoordenacao()
      .then(setTurmas)
      .catch((e) => setErro(e instanceof Error ? e.message : "Não foi possível carregar as turmas."));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Cabecalho />
      <div className="mx-auto max-w-5xl p-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-serif text-klass-xl text-text-primary">Turmas</h1>
          <Link to="/coordenacao/turmas/nova">
            <Button>Nova turma</Button>
          </Link>
        </div>

        {erro && (
          <Aviso variant="danger" className="mb-4">
            {erro}
          </Aviso>
        )}
        {!erro && turmas === null && (
          <p className="text-body-sm text-text-secondary">Carregando...</p>
        )}
        {turmas?.length === 0 && (
          <p className="text-body-sm text-text-secondary">Nenhuma turma cadastrada ainda.</p>
        )}

        <div className="flex flex-col gap-3">
          {turmas?.map((turma) => (
            <Card key={turma.id} className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-klass-md text-text-primary">{turma.codigo}</h2>
                  <span className="text-body-sm text-text-secondary">{turma.trilhaNome}</span>
                  {turma.pendentes > 0 && (
                    <Badge variant="neutral">{turma.pendentes} pendente(s)</Badge>
                  )}
                </div>
                <p className="text-label text-text-muted">
                  {turma.professorNome} · {turma.periodoInicio} a {turma.periodoFim} ·{" "}
                  {turma.matriculados}/{turma.vagasTotal} vagas
                </p>
              </div>

              <Link
                to={`/coordenacao/turmas/${turma.id}`}
                className="text-body-sm font-medium text-primary hover:underline"
              >
                Detalhes
              </Link>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
