import { useAuth } from "@/auth";
import { Card } from "@/components/Card";
import { EsqueletoCards } from "@/components/Esqueleto";
import { ErroConsulta } from "@/components/ErroConsulta";
import { LinkComPrefetch } from "@/components/LinkComPrefetch";
import { PaginaAutenticada } from "@/components/PaginaAutenticada";
import { Titulo } from "@/components/Titulo";
import { useTurmasDoProfessor } from "@/lib/consultas/selecao";
import { plural } from "@/lib/plural";

export function Turmas() {
  // Mesma entrada de cache do "Hoje": vindo de lá, a lista já está pronta.
  const { usuario } = useAuth();
  const consulta = useTurmasDoProfessor(usuario?.id);
  const turmas = consulta.data;

  return (
    <PaginaAutenticada>
        <Titulo className="mb-6">Minhas turmas</Titulo>

        {consulta.isError && !turmas && (
          <ErroConsulta
            className="mb-4"
            erro={consulta.error}
            padrao="Não foi possível carregar suas turmas."
            tentarDeNovo={() => void consulta.refetch()}
          />
        )}
        {consulta.isPending && <EsqueletoCards quantidade={3} altura="h-24" />}
        {turmas?.length === 0 && (
          <p className="text-body-sm text-text-secondary">
            Nenhuma turma atribuída a você ainda.
          </p>
        )}

        <div className="flex flex-col gap-3">
          {turmas?.map((turma) => (
            <Card key={turma.id} className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-1">
                <Titulo nivel="item" as="h2">
                  {turma.codigo}
                </Titulo>
                <p className="text-label text-text-muted">
                  {turma.moduloNome} · {turma.trilhaNome} · {turma.periodoInicio} a{" "}
                  {turma.periodoFim} · {plural(turma.matriculados, "aluno matriculado", "alunos matriculados")}
                </p>
              </div>
              <LinkComPrefetch
                to={`/professor/turmas/${turma.id}`}
                className="text-body-sm font-medium text-primary hover:underline"
              >
                Detalhes
              </LinkComPrefetch>
            </Card>
          ))}
        </div>
    </PaginaAutenticada>
  );
}
