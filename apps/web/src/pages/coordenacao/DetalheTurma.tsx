import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Aviso } from "@/components/Aviso";
import { Badge } from "@/components/Badge";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Button } from "@/components/Button";
import { Cabecalho } from "@/components/Cabecalho";
import { Card } from "@/components/Card";
import { useAuth } from "@/auth";
import {
  buscarProgressoMatricula,
  desfazerEncerramento,
  listarAlunosDoDiario,
  listarAulasDaTurma,
  listarAvaliacoesDaTurma,
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
    if (!usuario) return;
    setErro(null);
    setMensagem(null);
    try {
      await aprovarMatricula(matriculaId, usuario.id);
      setMensagem("Matrícula aprovada — o aluno recebe um e-mail de confirmação.");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível aprovar a matrícula.");
    }
  }

  async function aoConfirmarRejeicao(matriculaId: string) {
    if (!usuario) return;
    setErro(null);
    setMensagem(null);
    try {
      await rejeitarMatricula(matriculaId, usuario.id, motivo);
      setMensagem("Matrícula rejeitada.");
      setRejeitandoId(null);
      setMotivo("");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível rejeitar a matrícula.");
    }
  }

  async function aoDesfazer(matriculaId: string) {
    setErro(null);
    setMensagem(null);
    try {
      await desfazerEncerramento(matriculaId);
      setMensagem("Encerramento desfeito — a matrícula voltou a 'matriculada'.");
      setDesfazendoId(null);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível desfazer o encerramento.");
    }
  }

  const pendentes = matriculas.filter((m) => m.status === "inscrita");
  const matriculados = matriculas.filter((m) => m.status === "matriculada");
  const historico = matriculas.filter((m) =>
    ["rejeitada", "cancelada", "concluida", "reprovada"].includes(m.status),
  );

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
            <Card className="mb-6">
              <h1 className="font-serif text-klass-xl text-text-primary">{turma.codigo}</h1>
              <p className="mt-1 text-body-sm text-text-secondary">
                {turma.moduloNome} · {turma.trilhaNome}
              </p>
              <p className="mt-2 text-label text-text-muted">
                {turma.professorNome} · {turma.periodoInicio} a {turma.periodoFim} ·{" "}
                {turma.vagasTotal} vagas
              </p>
            </Card>

            <h2 className="mb-3 font-serif text-klass-lg text-text-primary">
              Inscrições pendentes ({pendentes.length})
            </h2>
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
                        <Button onClick={() => void aoAprovar(matricula.id)}>Aprovar</Button>
                        <Button
                          variant="secondary"
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
                          className="rounded-klass-control border border-border bg-surface px-3.5 py-2 text-body-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                          value={motivo}
                          onChange={(e) => setMotivo(e.target.value)}
                        />
                      </label>
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          disabled={motivo.trim().length < 10}
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

            <h2 className="mb-3 font-serif text-klass-lg text-text-primary">
              Matriculados ({matriculados.length})
            </h2>
            <div className="mb-6 flex flex-col gap-2">
              {matriculados.length === 0 && (
                <p className="text-body-sm text-text-secondary">Nenhum aluno matriculado ainda.</p>
              )}
              {matriculados.map((matricula) => (
                <Card key={matricula.id} className="flex items-center justify-between">
                  <span className="text-body-sm text-text-primary">{matricula.alunoNome}</span>
                  <Badge variant="success">Matriculada</Badge>
                </Card>
              ))}
            </div>

            {historico.length > 0 && (
              <>
                <h2 className="mb-3 font-serif text-klass-lg text-text-primary">Histórico</h2>
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
                            {matricula.motivoRejeicao && (
                              <span className="text-label text-text-muted">
                                {matricula.motivoRejeicao}
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
                            <Button variant="secondary" onClick={() => void aoDesfazer(matricula.id)}>
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
            <h2 className="mb-3 font-serif text-klass-lg text-text-primary">Diário</h2>
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
      </div>
    </div>
  );
}
