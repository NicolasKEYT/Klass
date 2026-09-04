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
  concluida: "Concluída",
};

export function DetalheTurma() {
  const { id } = useParams<{ id: string }>();
  const { usuario } = useAuth();
  const [turma, setTurma] = useState<TurmaDetalhada | null | undefined>(undefined);
  const [matriculas, setMatriculas] = useState<MatriculaListagem[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [rejeitandoId, setRejeitandoId] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");

  async function carregar() {
    if (!id) return;
    try {
      const [dadosTurma, dadosMatriculas] = await Promise.all([
        buscarTurmaDetalhada(id),
        listarMatriculasDaTurma(id),
      ]);
      setTurma(dadosTurma);
      setMatriculas(dadosMatriculas);
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

  const pendentes = matriculas.filter((m) => m.status === "inscrita");
  const matriculados = matriculas.filter((m) => m.status === "matriculada");
  const historico = matriculas.filter((m) =>
    ["rejeitada", "cancelada", "concluida"].includes(m.status),
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
              <p className="mt-1 text-body-sm text-text-secondary">{turma.trilhaNome}</p>
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
                <div className="flex flex-col gap-2">
                  {historico.map((matricula) => (
                    <Card key={matricula.id} className="flex items-center justify-between gap-4">
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
                      <Badge variant="neutral">{STATUS_LABEL[matricula.status]}</Badge>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
