import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@/auth";
import { Aviso } from "@/components/Aviso";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { GradeNotas } from "@/components/diario/GradeNotas";
import { Input } from "@/components/Input";
import { PaginaAutenticada } from "@/components/PaginaAutenticada";
import { StatusBadge } from "@/components/StatusBadge";
import { Titulo } from "@/components/Titulo";
import {
  buscarProgressoMatricula,
  criarAula,
  criarAvaliacao,
  encerrarMatricula,
  encerrarTurma,
  listarAlunosDoDiario,
  listarAulasDaTurma,
  listarAvaliacoesDaTurma,
  proximaOrdemAvaliacao,
  type AlunoDoDiario,
  type Aula,
  type Avaliacao,
  type ProgressoMatricula,
  type ResumoEncerramentoTurma,
} from "@/lib/diario";
import { buscarTurmaDetalhada, type TurmaDetalhada } from "@/lib/selecao";

type Aba = "avaliacoes" | "aulas" | "alunos";

interface AlunoComProgresso extends AlunoDoDiario {
  progresso: ProgressoMatricula;
}

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
  const [confirmandoEncerrarTurma, setConfirmandoEncerrarTurma] = useState(false);
  const [encerrandoTurma, setEncerrandoTurma] = useState(false);
  const [resumoEncerramento, setResumoEncerramento] = useState<ResumoEncerramentoTurma | null>(null);

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
      setMensagem("Resultado do aluno lançado.");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível encerrar o aluno.");
    } finally {
      setEncerrandoId(null);
    }
  }

  async function aoEncerrarTurma() {
    if (!id) return;
    setErro(null);
    setMensagem(null);
    setEncerrandoTurma(true);
    try {
      const resumo = await encerrarTurma(id);
      setResumoEncerramento(resumo);
      setConfirmandoEncerrarTurma(false);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível encerrar a turma.");
    } finally {
      setEncerrandoTurma(false);
    }
  }

  if (!usuario) return null;

  // Peso não tem teto (decisão de manter flexibilidade) — mostrar quanto
  // cada avaliação representa da média final deixa o efeito prático claro
  // sem impor limite. Recalcula sozinho porque `avaliacoes` é estado.
  const somaPesos = avaliacoes.reduce((soma, a) => soma + a.peso, 0);
  function percentualDoPeso(peso: number, somaTotal: number): number {
    return somaTotal > 0 ? Math.round((peso / somaTotal) * 100) : 0;
  }

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
        {turma === null && <p className="text-body-sm text-text-secondary">Turma não encontrada.</p>}

        {turma && (
          <>
            <Card className="mb-6">
              <Titulo>{turma.codigo}</Titulo>
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
                  <Titulo nivel="secao">Avaliações ({avaliacoes.length})</Titulo>
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
                        <span className="text-label text-text-muted">
                          Com este peso, a avaliação representará{" "}
                          {percentualDoPeso(novoPeso, somaPesos + novoPeso)}% da média final.
                        </span>
                      </label>
                      <Button type="submit" disabled={salvandoAvaliacao} className="self-start">
                        {salvandoAvaliacao ? "Criando..." : "Criar"}
                      </Button>
                    </form>
                  </Card>
                )}

                {avaliacoes.length === 0 && (
                  <p className="text-body-sm text-text-secondary">
                    Nenhuma avaliação cadastrada ainda.
                  </p>
                )}
                {avaliacoes.length > 0 && turma && (
                  <GradeNotas
                    turmaId={id!}
                    turma={turma}
                    lancadoPor={usuario.id}
                    avaliacoes={avaliacoes}
                  />
                )}
              </>
            )}

            {aba === "aulas" && (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <Titulo nivel="secao">Aulas ({aulas.length})</Titulo>
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
              <>
                <div className="mb-4 flex items-center justify-between gap-4">
                  <Titulo nivel="secao">Alunos ({alunos.length})</Titulo>
                  {alunos.some((a) => a.status === "matriculada") &&
                    !confirmandoEncerrarTurma && (
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setConfirmandoEncerrarTurma(true);
                          setResumoEncerramento(null);
                        }}
                      >
                        Encerrar turma
                      </Button>
                    )}
                </div>

                {/* Ação de nível de turma, separada dos botões por aluno abaixo. */}
                {confirmandoEncerrarTurma && (
                  <Card className="mb-4 flex flex-col gap-3">
                    <p className="text-body-sm text-text-secondary">
                      Isto encerra de uma vez todos os alunos matriculados — cada um é aprovado ou
                      reprovado pelos próprios critérios de nota e frequência. Quem ainda estiver sem
                      todas as notas ou chamadas é pulado e continua matriculado. Encerrar a turma
                      agora?
                    </p>
                    <div className="flex gap-2">
                      <Button disabled={encerrandoTurma} onClick={() => void aoEncerrarTurma()}>
                        {encerrandoTurma ? "Encerrando..." : "Encerrar turma"}
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={encerrandoTurma}
                        onClick={() => setConfirmandoEncerrarTurma(false)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </Card>
                )}

                {resumoEncerramento && (
                  <Aviso variant="success" className="mb-4">
                    Encerramento concluído: {resumoEncerramento.aprovadas} aprovado(s),{" "}
                    {resumoEncerramento.reprovadas} reprovado(s)
                    {resumoEncerramento.puladas > 0
                      ? `, ${resumoEncerramento.puladas} pulado(s) (faltam notas ou chamadas)`
                      : ""}
                    .
                  </Aviso>
                )}

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
                          <StatusBadge tipo="matricula" status={aluno.status} />
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
                          {encerrandoId === aluno.matriculaId ? "Encerrando..." : "Encerrar aluno"}
                        </Button>
                      )}
                    </Card>
                  );
                })}
                </div>
              </>
            )}
          </>
        )}
    </PaginaAutenticada>
  );
}
