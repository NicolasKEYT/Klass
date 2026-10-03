import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/Badge";
import { LinkBotao } from "@/components/LinkBotao";
import { Card } from "@/components/Card";
import { EsqueletoCards } from "@/components/Esqueleto";
import { ErroConsulta } from "@/components/ErroConsulta";
import { LinkComPrefetch } from "@/components/LinkComPrefetch";
import { PaginaAutenticada } from "@/components/PaginaAutenticada";
import { Titulo } from "@/components/Titulo";
import { useTurmasDaCoordenacao } from "@/lib/consultas/selecao";
import { plural } from "@/lib/plural";
import { situacaoDaTurma, type TurmaListagem } from "@/lib/selecao";

function hojeISO(): string {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;
}

function CartaoTurma({ turma, aguardandoEncerramento }: { turma: TurmaListagem; aguardandoEncerramento: boolean }) {
  return (
    <Card className="flex items-center justify-between gap-4">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <Titulo nivel="item" as="h2">
            {turma.codigo}
          </Titulo>
          <span className="text-body-sm text-text-secondary">
            {turma.moduloNome} · {turma.trilhaNome}
          </span>
          {turma.pendentes > 0 && (
            <Badge variant="contorno">{plural(turma.pendentes, "pendente", "pendentes")}</Badge>
          )}
          {aguardandoEncerramento && <Badge variant="contorno">Aguardando encerramento</Badge>}
        </div>
        <p className="text-label text-text-muted">
          {turma.professorNome} · {turma.periodoInicio} a {turma.periodoFim} · {turma.matriculados}/
          {turma.vagasTotal} vagas
        </p>
      </div>

      <LinkComPrefetch
        to={`/coordenacao/turmas/${turma.id}`}
        className="text-body-sm font-medium text-primary hover:underline"
      >
        Detalhes
      </LinkComPrefetch>
    </Card>
  );
}

export function Turmas() {
  // Mesma entrada de cache da tabela "Turmas em andamento" do Início.
  const consulta = useTurmasDaCoordenacao();
  const turmas = consulta.data;
  const [mostrarEncerradas, setMostrarEncerradas] = useState(false);

  // Encerradas (período terminado e nenhuma matrícula ativa — ver
  // situacaoDaTurma) ficam recolhidas no fim: são histórico, não trabalho.
  const hoje = hojeISO();
  const comSituacao = (turmas ?? []).map((t) => ({ turma: t, situacao: situacaoDaTurma(t, hoje) }));
  const ativas = comSituacao.filter((t) => t.situacao !== "encerrada");
  const encerradas = comSituacao.filter((t) => t.situacao === "encerrada");

  return (
    <PaginaAutenticada largura="ampla">
        <div className="mb-6 flex items-center justify-between">
          <Titulo>Turmas</Titulo>
          <LinkBotao to="/coordenacao/turmas/nova">Nova turma</LinkBotao>
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
        {turmas && turmas.length > 0 && ativas.length === 0 && (
          <p className="text-body-sm text-text-secondary">Nenhuma turma em andamento.</p>
        )}

        <div className="flex flex-col gap-3">
          {ativas.map(({ turma, situacao }) => (
            <CartaoTurma
              key={turma.id}
              turma={turma}
              aguardandoEncerramento={situacao === "aguardando_encerramento"}
            />
          ))}
        </div>

        {encerradas.length > 0 && (
          <div className="mt-8">
            <button
              type="button"
              onClick={() => setMostrarEncerradas((v) => !v)}
              aria-expanded={mostrarEncerradas}
              aria-controls="turmas-encerradas"
              className="mb-3 flex items-center gap-1.5 text-klass-md font-medium text-text-secondary hover:text-text-primary"
            >
              {mostrarEncerradas ? (
                <ChevronUp className="h-4 w-4" aria-hidden />
              ) : (
                <ChevronDown className="h-4 w-4" aria-hidden />
              )}
              Encerradas ({encerradas.length})
            </button>
            {mostrarEncerradas && (
              <div id="turmas-encerradas" className="flex flex-col gap-3">
                {encerradas.map(({ turma }) => (
                  <CartaoTurma key={turma.id} turma={turma} aguardandoEncerramento={false} />
                ))}
              </div>
            )}
          </div>
        )}
    </PaginaAutenticada>
  );
}
