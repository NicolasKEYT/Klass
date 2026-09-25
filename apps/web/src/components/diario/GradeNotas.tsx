import { useEffect, useState, type KeyboardEvent } from "react";
import { Badge } from "@/components/Badge";
import { StatusBadge } from "@/components/StatusBadge";
import { useSincronizacao } from "@/components/IndicadorSincronizacao";
import {
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
}: {
  turmaId: string;
  turma: TurmaDetalhada;
  lancadoPor: string;
  avaliacoes: Avaliacao[];
}) {
  const { notificarSalvando, notificarSalvo, notificarErro } = useSincronizacao();
  const [alunos, setAlunos] = useState<LinhaAluno[]>([]);
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [notasSalvas, setNotasSalvas] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

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
    if (valorTexto.trim() === "") return;
    const valor = Number(valorTexto.replace(",", "."));
    if (Number.isNaN(valor) || valor < 0 || valor > 10) {
      setErro("A nota precisa ser um número entre 0 e 10.");
      setNotas((atual) => ({ ...atual, [k]: notasSalvas[k] ?? "" }));
      return;
    }
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

      {erro && <p className="mb-3 text-body-sm text-danger">{erro}</p>}

      <div className="overflow-x-auto rounded-klass-card border border-border">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border text-label text-text-muted">
              <th className="px-4 py-3 font-medium">Aluno</th>
              {avaliacoes.map((a) => (
                <th key={a.id} className="px-4 py-3 font-medium">
                  {a.titulo}
                  <span className="block font-normal">peso {a.peso}</span>
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
                      <Badge variant="neutral">Em curso</Badge>
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
