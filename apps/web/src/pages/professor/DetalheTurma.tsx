import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Aviso } from "@/components/Aviso";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Cabecalho } from "@/components/Cabecalho";
import { Card } from "@/components/Card";
import {
  buscarTurmaDetalhada,
  listarMatriculasDaTurma,
  type MatriculaListagem,
  type TurmaDetalhada,
} from "@/lib/selecao";

// Só leitura nesta fase — lançar nota/presença é o diário de classe, MS4.
export function DetalheTurma() {
  const { id } = useParams<{ id: string }>();
  const [turma, setTurma] = useState<TurmaDetalhada | null | undefined>(undefined);
  const [matriculas, setMatriculas] = useState<MatriculaListagem[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([buscarTurmaDetalhada(id), listarMatriculasDaTurma(id)])
      .then(([dadosTurma, dadosMatriculas]) => {
        setTurma(dadosTurma);
        setMatriculas(dadosMatriculas.filter((m) => m.status === "matriculada"));
      })
      .catch((e) => setErro(e instanceof Error ? e.message : "Não foi possível carregar a turma."));
  }, [id]);

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
        {turma === undefined && !erro && (
          <p className="text-body-sm text-text-secondary">Carregando...</p>
        )}
        {turma === null && <p className="text-body-sm text-text-secondary">Turma não encontrada.</p>}

        {turma && (
          <>
            <Card className="mb-6">
              <h1 className="font-serif text-klass-xl text-text-primary">{turma.codigo}</h1>
              <p className="mt-1 text-body-sm text-text-secondary">
                {turma.moduloNome} · {turma.trilhaNome}
              </p>
              <p className="mt-2 text-label text-text-muted">
                {turma.periodoInicio} a {turma.periodoFim}
              </p>
            </Card>

            <h2 className="mb-3 font-serif text-klass-lg text-text-primary">
              Alunos matriculados ({matriculas.length})
            </h2>
            {matriculas.length === 0 && (
              <p className="text-body-sm text-text-secondary">Nenhum aluno matriculado ainda.</p>
            )}
            <div className="flex flex-col gap-2">
              {matriculas.map((matricula) => (
                <Card key={matricula.id}>
                  <span className="text-body-sm text-text-primary">{matricula.alunoNome}</span>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
