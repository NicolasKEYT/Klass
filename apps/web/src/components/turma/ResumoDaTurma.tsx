import { TriangleAlert } from "lucide-react";
import { Card } from "@/components/Card";
import { EsqueletoCards } from "@/components/Esqueleto";
import { LinkBotao } from "@/components/LinkBotao";
import { Titulo } from "@/components/Titulo";
import {
  useAulasDaTurma,
  useAvaliacoesDaTurma,
  useChamadasPendentesDaTurma,
  useNotasDaTurma,
  useProgressoDaTurma,
} from "@/lib/consultas/diario";
import { avaliacoesSemNota } from "@/lib/diario";
import { useMatriculasDaTurma } from "@/lib/consultas/selecao";
import {
  formatarData,
  formatarDiaSemanaData,
  formatarHora,
  formatarMedia,
  formatarPercentual,
  formatarPeriodo,
} from "@/lib/formato";
import { plural } from "@/lib/plural";
import { codigoComTurno, type TurmaDetalhada } from "@/lib/selecao";

// Aba "Resumo" da turma (UI Kit, págs. 9 e 11 mostram a aba sem conteúdo
// definido; o conteúdo segue o que as duas telas já resumem em outros
// lugares). É a aba padrão do detalhe da turma, para professor e
// coordenação. Tudo vem do cache que as outras abas já usam — progresso em
// lote, aulas, avaliações, notas e matrículas —, mais as chamadas pendentes
// da turma (uma RPC).
export function ResumoDaTurma({
  turma,
  papel,
}: {
  turma: TurmaDetalhada;
  papel: "professor" | "coordenacao";
}) {
  const consultaMatriculas = useMatriculasDaTurma(turma.id);
  const consultaAulas = useAulasDaTurma(turma.id);
  const consultaAvaliacoes = useAvaliacoesDaTurma(turma.id);
  const avaliacoes = consultaAvaliacoes.data ?? [];
  const consultaNotas = useNotasDaTurma(turma.id, avaliacoes.map((a) => a.id));
  const progressos = useProgressoDaTurma(turma.id);
  const consultaChamadas = useChamadasPendentesDaTurma(turma.id);

  const carregando =
    consultaMatriculas.isPending || consultaAulas.isPending || consultaAvaliacoes.isPending || progressos.pendente;
  if (carregando) return <EsqueletoCards quantidade={3} altura="h-24" />;

  const base = `/${papel}/turmas/${turma.id}`;
  const ativos = (consultaMatriculas.data ?? []).filter((m) => m.status === "matriculada");

  // Médias da turma: média simples dos alunos cursando que já têm valor.
  const media = (valores: Array<number | null | undefined>) => {
    const ok = valores.filter((v): v is number => v !== null && v !== undefined);
    return ok.length ? ok.reduce((s, v) => s + v, 0) / ok.length : null;
  };
  const mediaTurma = media(ativos.map((m) => progressos.porMatricula.get(m.id)?.media));
  const frequenciaTurma = media(ativos.map((m) => progressos.porMatricula.get(m.id)?.frequencia));

  // Próximas aulas: de hoje em diante (data local), as três primeiras.
  const hoje = new Date().toLocaleDateString("sv-SE");
  const proximas = (consultaAulas.data ?? []).filter((a) => a.data >= hoje).slice(0, 3);

  // Pendências: avaliação sem nota para aluno cursando e chamadas atrasadas.
  const semNota = avaliacoesSemNota(avaliacoes, consultaNotas.data ?? [], ativos.map((m) => m.id));
  const chamadas = consultaChamadas.data ?? [];
  const foraDoPrazo = chamadas.filter((c) => c.situacao === "encerrada");
  const noPrazo = chamadas.filter((c) => c.situacao !== "encerrada");

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador rotulo="Ocupação" valor={`${ativos.length}/${turma.vagasTotal}`} detalhe="alunos cursando / vagas" />
        <Indicador
          rotulo="Média da turma"
          valor={mediaTurma !== null ? formatarMedia(mediaTurma) : "—"}
          detalhe={`mínima da trilha ${formatarMedia(turma.trilhaMediaMinima)}`}
        />
        <Indicador
          rotulo="Frequência média"
          valor={frequenciaTurma !== null ? formatarPercentual(frequenciaTurma) : "—"}
          detalhe={`mínima da turma ${formatarPercentual(turma.frequenciaMinimaPercentual)}`}
        />
        <Indicador
          rotulo="Aulas"
          valor={String(consultaAulas.data?.length ?? 0)}
          detalhe={plural(avaliacoes.length, "avaliação", "avaliações")}
        />
      </div>

      <Card>
        <Titulo nivel="item" as="h2" className="mb-3">
          Turma
        </Titulo>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Dado rotulo="Turma" valor={codigoComTurno(turma.codigo, turma.turno)} />
          <Dado rotulo="Período" valor={formatarPeriodo(turma.periodoInicio, turma.periodoFim)} />
          <Dado rotulo="Módulo" valor={turma.moduloNome} />
          <Dado rotulo="Trilha" valor={turma.trilhaNome} />
          <Dado rotulo="Professor" valor={turma.professorNome} />
        </dl>
      </Card>

      <Card>
        <Titulo nivel="item" as="h2" className="mb-3">
          Pendências da turma
        </Titulo>
        {consultaChamadas.isError && (
          <p className="mb-2 text-body-sm text-text-secondary">Não foi possível conferir as chamadas pendentes.</p>
        )}
        {semNota.length === 0 && chamadas.length === 0 && !consultaChamadas.isPending && (
          <p className="text-body-sm text-text-secondary">Nada pendente: notas lançadas e chamadas em dia.</p>
        )}
        <ul className="flex flex-col divide-y divide-border">
          {semNota.map(({ avaliacao, faltam }) => (
            <Pendencia
              key={avaliacao.id}
              texto={`${avaliacao.titulo} sem nota para ${plural(faltam, "aluno", "alunos")}`}
              acao={papel === "professor" ? { rotulo: "Lançar notas", para: `${base}?aba=avaliacoes` } : { rotulo: "Ver avaliações", para: `${base}?aba=avaliacoes` }}
            />
          ))}
          {noPrazo.map((c) => (
            <Pendencia
              key={c.aulaId}
              texto={`Chamada de ${formatarData(c.data)} não feita (prazo até ${formatarData(c.abertaAte)})`}
              acao={
                papel === "professor"
                  ? { rotulo: "Fazer chamada", para: `${base}/aulas/${c.aulaId}/chamada` }
                  : { rotulo: "Ver aulas", para: `${base}?aba=aulas` }
              }
            />
          ))}
          {foraDoPrazo.map((c) => (
            <Pendencia
              key={c.aulaId}
              texto={
                papel === "professor"
                  ? `Chamada de ${formatarData(c.data)} fora do prazo: peça liberação à coordenação`
                  : `Chamada de ${formatarData(c.data)} fora do prazo do professor`
              }
              acao={papel === "coordenacao" ? { rotulo: "Liberar chamada", para: `${base}?aba=aulas` } : { rotulo: "Ver aulas", para: `${base}?aba=aulas` }}
            />
          ))}
        </ul>
      </Card>

      <Card>
        <Titulo nivel="item" as="h2" className="mb-3">
          Próximas aulas
        </Titulo>
        {proximas.length === 0 ? (
          <p className="text-body-sm text-text-secondary">Nenhuma aula marcada daqui em diante.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {proximas.map((a) => (
              <li key={a.id} className="text-body-sm text-text-primary">
                {formatarDiaSemanaData(a.data, true)}
                {a.horario ? ` · ${formatarHora(a.horario)}` : ""}
                {a.sala ? ` · ${a.sala}` : ""}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Indicador({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe: string }) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-label text-text-secondary">{rotulo}</span>
      <span className="font-mono text-klass-2xl font-semibold tabular-nums text-text-primary">{valor}</span>
      <span className="text-label text-text-muted">{detalhe}</span>
    </Card>
  );
}

function Dado({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-label text-text-muted">{rotulo}</dt>
      <dd className="text-body-sm text-text-primary">{valor}</dd>
    </div>
  );
}

function Pendencia({ texto, acao }: { texto: string; acao: { rotulo: string; para: string } }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
      <span className="flex min-w-0 items-start gap-2 text-body-sm text-text-primary">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        {texto}
      </span>
      <LinkBotao variant="secondary" to={acao.para}>
        {acao.rotulo}
      </LinkBotao>
    </li>
  );
}
