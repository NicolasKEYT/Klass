import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Aviso } from "@/components/Aviso";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { PaginaAutenticada } from "@/components/PaginaAutenticada";
import { Titulo } from "@/components/Titulo";
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
    <PaginaAutenticada largura="ampla">
        <div className="mb-6 flex items-center justify-between">
          <Titulo>Turmas</Titulo>
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
                  <Titulo nivel="item" as="h2">
                    {turma.codigo}
                  </Titulo>
                  <span className="text-body-sm text-text-secondary">
                    {turma.moduloNome} · {turma.trilhaNome}
                  </span>
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
    </PaginaAutenticada>
  );
}
