import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EsqueletoCards } from "@/components/Esqueleto";
import { ErroConsulta } from "@/components/ErroConsulta";
import { LinkComPrefetch } from "@/components/LinkComPrefetch";
import { PaginaAutenticada } from "@/components/PaginaAutenticada";
import { Titulo } from "@/components/Titulo";
import { useTurmasDaCoordenacao } from "@/lib/consultas/selecao";

export function Turmas() {
  // Mesma entrada de cache da tabela "Turmas em andamento" do Início.
  const consulta = useTurmasDaCoordenacao();
  const turmas = consulta.data;

  return (
    <PaginaAutenticada largura="ampla">
        <div className="mb-6 flex items-center justify-between">
          <Titulo>Turmas</Titulo>
          <LinkComPrefetch to="/coordenacao/turmas/nova">
            <Button>Nova turma</Button>
          </LinkComPrefetch>
        </div>

        {consulta.isError && !turmas && (
          <ErroConsulta
            className="mb-4"
            erro={consulta.error}
            padrao="Não foi possível carregar as turmas."
            tentarDeNovo={() => void consulta.refetch()}
          />
        )}
        {consulta.isPending && <EsqueletoCards quantidade={4} altura="h-24" />}
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

              <LinkComPrefetch
                to={`/coordenacao/turmas/${turma.id}`}
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
