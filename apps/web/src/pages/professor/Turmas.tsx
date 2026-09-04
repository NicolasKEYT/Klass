import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/auth";
import { Aviso } from "@/components/Aviso";
import { Cabecalho } from "@/components/Cabecalho";
import { Card } from "@/components/Card";
import { listarTurmasDoProfessor, type TurmaDoProfessor } from "@/lib/selecao";

export function Turmas() {
  const { usuario } = useAuth();
  const [turmas, setTurmas] = useState<TurmaDoProfessor[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!usuario) return;
    listarTurmasDoProfessor(usuario.id)
      .then(setTurmas)
      .catch((e) => setErro(e instanceof Error ? e.message : "Não foi possível carregar suas turmas."));
  }, [usuario]);

  return (
    <div className="min-h-screen bg-background">
      <Cabecalho />
      <div className="mx-auto max-w-4xl p-6">
        <h1 className="mb-6 font-serif text-klass-xl text-text-primary">Minhas turmas</h1>

        {erro && (
          <Aviso variant="danger" className="mb-4">
            {erro}
          </Aviso>
        )}
        {!erro && turmas === null && (
          <p className="text-body-sm text-text-secondary">Carregando...</p>
        )}
        {turmas?.length === 0 && (
          <p className="text-body-sm text-text-secondary">
            Nenhuma turma atribuída a você ainda.
          </p>
        )}

        <div className="flex flex-col gap-3">
          {turmas?.map((turma) => (
            <Card key={turma.id} className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-1">
                <h2 className="text-klass-md text-text-primary">{turma.codigo}</h2>
                <p className="text-label text-text-muted">
                  {turma.trilhaNome} · {turma.periodoInicio} a {turma.periodoFim} ·{" "}
                  {turma.matriculados} aluno(s) matriculado(s)
                </p>
              </div>
              <Link
                to={`/professor/turmas/${turma.id}`}
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
