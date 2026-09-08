import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@/auth";
import { Aviso } from "@/components/Aviso";
import { Badge } from "@/components/Badge";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Button } from "@/components/Button";
import { Cabecalho } from "@/components/Cabecalho";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import {
  buscarProgressoMatricula,
  criarAula,
  criarAvaliacao,
  encerrarMatricula,
  listarAlunosDoDiario,
  listarAulasDaTurma,
  listarAvaliacoesDaTurma,
  proximaOrdemAvaliacao,
  type AlunoDoDiario,
  type Aula,
  type Avaliacao,
  type ProgressoMatricula,
} from "@/lib/diario";
import { buscarTurmaDetalhada, type TurmaDetalhada } from "@/lib/selecao";

type Aba = "avaliacoes" | "aulas" | "alunos";

interface AlunoComProgresso extends AlunoDoDiario {
  progresso: ProgressoMatricula;
}

const STATUS_LABEL: Record<string, string> = {
  matriculada: "Cursando",
  concluida: "Aprovado(a)",
  reprovada: "Reprovado(a)",
};

export function DetalheTurma() {
  const { id } = useParams<{ id: string }>();
  const { usuario } = useAuth();
  const [aba, setAba] = useState<Aba>("avaliacoes");
  const [turma, setTurma] = useState<TurmaDetalhada | null | undefined>(undefined);
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
  const [aulas, setAulas] = useState<Aula[]>([]);
  const [alunos, setAlunos] = useState<AlunoComProgresso[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);

  const [mostrarNovaAvaliacao, setMostrarNovaAvaliacao] = useState(false);
  const [novoTitulo, setNovoTitulo] = useState("");
  const [novaDescricao, setNovaDescricao] = useState("");
  const [novoPeso, setNovoPeso] = useState(1);
  const [salvandoAvaliacao, setSalvandoAvaliacao] = useState(false);

  const [mostrarNovaAula, setMostrarNovaAula] = useState(false);
  const [novaData, setNovaData] = useState("");
  const [novoHorario, setNovoHorario] = useState("");
  const [novaAulaDescricao, setNovaAulaDescricao] = useState("");
  const [salvandoAula, setSalvandoAula] = useState(false);

  const [encerrandoId, setEncerrandoId] = useState<string | null>(null);

  async function carregar() {
    if (!id) return;
    try {
      const [dadosTurma, listaAvaliacoes, listaAulas, listaAlunos] = await Promise.all([
        buscarTurmaDetalhada(id),
        listarAvaliacoesDaTurma(id),
        listarAulasDaTurma(id),
        listarAlunosDoDiario(id),
      ]);
      setTurma(dadosTurma);
      setAvaliacoes(listaAvaliacoes);
      setAulas(listaAulas);

      const progressos = await Promise.all(
        listaAlunos.map((a) => buscarProgressoMatricula(a.matriculaId)),
      );
      setAlunos(listaAlunos.map((a, i) => ({ ...a, progresso: progressos[i] })));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar a turma.");
    }
  }

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function aoCriarAvaliacao(evento: FormEvent) {
    evento.preventDefault();
    if (!id) return;
    setErro(null);
    setMensagem(null);
    setSalvandoAvaliacao(true);
    try {
      const ordem = await proximaOrdemAvaliacao(id);
      await criarAvaliacao({
        turmaId: id,
        titulo: novoTitulo,
        descricao: novaDescricao,
        peso: novoPeso,
        ordem,
      });
      setNovoTitulo("");
      setNovaDescricao("");
      setNovoPeso(1);
      setMostrarNovaAvaliacao(false);
      setMensagem("Avaliação criada.");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível criar a avaliação.");
    } finally {
      setSalvandoAvaliacao(false);
    }
  }

  async function aoCriarAula(evento: FormEvent) {
    evento.preventDefault();
    if (!id) return;
    setErro(null);
    setMensagem(null);
    setSalvandoAula(true);
    try {
      await criarAula({
        turmaId: id,
        data: novaData,
        horario: novoHorario,
        descricao: novaAulaDescricao,
      });
      setNovaData("");
      setNovoHorario("");
      setNovaAulaDescricao("");
      setMostrarNovaAula(false);
      setMensagem("Aula criada.");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível criar a aula.");
    } finally {
      setSalvandoAula(false);
    }
  }

  async function aoEncerrar(matriculaId: string) {
    setErro(null);
    setMensagem(null);
    setEncerrandoId(matriculaId);
    try {
      await encerrarMatricula(matriculaId);
      setMensagem("Módulo encerrado.");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível encerrar o módulo.");
    } finally {
      setEncerrandoId(null);
    }
  }

  if (!usuario) return null;

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
        {turma === null && <p className="text-body-sm text-text-secondary">Turma não encontrada.</p>}

        {turma && (
          <>
            <Card className="mb-6">
              <h1 className="font-serif text-klass-xl text-text-primary">{turma.codigo}</h1>
              <p className="mt-1 text-body-sm text-text-secondary">
                {turma.moduloNome} · {turma.trilhaNome}
              </p>
              <p className="mt-2 text-label text-text-muted">
                {turma.periodoInicio} a {turma.periodoFim}
              </p>
            </Card>

            <div className="mb-4 flex gap-2 border-b border-border">
              {(["avaliacoes", "aulas", "alunos"] as Aba[]).map((valor) => (
                <button
                  key={valor}
                  onClick={() => setAba(valor)}
                  className={`px-3 py-2 text-body-sm font-medium ${
                    aba === valor
                      ? "border-b-2 border-primary text-primary"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {valor === "avaliacoes" ? "Avaliações" : valor === "aulas" ? "Aulas" : "Alunos"}
                </button>
              ))}
            </div>

            {aba === "avaliacoes" && (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-serif text-klass-lg text-text-primary">
                    Avaliações ({avaliacoes.length})
                  </h2>
                  <Button onClick={() => setMostrarNovaAvaliacao((v) => !v)}>
                    {mostrarNovaAvaliacao ? "Cancelar" : "Nova avaliação"}
                  </Button>
                </div>

                {mostrarNovaAvaliacao && (
                  <Card className="mb-4">
                    <form className="flex flex-col gap-3" onSubmit={aoCriarAvaliacao}>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-label font-medium text-text-secondary">Título</span>
                        <Input
                          required
                          placeholder="Prova 1"
                          value={novoTitulo}
                          onChange={(e) => setNovoTitulo(e.target.value)}
                        />
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-label font-medium text-text-secondary">
                          Descrição (opcional)
                        </span>
                        <Input
                          value={novaDescricao}
                          onChange={(e) => setNovaDescricao(e.target.value)}
                        />
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-label font-medium text-text-secondary">Peso</span>
                        <Input
                          type="number"
                          min={1}
                          required
                          value={novoPeso}
                          onChange={(e) => setNovoPeso(Number(e.target.value))}
                        />
                      </label>
                      <Button type="submit" disabled={salvandoAvaliacao} className="self-start">
                        {salvandoAvaliacao ? "Criando..." : "Criar"}
                      </Button>
                    </form>
                  </Card>
                )}

                <div className="flex flex-col gap-2">
                  {avaliacoes.length === 0 && (
                    <p className="text-body-sm text-text-secondary">
                      Nenhuma avaliação cadastrada ainda.
                    </p>
                  )}
                  {avaliacoes.map((avaliacao) => (
                    <Card key={avaliacao.id} className="flex items-center justify-between">
                      <div>
                        <p className="text-body-sm font-medium text-text-primary">
                          {avaliacao.titulo}
                        </p>
                        <p className="text-label text-text-muted">Peso {avaliacao.peso}</p>
                      </div>
                      <Link
                        to={`/professor/turmas/${id}/avaliacoes/${avaliacao.id}`}
                        className="text-body-sm font-medium text-primary hover:underline"
                      >
                        Lançar notas
                      </Link>
                    </Card>
                  ))}
                </div>
              </>
            )}

            {aba === "aulas" && (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-serif text-klass-lg text-text-primary">
                    Aulas ({aulas.length})
                  </h2>
                  <Button onClick={() => setMostrarNovaAula((v) => !v)}>
                    {mostrarNovaAula ? "Cancelar" : "Nova aula"}
                  </Button>
                </div>

                {mostrarNovaAula && (
                  <Card className="mb-4">
                    <form className="flex flex-col gap-3" onSubmit={aoCriarAula}>
                      <div className="flex gap-4">
                        <label className="flex flex-1 flex-col gap-1.5">
                          <span className="text-label font-medium text-text-secondary">Data</span>
                          <Input
                            type="date"
                            required
                            value={novaData}
                            onChange={(e) => setNovaData(e.target.value)}
                          />
                        </label>
                        <label className="flex flex-1 flex-col gap-1.5">
                          <span className="text-label font-medium text-text-secondary">
                            Horário (opcional)
                          </span>
                          <Input
                            type="time"
                            value={novoHorario}
                            onChange={(e) => setNovoHorario(e.target.value)}
                          />
                        </label>
                      </div>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-label font-medium text-text-secondary">
                          Descrição (opcional)
                        </span>
                        <Input
                          value={novaAulaDescricao}
                          onChange={(e) => setNovaAulaDescricao(e.target.value)}
                        />
                      </label>
                      <Button type="submit" disabled={salvandoAula} className="self-start">
                        {salvandoAula ? "Criando..." : "Criar"}
                      </Button>
                    </form>
                  </Card>
                )}

                <div className="flex flex-col gap-2">
                  {aulas.length === 0 && (
                    <p className="text-body-sm text-text-secondary">Nenhuma aula cadastrada ainda.</p>
                  )}
                  {aulas.map((aula) => (
                    <Card key={aula.id} className="flex items-center justify-between">
                      <div>
                        <p className="text-body-sm font-medium text-text-primary">
                          {aula.data}
                          {aula.horario ? ` · ${aula.horario}` : ""}
                        </p>
                        {aula.descricao && (
                          <p className="text-label text-text-muted">{aula.descricao}</p>
                        )}
                      </div>
                      <Link
                        to={`/professor/turmas/${id}/aulas/${aula.id}/chamada`}
                        className="text-body-sm font-medium text-primary hover:underline"
                      >
                        Fazer chamada
                      </Link>
                    </Card>
                  ))}
                </div>
              </>
            )}

            {aba === "alunos" && (
              <div className="flex flex-col gap-2">
                {alunos.length === 0 && (
                  <p className="text-body-sm text-text-secondary">
                    Nenhum aluno matriculado ainda.
                  </p>
                )}
                {alunos.map((aluno) => {
                  const motivoDesabilitado = !aluno.progresso.prontoParaEncerrar
                    ? "Ainda há avaliação sem nota ou aula sem chamada para este aluno."
                    : undefined;
                  return (
                    <Card key={aluno.matriculaId} className="flex items-center justify-between gap-4">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-body-sm font-medium text-text-primary">
                            {aluno.alunoNome}
                          </span>
                          <Badge
                            variant={
                              aluno.status === "reprovada"
                                ? "danger"
                                : aluno.status === "concluida"
                                  ? "success"
                                  : "neutral"
                            }
                          >
                            {STATUS_LABEL[aluno.status]}
                          </Badge>
                        </div>
                        <span className="text-label text-text-muted">
                          Média:{" "}
                          {aluno.progresso.media !== null ? aluno.progresso.media.toFixed(1) : "—"}{" "}
                          · Frequência:{" "}
                          {aluno.progresso.frequencia !== null
                            ? `${aluno.progresso.frequencia.toFixed(0)}%`
                            : "—"}
                        </span>
                      </div>
                      {aluno.status === "matriculada" && (
                        <Button
                          variant="secondary"
                          disabled={
                            !aluno.progresso.prontoParaEncerrar || encerrandoId === aluno.matriculaId
                          }
                          title={motivoDesabilitado}
                          onClick={() => void aoEncerrar(aluno.matriculaId)}
                        >
                          {encerrandoId === aluno.matriculaId ? "Encerrando..." : "Encerrar módulo"}
                        </Button>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
