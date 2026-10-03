import { useState } from "react";
import { useParams } from "react-router-dom";
import { Aviso } from "@/components/Aviso";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Esqueleto, EsqueletoCards, RegiaoCarregando } from "@/components/Esqueleto";
import { ErroConsulta } from "@/components/ErroConsulta";
import { LinkComPrefetch } from "@/components/LinkComPrefetch";
import { PaginaAutenticada } from "@/components/PaginaAutenticada";
import { StatusBadge } from "@/components/StatusBadge";
import { Titulo } from "@/components/Titulo";
import { useAuth } from "@/auth";
import { useAulasDaTurma, useAvaliacoesDaTurma, useProgressos } from "@/lib/consultas/diario";
import { useGravacao } from "@/lib/consultas/gravacao";
import { invalidar } from "@/lib/consultas/invalidar";
import { useMatriculasDaTurma, useTurma } from "@/lib/consultas/selecao";
import {
  desfazerEncerramento,
  filtrarAlunosDoDiario,
  reativarTurma,
  type AlunoDoDiario,
  type ProgressoMatricula,
} from "@/lib/diario";
import {
  aprovarMatricula,
  rejeitarMatricula,
  removerAlunoDaTurma,
} from "@/lib/selecao";

interface AlunoComProgresso extends AlunoDoDiario {
  progresso: ProgressoMatricula;
}

export function DetalheTurma() {
  const { id } = useParams<{ id: string }>();
  const { usuario } = useAuth();
  const gravar = useGravacao();
  // Uma lista de matrículas alimenta inscrições, matriculados, histórico e
  // o diário (antes eram duas buscas da mesma tabela); tudo em paralelo.
  const consultaTurma = useTurma(id);
  const consultaMatriculas = useMatriculasDaTurma(id);
  const consultaAvaliacoes = useAvaliacoesDaTurma(id);
  const consultaAulas = useAulasDaTurma(id);
  const alunosDoDiario = consultaMatriculas.data ? filtrarAlunosDoDiario(consultaMatriculas.data) : undefined;
  const progressos = useProgressos((alunosDoDiario ?? []).map((a) => a.matriculaId));
  const turma = consultaTurma.data;
  const matriculas = consultaMatriculas.data ?? [];
  const avaliacoes = consultaAvaliacoes.data ?? [];
  const aulas = consultaAulas.data ?? [];
  const alunosDiario: AlunoComProgresso[] =
    alunosDoDiario && !progressos.pendente
      ? alunosDoDiario.flatMap((a) => {
          const progresso = progressos.porMatricula.get(a.matriculaId);
          return progresso ? [{ ...a, progresso }] : [];
        })
      : [];
  const consultas = [consultaTurma, consultaMatriculas, consultaAvaliacoes, consultaAulas];
  const erroDeLeitura = consultas.find((c) => c.isError)?.error ?? progressos.erro;
  const carregandoDiario =
    consultaAvaliacoes.isPending || consultaAulas.isPending || !alunosDoDiario || progressos.pendente;
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [rejeitandoId, setRejeitandoId] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
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

  async function aoAprovar(matriculaId: string) {
    if (!usuario || !id || processando) return;
    setErro(null);
    setMensagem(null);
    setProcessando(true);
    try {
      await gravar(() => aprovarMatricula(matriculaId, usuario.id), (qc) => invalidar.matriculas(qc, id));
      setMensagem("Matrícula aprovada — o aluno recebe um e-mail de confirmação.");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível aprovar a matrícula.");
    } finally {
      setProcessando(false);
    }
  }

  async function aoConfirmarRejeicao(matriculaId: string) {
    if (!usuario || !id || processando) return;
    setErro(null);
    setMensagem(null);
    setProcessando(true);
    try {
      await gravar(
        () => rejeitarMatricula(matriculaId, usuario.id, motivo),
        (qc) => invalidar.matriculas(qc, id),
      );
      setMensagem("Matrícula rejeitada.");
      setRejeitandoId(null);
      setMotivo("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível rejeitar a matrícula.");
    } finally {
      setProcessando(false);
    }
  }

  async function aoDesfazer(matriculaId: string) {
    if (!id || processando) return;
    setErro(null);
    setMensagem(null);
    setProcessando(true);
    try {
      await gravar(() => desfazerEncerramento(matriculaId), (qc) => invalidar.matriculas(qc, id));
      setMensagem("Encerramento desfeito — a matrícula voltou a 'matriculada'.");
      setDesfazendoId(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível desfazer o encerramento.");
    } finally {
      setProcessando(false);
    }
  }

  async function aoRemover(matriculaId: string) {
    if (!id || processando) return;
    setErro(null);
    setMensagem(null);
    setProcessando(true);
    try {
      await gravar(
        () => removerAlunoDaTurma(matriculaId, motivoRemocao),
        (qc) => invalidar.matriculas(qc, id),
      );
      setMensagem("Aluno removido da turma. Ele vê o motivo nas próprias matrículas.");
      setRemovendoId(null);
      setMotivoRemocao("");
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
      const resumo = await gravar(() => reativarTurma(id), (qc) => invalidar.matriculas(qc, id));
      setReativadas(resumo.reativadas);
      setConfirmandoReativarTurma(false);
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

        {erroDeLeitura && (
          <ErroConsulta
            className="mb-4"
            erro={erroDeLeitura}
            padrao="Não foi possível carregar a turma."
            tentarDeNovo={() => {
              consultas.forEach((c) => c.isError && void c.refetch());
              progressos.tentarDeNovo();
            }}
          />
        )}
        {(consultaTurma.isPending || consultaMatriculas.isPending) && !erroDeLeitura && (
          <>
            <RegiaoCarregando className="mb-6 flex flex-col gap-2 rounded-klass-card border border-border bg-surface px-klass-card-x py-6">
              <Esqueleto className="h-8 w-40" />
              <Esqueleto className="h-4 w-64" />
              <Esqueleto className="h-3 w-80" />
            </RegiaoCarregando>
            <Esqueleto className="mb-3 h-6 w-56" />
            <EsqueletoCards quantidade={2} altura="h-16" />
          </>
        )}
        {turma === null && (
          <p className="text-body-sm text-text-secondary">Turma não encontrada.</p>
        )}

        {turma && consultaMatriculas.data && (
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
              <LinkComPrefetch to={`/coordenacao/turmas/${turma.id}/editar`}>
                <Button variant="secondary" className="whitespace-nowrap">
                  Editar turma
                </Button>
              </LinkComPrefetch>
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
                      <StatusBadge tipo="matricula" status="matriculada" />
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
                            <StatusBadge tipo="matricula" status={matricula.status} />
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
            {carregandoDiario && !erroDeLeitura && <EsqueletoCards quantidade={3} altura="h-20" />}
            {!carregandoDiario && (
            <>
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
                <Card key={aluno.matriculaId} className="flex items-center justify-between gap-3">
                  <span className="text-body-sm text-text-primary">{aluno.alunoNome}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-label text-text-muted">
                      Média: {aluno.progresso.media !== null ? aluno.progresso.media.toFixed(1) : "—"}
                      {" · "}
                      Frequência:{" "}
                      {aluno.progresso.frequencia !== null
                        ? `${aluno.progresso.frequencia.toFixed(0)}%`
                        : "—"}
                    </span>
                    <StatusBadge tipo="matricula" status={aluno.status} />
                  </div>
                </Card>
              ))}
            </div>
            </>
            )}
          </>
        )}
    </PaginaAutenticada>
  );
}
