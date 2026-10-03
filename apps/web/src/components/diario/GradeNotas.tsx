import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Trash2 } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { StatusBadge } from "@/components/StatusBadge";
import { useSincronizacao } from "@/components/IndicadorSincronizacao";
import {
  BloqueioAlunoEncerrado,
  buscarNotasDaAvaliacao,
  buscarProgressoMatricula,
  listarAlunosDoDiario,
  salvarNotasEmLote,
  type AlunoDoDiario,
  type Avaliacao,
} from "@/lib/diario";
import type { TurmaDetalhada } from "@/lib/selecao";

interface LinhaAluno extends AlunoDoDiario {
  media: number | null;
  frequencia: number | null;
}

function chave(avaliacaoId: string, matriculaId: string): string {
  return `${avaliacaoId}:${matriculaId}`;
}

const MENSAGEM_NOTA_INVALIDA =
  "A nota precisa ser um número entre 0 e 10, com no máximo uma vírgula ou ponto decimal (ex.: 7,5).";

// Antes, Number() aceitava "1.000" como 1 (ponto lido como decimal) e
// outras formas soltas. Agora só dígitos com no máximo um separador e
// até duas casas — o que notas.valor (numeric(4,2)) guarda sem arredondar.
function lerNota(texto: string): number | null {
  if (!/^\d+([.,]\d{1,2})?$/.test(texto)) return null;
  const valor = Number(texto.replace(",", "."));
  return valor >= 0 && valor <= 10 ? valor : null;
}

// O peso é relativo: o percentual de cada avaliação é o peso dela sobre a
// soma de todos, e muda quando outra avaliação é criada.
function percentualDoPeso(peso: number, somaPesos: number): number {
  return somaPesos > 0 ? Math.round((peso / somaPesos) * 100) : 0;
}

// D6 (klass-uikit.pdf) — grade de avaliações e notas: alunos nas linhas,
// avaliações nas colunas, célula editável. Enter salva e desce (próxima
// linha, mesma coluna); Tab vai para a próxima avaliação — isso já
// acontece de graça pela ordem do DOM (cada linha renderiza as células
// da avaliação em sequência), sem JS extra; Esc desfaz a edição da
// célula. D7 (publicar/não publicar nota) fica de fora por decisão do
// próprio kit — nota lançada aparece pro aluno na hora, via Realtime.
export function GradeNotas({
  turmaId,
  turma,
  lancadoPor,
  avaliacoes,
  onApagarAvaliacao,
}: {
  turmaId: string;
  turma: TurmaDetalhada;
  lancadoPor: string;
  avaliacoes: Avaliacao[];
  /** Apaga a avaliação (cascata de notas já é feita pelo banco — ver lib/diario). */
  onApagarAvaliacao: (avaliacaoId: string) => Promise<void>;
}) {
  const { notificarSalvando, notificarSalvo, notificarErro } = useSincronizacao();
  const [alunos, setAlunos] = useState<LinhaAluno[]>([]);
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [notasSalvas, setNotasSalvas] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmandoApagarId, setConfirmandoApagarId] = useState<string | null>(null);
  const [apagando, setApagando] = useState(false);
  // Último valor gravado (ou em gravação) por célula, atualizado de forma
  // síncrona: Enter grava e move o foco, o que dispara o blur da mesma
  // célula logo em seguida — com só o estado (assíncrono), a segunda
  // chamada ainda via o valor antigo e regravava. Cada regravação
  // reescreve lancada_em, dispara o Realtime e gera "Nota publicada"
  // falsa nas Novidades do aluno.
  const valoresGravados = useRef<Record<string, number>>({});
  const somaPesos = avaliacoes.reduce((soma, a) => soma + a.peso, 0);

  // Já tem nota lançada pra algum aluno? Decide o texto de aviso na
  // confirmação — sem precisar de outra consulta, notasSalvas já tem
  // essa informação (chave é "avaliacaoId:matriculaId").
  function avaliacaoTemNotas(avaliacaoId: string): boolean {
    return Object.keys(notasSalvas).some((k) => k.startsWith(`${avaliacaoId}:`));
  }

  // Alunos já encerrados (concluída/reprovada) com nota nesta avaliação:
  // o trigger do banco impede apagar essas notas, então a avaliação
  // inteira não pode ser apagada — a grade já sabe disso antes de tentar.
  function encerradosComNota(avaliacaoId: string): string[] {
    return alunos
      .filter(
        (a) =>
          (a.status === "concluida" || a.status === "reprovada") &&
          notasSalvas[chave(avaliacaoId, a.matriculaId)] !== undefined,
      )
      .map((a) => a.alunoNome);
  }

  async function aoConfirmarApagar(avaliacaoId: string) {
    setApagando(true);
    setErro(null);
    try {
      await onApagarAvaliacao(avaliacaoId);
      setConfirmandoApagarId(null);
    } catch (e) {
      // Bloqueio do banco: fecha o diálogo (ele dizia que as notas "serão
      // perdidas", o que não aconteceu) e explica o que fazer.
      if (e instanceof BloqueioAlunoEncerrado) setConfirmandoApagarId(null);
      setErro(e instanceof Error ? e.message : "Não foi possível apagar a avaliação.");
    } finally {
      setApagando(false);
    }
  }

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      setCarregando(true);
      try {
        const listaAlunos = await listarAlunosDoDiario(turmaId);
        const progressos = await Promise.all(
          listaAlunos.map((a) => buscarProgressoMatricula(a.matriculaId)),
        );
        const notasPorAvaliacao = await Promise.all(
          avaliacoes.map((a) => buscarNotasDaAvaliacao(a.id)),
        );
        if (!ativo) return;

        const mapaNotas: Record<string, string> = {};
        avaliacoes.forEach((avaliacao, i) => {
          for (const [matriculaId, valor] of notasPorAvaliacao[i]) {
            mapaNotas[chave(avaliacao.id, matriculaId)] = String(valor);
          }
        });
        setNotas(mapaNotas);
        setNotasSalvas(mapaNotas);
        valoresGravados.current = Object.fromEntries(
          Object.entries(mapaNotas).map(([k, v]) => [k, Number(v)]),
        );
        setAlunos(listaAlunos.map((a, i) => ({ ...a, media: progressos[i].media, frequencia: progressos[i].frequencia })));
      } catch (e) {
        if (ativo) setErro(e instanceof Error ? e.message : "Não foi possível carregar a grade.");
      } finally {
        if (ativo) setCarregando(false);
      }
    }
    void carregar();
    return () => {
      ativo = false;
    };
  }, [turmaId, avaliacoes]);

  async function salvarCelula(avaliacaoId: string, matriculaId: string, valorTexto: string) {
    const k = chave(avaliacaoId, matriculaId);
    const texto = valorTexto.trim();
    if (texto === "") return;
    const valor = lerNota(texto);
    if (valor === null) {
      setErro(MENSAGEM_NOTA_INVALIDA);
      setNotas((atual) => ({ ...atual, [k]: notasSalvas[k] ?? "" }));
      return;
    }
    // Sem mudança em relação ao último valor gravado: nada a fazer.
    const anterior = valoresGravados.current[k];
    if (anterior === valor) return;
    valoresGravados.current[k] = valor;
    setErro(null);
    notificarSalvando();
    try {
      await salvarNotasEmLote(avaliacaoId, lancadoPor, [{ matriculaId, valor }]);
      setNotasSalvas((atual) => ({ ...atual, [k]: String(valor) }));
      notificarSalvo();
      // Recalcula média/frequência da linha afetada sem recarregar a grade inteira.
      const aluno = alunos.find((a) => a.matriculaId === matriculaId);
      if (aluno) {
        const progresso = await buscarProgressoMatricula(matriculaId);
        setAlunos((atual) =>
          atual.map((a) => (a.matriculaId === matriculaId ? { ...a, media: progresso.media, frequencia: progresso.frequencia } : a)),
        );
      }
    } catch (e) {
      // Não gravou: volta a referência para a próxima tentativa gravar de novo.
      if (anterior === undefined) delete valoresGravados.current[k];
      else valoresGravados.current[k] = anterior;
      setErro(e instanceof Error ? e.message : "Não foi possível salvar a nota.");
      notificarErro();
    }
  }

  function aoTeclar(evento: KeyboardEvent<HTMLInputElement>, avaliacaoId: string, matriculaId: string, indiceLinha: number) {
    if (evento.key === "Enter") {
      evento.preventDefault();
      void salvarCelula(avaliacaoId, matriculaId, notas[chave(avaliacaoId, matriculaId)] ?? "");
      // Desce para a mesma coluna, próxima linha.
      const proximaLinha = alunos[indiceLinha + 1];
      if (proximaLinha) {
        const proximoInput = document.getElementById(`nota-${avaliacaoId}-${proximaLinha.matriculaId}`);
        proximoInput?.focus();
      }
    } else if (evento.key === "Escape") {
      const k = chave(avaliacaoId, matriculaId);
      setNotas((atual) => ({ ...atual, [k]: notasSalvas[k] ?? "" }));
      (evento.target as HTMLInputElement).blur();
    }
  }

  function situacaoDaLinha(aluno: LinhaAluno): "chamada_feita" | "abaixo_da_media" | null {
    if (aluno.status === "concluida" || aluno.status === "reprovada") return null; // usa StatusBadge de matrícula, não de avaliação
    const mediaBaixa = aluno.media !== null && aluno.media < turma.trilhaMediaMinima;
    const freqBaixa = aluno.frequencia !== null && aluno.frequencia < turma.frequenciaMinimaPercentual;
    return mediaBaixa || freqBaixa ? "abaixo_da_media" : null;
  }

  if (carregando) {
    return <p className="text-body-sm text-text-secondary">Carregando...</p>;
  }

  return (
    <div>
      {/* Toolbar: informação read-only — média/frequência mínima são
          definidas na trilha/turma (outro prompt), não editáveis aqui. */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge variant="neutral">Média mínima {turma.trilhaMediaMinima.toFixed(1)}</Badge>
        <Badge variant="neutral">Frequência mínima {turma.frequenciaMinimaPercentual}%</Badge>
        <Badge variant="neutral">Cálculo por média ponderada</Badge>
      </div>

      {erro && (
        <Aviso variant="danger" className="mb-3">
          {erro}
        </Aviso>
      )}

      {confirmandoApagarId &&
        (() => {
          const alvo = avaliacoes.find((a) => a.id === confirmandoApagarId);
          if (!alvo) return null;
          const temNotas = avaliacaoTemNotas(alvo.id);
          const encerrados = encerradosComNota(alvo.id);
          if (encerrados.length > 0) {
            return (
              <Card className="mb-3 flex flex-col gap-3">
                <p className="text-body-sm text-text-primary">
                  A avaliação <strong>{alvo.titulo}</strong> não pode ser apagada: tem nota de{" "}
                  {encerrados.length === 1 ? "um aluno já encerrado" : "alunos já encerrados"} (
                  {encerrados.join(", ")}). O histórico de quem já foi aprovado ou reprovado não
                  muda. Para apagá-la, peça à coordenação para desfazer o encerramento{" "}
                  {encerrados.length === 1 ? "desse aluno" : "desses alunos"}.
                </p>
                <Button variant="secondary" className="self-start" onClick={() => setConfirmandoApagarId(null)}>
                  Fechar
                </Button>
              </Card>
            );
          }
          return (
            <Card className="mb-3 flex flex-col gap-3">
              <p className="text-body-sm text-text-primary">
                Apagar a avaliação <strong>{alvo.titulo}</strong>?
                {temNotas && (
                  <>
                    {" "}
                    <span className="font-medium text-danger">
                      As notas já lançadas para ela serão perdidas.
                    </span>
                  </>
                )}
              </p>
              <div className="flex gap-2">
                <Button disabled={apagando} onClick={() => void aoConfirmarApagar(alvo.id)}>
                  {apagando ? "Apagando..." : "Apagar avaliação"}
                </Button>
                <Button
                  variant="secondary"
                  disabled={apagando}
                  onClick={() => setConfirmandoApagarId(null)}
                >
                  Cancelar
                </Button>
              </div>
            </Card>
          );
        })()}

      <div className="overflow-x-auto rounded-klass-card border border-border">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border text-label text-text-muted">
              <th className="px-4 py-3 font-medium">Aluno</th>
              {avaliacoes.map((a) => (
                <th key={a.id} className="px-4 py-3 font-medium">
                  <div className="flex items-center gap-1.5">
                    {a.titulo}
                    <button
                      type="button"
                      aria-label={`Apagar avaliação ${a.titulo}`}
                      title="Apagar avaliação"
                      onClick={() => setConfirmandoApagarId(a.id)}
                      className="text-text-muted transition hover:text-danger"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                  <span className="block font-normal">
                    peso {a.peso} · {percentualDoPeso(a.peso, somaPesos)}%
                  </span>
                </th>
              ))}
              <th className="px-4 py-3 font-medium">Média</th>
              <th className="px-4 py-3 font-medium">Freq.</th>
              <th className="px-4 py-3 font-medium">Situação</th>
            </tr>
          </thead>
          <tbody>
            {alunos.length === 0 && (
              <tr>
                <td className="px-4 py-3 text-body-sm text-text-secondary" colSpan={avaliacoes.length + 4}>
                  Nenhum aluno matriculado nesta turma ainda.
                </td>
              </tr>
            )}
            {alunos.map((aluno, indiceLinha) => {
              const situacaoAvaliacao = situacaoDaLinha(aluno);
              return (
                // D2 — linha de tabela no desktop: 52px de altura.
                <tr key={aluno.matriculaId} className="h-[52px] border-b border-border last:border-b-0">
                  <td className="px-4 py-3 text-body-sm text-text-primary">{aluno.alunoNome}</td>
                  {avaliacoes.map((avaliacao) => {
                    const k = chave(avaliacao.id, aluno.matriculaId);
                    const podeEditar = aluno.status === "matriculada";
                    return (
                      <td key={avaliacao.id} className="px-2 py-2">
                        <input
                          id={`nota-${avaliacao.id}-${aluno.matriculaId}`}
                          type="text"
                          inputMode="decimal"
                          disabled={!podeEditar}
                          className="h-10 w-20 rounded-klass-control border border-border bg-surface px-2 text-center font-mono text-body-sm tabular-nums text-text-primary transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-neutral-subtle disabled:text-text-muted"
                          value={notas[k] ?? ""}
                          onChange={(e) => setNotas((atual) => ({ ...atual, [k]: e.target.value }))}
                          onBlur={(e) => void salvarCelula(avaliacao.id, aluno.matriculaId, e.target.value)}
                          onKeyDown={(e) => aoTeclar(e, avaliacao.id, aluno.matriculaId, indiceLinha)}
                        />
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 font-mono text-body-sm font-medium tabular-nums text-text-primary">
                    {aluno.media !== null ? aluno.media.toFixed(1) : "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-body-sm tabular-nums text-text-secondary">
                    {aluno.frequencia !== null ? `${aluno.frequencia.toFixed(0)}%` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {aluno.status === "concluida" || aluno.status === "reprovada" ? (
                      <StatusBadge tipo="matricula" status={aluno.status} />
                    ) : situacaoAvaliacao ? (
                      <StatusBadge tipo="avaliacao" status={situacaoAvaliacao} />
                    ) : (
                      // "Em curso" é texto simples, sem badge — só os
                      // estados que pedem atenção viram pílula (medido por
                      // pixel na grade de referência, Prompt 17).
                      <span className="text-body-sm text-text-secondary">Em curso</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-label text-text-muted">
        Enter salva e desce · Esc desfaz a edição da célula · Tab vai para a próxima avaliação
      </p>
    </div>
  );
}
