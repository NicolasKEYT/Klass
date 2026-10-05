import { useRef, useState, type KeyboardEvent } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { EsqueletoTabela } from "@/components/Esqueleto";
import { ErroConsulta } from "@/components/ErroConsulta";
import { StatusBadge } from "@/components/StatusBadge";
import { chaves } from "@/lib/consultas/chaves";
import { useNotasDaTurma, useProgressos } from "@/lib/consultas/diario";
import { useGravacao } from "@/lib/consultas/gravacao";
import { invalidar } from "@/lib/consultas/invalidar";
import { useMatriculasDaTurma } from "@/lib/consultas/selecao";
import {
  atualizarAvaliacao,
  BloqueioAlunoEncerrado,
  filtrarAlunosDoDiario,
  salvarNotasEmLote,
  type AlunoDoDiario,
  type Avaliacao,
  type NotaLancada,
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
  /**
   * Apaga a avaliação (cascata de notas já é feita pelo banco — ver
   * lib/diario). `podeDesfazer`: sem notas, a tela oferece "Desfazer"
   * (recria igual); com notas, não há como devolvê-las.
   */
  onApagarAvaliacao: (avaliacao: Avaliacao, podeDesfazer: boolean) => Promise<void>;
}) {
  const gravar = useGravacao();
  // Alunos, progresso e notas vêm do cache compartilhado com a tela da
  // turma (já lidos ao abrir a turma): voltar para esta aba não busca nada.
  const consultaMatriculas = useMatriculasDaTurma(turmaId);
  const alunosDoDiario = consultaMatriculas.data ? filtrarAlunosDoDiario(consultaMatriculas.data) : undefined;
  const progressos = useProgressos((alunosDoDiario ?? []).map((a) => a.matriculaId));
  const avaliacaoIds = avaliacoes.map((a) => a.id);
  const consultaNotas = useNotasDaTurma(turmaId, avaliacaoIds);

  const alunos: LinhaAluno[] = (alunosDoDiario ?? []).map((a) => {
    const progresso = progressos.porMatricula.get(a.matriculaId);
    return { ...a, media: progresso?.media ?? null, frequencia: progresso?.frequencia ?? null };
  });
  // Notas gravadas no banco (cache), por célula "avaliacaoId:matriculaId".
  const notasSalvas: Record<string, string> = {};
  const valorSalvo: Record<string, number> = {};
  for (const n of consultaNotas.data ?? []) {
    notasSalvas[chave(n.avaliacaoId, n.matriculaId)] = String(n.valor);
    valorSalvo[chave(n.avaliacaoId, n.matriculaId)] = n.valor;
  }

  // O que o professor digitou e ainda não foi gravado, por célula. Fica
  // num ref (leitura síncrona nos handlers: Esc + blur no mesmo evento)
  // espelhado em estado (para re-renderizar). Célula sem rascunho mostra
  // o valor do cache.
  const rascunhosRef = useRef<Record<string, string>>({});
  const [rascunhos, setRascunhos] = useState<Record<string, string>>({});
  function definirRascunho(k: string, valor: string) {
    rascunhosRef.current = { ...rascunhosRef.current, [k]: valor };
    setRascunhos(rascunhosRef.current);
  }
  function descartarRascunho(k: string) {
    const { [k]: _descartado, ...resto } = rascunhosRef.current;
    rascunhosRef.current = resto;
    setRascunhos(resto);
  }

  const [erro, setErro] = useState<string | null>(null);
  const [confirmandoApagarId, setConfirmandoApagarId] = useState<string | null>(null);
  const [apagando, setApagando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editTitulo, setEditTitulo] = useState("");
  const [editPeso, setEditPeso] = useState(1);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  // Valor em gravação por célula, atualizado de forma síncrona: Enter
  // grava e move o foco, o que dispara o blur da mesma célula logo em
  // seguida — sem isso, a segunda chamada regravava. Cada regravação
  // reescreve lancada_em, dispara o Realtime e gera "Nota publicada"
  // falsa nas Novidades do aluno. Sai daqui quando o cache já tem o valor.
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

  // Sem nota lançada, apagar é direto (o checklist pede sem aviso) e a
  // tela da turma oferece "Desfazer"; com notas, continua a confirmação.
  async function aoClicarApagar(avaliacao: Avaliacao) {
    setErro(null);
    setEditandoId(null);
    if (avaliacaoTemNotas(avaliacao.id)) {
      setConfirmandoApagarId(avaliacao.id);
      return;
    }
    if (apagando) return;
    setApagando(true);
    try {
      await onApagarAvaliacao(avaliacao, true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível apagar a avaliação.");
    } finally {
      setApagando(false);
    }
  }

  function aoClicarEditar(avaliacao: Avaliacao) {
    setErro(null);
    setConfirmandoApagarId(null);
    setEditandoId(avaliacao.id);
    setEditTitulo(avaliacao.titulo);
    setEditPeso(avaliacao.peso);
  }

  async function aoSalvarEdicao(avaliacaoId: string) {
    setErro(null);
    setSalvandoEdicao(true);
    try {
      await gravar(
        () => atualizarAvaliacao(avaliacaoId, { titulo: editTitulo.trim(), peso: editPeso }),
        (qc) => invalidar.avaliacoes(qc, turmaId),
      );
      setEditandoId(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar a avaliação.");
    } finally {
      setSalvandoEdicao(false);
    }
  }

  async function aoConfirmarApagar(avaliacao: Avaliacao) {
    setApagando(true);
    setErro(null);
    try {
      await onApagarAvaliacao(avaliacao, false);
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

  async function salvarCelula(avaliacaoId: string, matriculaId: string) {
    const k = chave(avaliacaoId, matriculaId);
    if (!(k in rascunhosRef.current)) return;
    const texto = rascunhosRef.current[k].trim();
    if (texto === "") return;
    const valor = lerNota(texto);
    if (valor === null) {
      setErro(MENSAGEM_NOTA_INVALIDA);
      descartarRascunho(k);
      return;
    }
    // Sem mudança em relação ao último valor gravado: nada a fazer.
    const emGravacao = k in valoresGravados.current;
    const anterior = emGravacao ? valoresGravados.current[k] : valorSalvo[k];
    if (anterior === valor) {
      if (!emGravacao) descartarRascunho(k);
      return;
    }
    valoresGravados.current[k] = valor;
    setErro(null);
    try {
      await gravar(
        () => salvarNotasEmLote(avaliacaoId, lancadoPor, [{ matriculaId, valor }]),
        async (qc) => {
          // A célula vira o valor gravado direto no cache (sem reler a
          // grade inteira); média/frequência da linha são relidas.
          qc.setQueryData<NotaLancada[]>(chaves.diario.notas(turmaId, avaliacaoIds), (atual) => [
            ...(atual ?? []).filter((n) => !(n.avaliacaoId === avaliacaoId && n.matriculaId === matriculaId)),
            { avaliacaoId, matriculaId, valor },
          ]);
          descartarRascunho(k);
          await invalidar.nota(qc, matriculaId);
        },
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar a nota.");
    } finally {
      // Gravou (o cache já tem o valor) ou falhou (a próxima tentativa
      // compara de novo com o banco).
      delete valoresGravados.current[k];
    }
  }

  function aoTeclar(evento: KeyboardEvent<HTMLInputElement>, avaliacaoId: string, matriculaId: string, indiceLinha: number) {
    if (evento.key === "Enter") {
      evento.preventDefault();
      void salvarCelula(avaliacaoId, matriculaId);
      // Desce para a mesma coluna, próxima linha.
      const proximaLinha = alunos[indiceLinha + 1];
      if (proximaLinha) {
        const proximoInput = document.getElementById(`nota-${avaliacaoId}-${proximaLinha.matriculaId}`);
        proximoInput?.focus();
      }
    } else if (evento.key === "Escape") {
      descartarRascunho(chave(avaliacaoId, matriculaId));
      (evento.target as HTMLInputElement).blur();
    }
  }

  function situacaoDaLinha(aluno: LinhaAluno): "chamada_feita" | "abaixo_da_media" | null {
    if (aluno.status === "concluida" || aluno.status === "reprovada") return null; // usa StatusBadge de matrícula, não de avaliação
    const mediaBaixa = aluno.media !== null && aluno.media < turma.trilhaMediaMinima;
    const freqBaixa = aluno.frequencia !== null && aluno.frequencia < turma.frequenciaMinimaPercentual;
    return mediaBaixa || freqBaixa ? "abaixo_da_media" : null;
  }

  const erroDeLeitura = consultaMatriculas.error ?? progressos.erro ?? consultaNotas.error;
  if (erroDeLeitura && (!alunosDoDiario || !consultaNotas.data)) {
    return (
      <ErroConsulta
        erro={erroDeLeitura}
        padrao="Não foi possível carregar a grade."
        tentarDeNovo={() => {
          if (consultaMatriculas.isError) void consultaMatriculas.refetch();
          if (consultaNotas.isError) void consultaNotas.refetch();
          progressos.tentarDeNovo();
        }}
      />
    );
  }
  if (!alunosDoDiario || progressos.pendente || consultaNotas.isPending) {
    return <EsqueletoTabela linhas={Math.max(alunosDoDiario?.length ?? 3, 1)} colunas={avaliacoes.length + 4} />;
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

      {editandoId &&
        (() => {
          const alvo = avaliacoes.find((a) => a.id === editandoId);
          if (!alvo) return null;
          const pesoValido = Number.isFinite(editPeso) && editPeso > 0;
          return (
            <Card className="mb-3">
              <form
                className="flex flex-col gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void aoSalvarEdicao(alvo.id);
                }}
              >
                <p className="text-body-sm font-medium text-text-primary">Editar avaliação</p>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <label className="flex flex-1 flex-col gap-1.5">
                    <span className="text-label font-medium text-text-secondary">Título</span>
                    <Input required minLength={2} value={editTitulo} onChange={(e) => setEditTitulo(e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1.5 sm:w-32">
                    <span className="text-label font-medium text-text-secondary">Peso</span>
                    <Input
                      type="number"
                      min={1}
                      required
                      value={editPeso}
                      onChange={(e) => setEditPeso(Number(e.target.value))}
                    />
                  </label>
                </div>
                {pesoValido && (
                  <p className="text-label text-text-muted">
                    Com este peso, ela passa a valer{" "}
                    {percentualDoPeso(editPeso, somaPesos - alvo.peso + editPeso)}% da média final.
                  </p>
                )}
                <div className="flex gap-2">
                  <Button type="submit" disabled={salvandoEdicao || !pesoValido}>
                    {salvandoEdicao ? "Salvando..." : "Salvar"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={salvandoEdicao}
                    onClick={() => setEditandoId(null)}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </Card>
          );
        })()}

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
                <Button disabled={apagando} onClick={() => void aoConfirmarApagar(alvo)}>
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
                      aria-label={`Editar avaliação ${a.titulo}`}
                      title="Editar avaliação"
                      onClick={() => aoClicarEditar(a)}
                      className="text-text-muted transition hover:text-text-primary"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      aria-label={`Apagar avaliação ${a.titulo}`}
                      title="Apagar avaliação"
                      disabled={apagando}
                      onClick={() => void aoClicarApagar(a)}
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
                          value={rascunhos[k] ?? notasSalvas[k] ?? ""}
                          onChange={(e) => definirRascunho(k, e.target.value)}
                          onBlur={() => void salvarCelula(avaliacao.id, aluno.matriculaId)}
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
