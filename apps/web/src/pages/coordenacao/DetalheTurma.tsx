import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Aviso } from "@/components/Aviso";
import { Badge } from "@/components/Badge";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { PaginaAutenticada } from "@/components/PaginaAutenticada";
import { Titulo } from "@/components/Titulo";
import { useAuth } from "@/auth";
import {
  buscarProgressoMatricula,
  desfazerEncerramento,
  listarAlunosDoDiario,
  listarAulasDaTurma,
  listarAvaliacoesDaTurma,
  reativarTurma,
  type AlunoDoDiario,
  type Aula,
  type Avaliacao,
  type ProgressoMatricula,
} from "@/lib/diario";
import {
  aprovarMatricula,
  buscarTurmaDetalhada,
  listarMatriculasDaTurma,
  rejeitarMatricula,
  removerAlunoDaTurma,
  type MatriculaListagem,
  type TurmaDetalhada,
} from "@/lib/selecao";

const STATUS_LABEL: Record<string, string> = {
  inscrita: "Inscrita",
  matriculada: "Matriculada",
  rejeitada: "Rejeitada",
  cancelada: "Cancelada",
  concluida: "Aprovado(a)",
  reprovada: "Reprovado(a)",
};

interface AlunoComProgresso extends AlunoDoDiario {
  progresso: ProgressoMatricula;
}

export function DetalheTurma() {
  const { id } = useParams<{ id: string }>();
  const { usuario } = useAuth();
  const [turma, setTurma] = useState<TurmaDetalhada | null | undefined>(undefined);
  const [matriculas, setMatriculas] = useState<MatriculaListagem[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [rejeitandoId, setRejeitandoId] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
  const [aulas, setAulas] = useState<Aula[]>([]);
  const [alunosDiario, setAlunosDiario] = useState<AlunoComProgresso[]>([]);
  const [desfazendoId, setDesfazendoId] = useState<string | null>(null);
  const [removendoId, setRemovendoId] = useState<string | null>(null);
  const [motivoRemocao, setMotivoRemocao] = useState("");
  // Trava enquanto uma ação (aprovar/rejeitar/remover/desfazer) está no
  // ar. Sem ela, o botão seguia clicável durante o round-trip + recarga e
  // um segundo clique de reflexo disparava a ação de novo — aprovar duas
  // vezes, por exemplo.
  const [processando, setProcessando] = useState(false);
  const [confirmandoReativarTurma, setConfirmandoReativarTurma] = useState(false);
  const [reativandoTurma, setReativandoTurma] = useState(false);
  const [reativadas, setReativadas] = useState<number | null>(null);

  async function carregar() {
    if (!id) return;
    try {
      const [dadosTurma, dadosMatriculas, listaAvaliacoes, listaAulas, listaAlunosDiario] =
        await Promise.all([
          buscarTurmaDetalhada(id),
          listarMatriculasDaTurma(id),
          listarAvaliacoesDaTurma(id),
          listarAulasDaTurma(id),
          listarAlunosDoDiario(id),
        ]);
      setTurma(dadosTurma);
      setMatriculas(dadosMatriculas);
      setAvaliacoes(listaAvaliacoes);
      setAulas(listaAulas);

      const progressos = await Promise.all(
        listaAlunosDiario.map((a) => buscarProgressoMatricula(a.matriculaId)),
      );
      setAlunosDiario(listaAlunosDiario.map((a, i) => ({ ...a, progresso: progressos[i] })));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar a turma.");
    }
  }

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function aoAprovar(matriculaId: string) {
    if (!usuario || processando) return;
    setErro(null);
    setMensagem(null);
    setProcessando(true);
    try {
      await aprovarMatricula(matriculaId, usuario.id);
      setMensagem("Matrícula aprovada — o aluno recebe um e-mail de confirmação.");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível aprovar a matrícula.");
    } finally {
      setProcessando(false);
    }
  }

  async function aoConfirmarRejeicao(matriculaId: string) {
    if (!usuario || processando) return;
    setErro(null);
    setMensagem(null);
    setProcessando(true);
    try {
      await rejeitarMatricula(matriculaId, usuario.id, motivo);
      setMensagem("Matrícula rejeitada.");
      setRejeitandoId(null);
      setMotivo("");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível rejeitar a matrícula.");
    } finally {
      setProcessando(false);
    }
  }

  async function aoDesfazer(matriculaId: string) {
    if (processando) return;
    setErro(null);
    setMensagem(null);
    setProcessando(true);
    try {
      await desfazerEncerramento(matriculaId);
      setMensagem("Encerramento desfeito — a matrícula voltou a 'matriculada'.");
      setDesfazendoId(null);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível desfazer o encerramento.");
    } finally {
      setProcessando(false);
    }
  }

  async function aoRemover(matriculaId: string) {
    if (processando) return;
    setErro(null);
    setMensagem(null);
    setProcessando(true);
    try {
      await removerAlunoDaTurma(matriculaId, motivoRemocao);
      setMensagem("Aluno removido da turma. Ele vê o motivo nas próprias matrículas.");
      setRemovendoId(null);
      setMotivoRemocao("");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível remover o aluno.");
    } finally {
      setProcessando(false);
    }
  }

  async function aoReativarTurma() {
    if (!id) return;
    setErro(null);
    setMensagem(null);
    setReativandoTurma(true);
    try {
      const resumo = await reativarTurma(id);
      setReativadas(resumo.reativadas);
      setConfirmandoReativarTurma(false);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível reativar a turma.");
    } finally {
      setReativandoTurma(false);
    }
  }

  const pendentes = matriculas.filter((m) => m.status === "inscrita");
  const matriculados = matriculas.filter((m) => m.status === "matriculada");
  const historico = matriculas.filter((m) =>
    ["rejeitada", "cancelada", "concluida", "reprovada"].includes(m.status),
  );
  // Reativar turma só faz sentido quando há matrícula encerrada (concluída
  // ou reprovada) — rejeitada/cancelada não voltam por aqui.
  const temEncerradas = matriculas.some(
    (m) => m.status === "concluida" || m.status === "reprovada",
  );

  return (
    <PaginaAutenticada>
        <BotaoVoltar />

        {erro && (
          <Aviso variant="danger" className="mb-4">
            {erro}
          </Aviso>
        )}
        {mensagem && (
          <Aviso variant="success" className="mb-4">
            {mensagem}
          </Aviso>
        )}

        {turma === undefined && !erro && (
          <p className="text-body-sm text-text-secondary">Carregando...</p>
        )}
        {turma === null && (
          <p className="text-body-sm text-text-secondary">Turma não encontrada.</p>
        )}

        {turma && (
          <>
            <Card className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div>
                <Titulo>{turma.codigo}</Titulo>
                <p className="mt-1 text-body-sm text-text-secondary">
                  {turma.moduloNome} · {turma.trilhaNome}
                </p>
                <p className="mt-2 text-label text-text-muted">
                  {turma.professorNome} · {turma.periodoInicio} a {turma.periodoFim} ·{" "}
                  {turma.vagasTotal} vagas · frequência mínima {turma.frequenciaMinimaPercentual}%
                </p>
              </div>
              <Link to={`/coordenacao/turmas/${turma.id}/editar`}>
                <Button variant="secondary" className="whitespace-nowrap">
                  Editar turma
                </Button>
              </Link>
            </Card>

            <Titulo nivel="secao" className="mb-3">
              Inscrições pendentes ({pendentes.length})
            </Titulo>
            <div className="mb-6 flex flex-col gap-3">
              {pendentes.length === 0 && (
                <p className="text-body-sm text-text-secondary">Nenhuma inscrição pendente.</p>
              )}
              {pendentes.map((matricula) => (
                <Card key={matricula.id} className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-klass-md text-text-primary">{matricula.alunoNome}</span>
                    {rejeitandoId !== matricula.id && (
                      <div className="flex gap-2">
                        <Button
                          disabled={processando}
                          onClick={() => void aoAprovar(matricula.id)}
                        >
                          Aprovar
                        </Button>
                        <Button
                          variant="secondary"
                          disabled={processando}
                          onClick={() => {
                            setRejeitandoId(matricula.id);
                            setMotivo("");
                          }}
                        >
                          Rejeitar
                        </Button>
                      </div>
                    )}
                  </div>

                  {rejeitandoId === matricula.id && (
                    <div className="flex flex-col gap-2">
                      <label className="flex flex-col gap-1.5">
                        <span className="text-label font-medium text-text-secondary">
                          Motivo da rejeição
                        </span>
                        <textarea
                          required
                          rows={2}
                          className="rounded-klass-control border border-border bg-surface px-3.5 py-2 text-body-sm text-text-primary transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                          value={motivo}
                          onChange={(e) => setMotivo(e.target.value)}
                        />
                      </label>
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          disabled={motivo.trim().length < 10 || processando}
                          onClick={() => void aoConfirmarRejeicao(matricula.id)}
                        >
                          Confirmar rejeição
                        </Button>
                        <Button variant="secondary" onClick={() => setRejeitandoId(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              ))}
            </div>

            <Titulo nivel="secao" className="mb-3">
              Matriculados ({matriculados.length})
            </Titulo>
            <div className="mb-6 flex flex-col gap-2">
              {matriculados.length === 0 && (
                <p className="text-body-sm text-text-secondary">Nenhum aluno matriculado ainda.</p>
              )}
              {matriculados.map((matricula) => (
                <Card key={matricula.id} className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-body-sm text-text-primary">{matricula.alunoNome}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="success">Matriculada</Badge>
                      {removendoId !== matricula.id && (
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setRemovendoId(matricula.id);
                            setMotivoRemocao("");
                          }}
                        >
                          Remover da turma
                        </Button>
                      )}
                    </div>
                  </div>

                  {removendoId === matricula.id && (
                    <div className="flex flex-col gap-2">
                      <label className="flex flex-col gap-1.5">
                        <span className="text-label font-medium text-text-secondary">
                          Motivo da remoção
                        </span>
                        <textarea
                          required
                          rows={2}
                          className="rounded-klass-control border border-border bg-surface px-3.5 py-2 text-body-sm text-text-primary transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                          value={motivoRemocao}
                          onChange={(e) => setMotivoRemocao(e.target.value)}
                        />
                      </label>
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          disabled={motivoRemocao.trim().length < 10 || processando}
                          onClick={() => void aoRemover(matricula.id)}
                        >
                          Confirmar remoção
                        </Button>
                        <Button variant="secondary" onClick={() => setRemovendoId(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              ))}
            </div>

            {/* Reativação em lote (coordenação): devolve todas as matrículas
                encerradas da turma para "matriculada", simétrico ao
                "Desfazer encerramento" por aluno logo abaixo. */}
            {temEncerradas && (
              <div className="mb-4 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-4">
                  <Titulo nivel="secao">Encerramento da turma</Titulo>
                  {!confirmandoReativarTurma && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setConfirmandoReativarTurma(true);
                        setReativadas(null);
                      }}
                    >
                      Reativar turma inteira
                    </Button>
                  )}
                </div>
                {confirmandoReativarTurma && (
                  <Card className="flex flex-col gap-3">
                    <p className="text-body-sm text-text-secondary">
                      Isto devolve todos os alunos aprovados e reprovados desta turma para
                      "matriculada", permitindo ao professor lançar de novo. Reativar a turma
                      inteira?
                    </p>
                    <div className="flex gap-2">
                      <Button disabled={reativandoTurma} onClick={() => void aoReativarTurma()}>
                        {reativandoTurma ? "Reativando..." : "Reativar turma inteira"}
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={reativandoTurma}
                        onClick={() => setConfirmandoReativarTurma(false)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </Card>
                )}
                {reativadas !== null && (
                  <Aviso variant="success">
                    {reativadas} matrícula(s) reativada(s) — voltaram para "matriculada".
                  </Aviso>
                )}
              </div>
            )}

            {historico.length > 0 && (
              <>
                <Titulo nivel="secao" className="mb-3">
                  Histórico
                </Titulo>
                <div className="mb-6 flex flex-col gap-2">
                  {historico.map((matricula) => {
                    const podeDesfazer =
                      matricula.status === "concluida" || matricula.status === "reprovada";
                    return (
                      <Card key={matricula.id} className="flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex flex-col">
                            <span className="text-body-sm text-text-primary">
                              {matricula.alunoNome}
                            </span>
                            {(matricula.motivoRejeicao ?? matricula.motivoConclusao) && (
                              <span className="text-label text-text-muted">
                                {matricula.motivoRejeicao ?? matricula.motivoConclusao}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="neutral">{STATUS_LABEL[matricula.status]}</Badge>
                            {podeDesfazer && desfazendoId !== matricula.id && (
                              <Button
                                variant="secondary"
                                onClick={() => setDesfazendoId(matricula.id)}
                              >
                                Desfazer encerramento
                              </Button>
                            )}
                          </div>
                        </div>
                        {podeDesfazer && desfazendoId === matricula.id && (
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-label text-text-secondary">
                              Volta pra "matriculada" — o professor pode lançar de novo. Desfazer
                              mesmo assim?
                            </span>
                            <Button
                              variant="secondary"
                              disabled={processando}
                              onClick={() => void aoDesfazer(matricula.id)}
                            >
                              Sim
                            </Button>
                            <Button variant="secondary" onClick={() => setDesfazendoId(null)}>
                              Não
                            </Button>
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </>
            )}

            {/* Diário (MS4) — coordenação só consulta, quem lança nota/presença é o professor. */}
            <Titulo nivel="secao" className="mb-3">
              Diário
            </Titulo>
            <Card className="mb-4">
              <p className="mb-2 text-label font-medium text-text-secondary">
                Avaliações ({avaliacoes.length})
              </p>
              {avaliacoes.length === 0 ? (
                <p className="text-body-sm text-text-secondary">Nenhuma avaliação cadastrada.</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {avaliacoes.map((a) => (
                    <li key={a.id} className="text-body-sm text-text-secondary">
                      {a.titulo} (peso {a.peso})
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card className="mb-4">
              <p className="mb-2 text-label font-medium text-text-secondary">
                Aulas ({aulas.length})
              </p>
              {aulas.length === 0 ? (
                <p className="text-body-sm text-text-secondary">Nenhuma aula cadastrada.</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {aulas.map((au) => (
                    <li key={au.id} className="text-body-sm text-text-secondary">
                      {au.data}
                      {au.horario ? ` · ${au.horario}` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <div className="flex flex-col gap-2">
              {alunosDiario.length === 0 && (
                <p className="text-body-sm text-text-secondary">
                  Nenhum aluno com matrícula ativa ou encerrada nesta turma ainda.
                </p>
              )}
              {alunosDiario.map((aluno) => (
                <Card key={aluno.matriculaId} className="flex items-center justify-between">
                  <span className="text-body-sm text-text-primary">{aluno.alunoNome}</span>
                  <span className="text-label text-text-muted">
                    Média: {aluno.progresso.media !== null ? aluno.progresso.media.toFixed(1) : "—"}
                    {" · "}
                    Frequência:{" "}
                    {aluno.progresso.frequencia !== null
                      ? `${aluno.progresso.frequencia.toFixed(0)}%`
                      : "—"}
                    {" · "}
                    {STATUS_LABEL[aluno.status]}
                  </span>
                </Card>
              ))}
            </div>
          </>
        )}
    </PaginaAutenticada>
  );
}
