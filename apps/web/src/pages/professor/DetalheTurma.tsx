import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Pencil } from "lucide-react";
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
  apagarAvaliacao,
  atualizarAula,
  buscarProgressoMatricula,
  calcularDatasRecorrentes,
  criarAula,
  criarAulasEmLote,
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
type ModoCriacaoAula = "unica" | "recorrencia";

const DIAS_SEMANA: Array<{ valor: number; label: string }> = [
  { valor: 1, label: "Seg" },
  { valor: 2, label: "Ter" },
  { valor: 3, label: "Qua" },
  { valor: 4, label: "Qui" },
  { valor: 5, label: "Sex" },
  { valor: 6, label: "Sáb" },
  { valor: 0, label: "Dom" },
];

interface AlunoComProgresso extends AlunoDoDiario {
  progresso: ProgressoMatricula;
}

export function DetalheTurma() {
  const { id } = useParams<{ id: string }>();
  const { usuario } = useAuth();
  // A aba ativa mora na URL (?aba=...), não em estado local: assim, ao
  // sair para "Fazer chamada" (rota separada) e voltar pelo histórico do
  // navegador (BotaoVoltar → navigate(-1)), a página volta exatamente na
  // aba de onde saiu, em vez de resetar para "avaliacoes" a cada remount.
  const [searchParams, setSearchParams] = useSearchParams();
  const abaParam = searchParams.get("aba");
  const aba: Aba = abaParam === "aulas" || abaParam === "alunos" ? abaParam : "avaliacoes";
  function mudarAba(valor: Aba) {
    setSearchParams(
      (atual) => {
        const proximo = new URLSearchParams(atual);
        proximo.set("aba", valor);
        return proximo;
      },
      { replace: true },
    );
  }
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
  const [modoCriacaoAula, setModoCriacaoAula] = useState<ModoCriacaoAula>("unica");
  const [novaData, setNovaData] = useState("");
  const [novoHorario, setNovoHorario] = useState("");
  const [novaAulaDescricao, setNovaAulaDescricao] = useState("");
  const [salvandoAula, setSalvandoAula] = useState(false);

  // Recorrência: gera várias aulas de uma vez (dia(s) da semana + período);
  // exceções pontuais continuam tratadas depois, editando a aula gerada.
  const [diasSelecionados, setDiasSelecionados] = useState<number[]>([]);
  const [recorrenciaInicio, setRecorrenciaInicio] = useState("");
  const [recorrenciaFim, setRecorrenciaFim] = useState("");
  const [recorrenciaHorario, setRecorrenciaHorario] = useState("");
  const [recorrenciaDescricao, setRecorrenciaDescricao] = useState("");

  const [editandoAulaId, setEditandoAulaId] = useState<string | null>(null);
  const [editData, setEditData] = useState("");
  const [editHorario, setEditHorario] = useState("");
  const [editDescricao, setEditDescricao] = useState("");
  const [salvandoEdicaoAula, setSalvandoEdicaoAula] = useState(false);

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

  const datasRecorrencia = calcularDatasRecorrentes(diasSelecionados, recorrenciaInicio, recorrenciaFim);

  function alternarDiaSemana(valor: number) {
    setDiasSelecionados((atual) =>
      atual.includes(valor) ? atual.filter((d) => d !== valor) : [...atual, valor],
    );
  }

  async function aoGerarAulas(evento: FormEvent) {
    evento.preventDefault();
    if (!id || datasRecorrencia.length === 0) return;
    setErro(null);
    setMensagem(null);
    setSalvandoAula(true);
    try {
      await criarAulasEmLote({
        turmaId: id,
        datas: datasRecorrencia,
        horario: recorrenciaHorario,
        descricao: recorrenciaDescricao,
      });
      setDiasSelecionados([]);
      setRecorrenciaInicio("");
      setRecorrenciaFim("");
      setRecorrenciaHorario("");
      setRecorrenciaDescricao("");
      setMostrarNovaAula(false);
      setMensagem(`${datasRecorrencia.length} aula(s) criada(s).`);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível gerar as aulas.");
    } finally {
      setSalvandoAula(false);
    }
  }

  function aoAbrirEdicaoAula(aula: Aula) {
    setErro(null);
    setMensagem(null);
    setMostrarNovaAula(false);
    setEditandoAulaId(aula.id);
    setEditData(aula.data);
    setEditHorario(aula.horario ?? "");
    setEditDescricao(aula.descricao ?? "");
  }

  async function aoSalvarEdicaoAula(evento: FormEvent) {
    evento.preventDefault();
    if (!editandoAulaId) return;
    setErro(null);
    setMensagem(null);
    setSalvandoEdicaoAula(true);
    try {
      await atualizarAula(editandoAulaId, { data: editData, horario: editHorario, descricao: editDescricao });
      setEditandoAulaId(null);
      setMensagem("Aula atualizada.");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível atualizar a aula.");
    } finally {
      setSalvandoEdicaoAula(false);
    }
  }

  async function aoApagarAvaliacao(avaliacaoId: string) {
    setMensagem(null);
    await apagarAvaliacao(avaliacaoId);
    setMensagem("Avaliação apagada.");
    await carregar();
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
        <BotaoVoltar seSemHistorico="/professor/turmas" />

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
                  onClick={() => mudarAba(valor)}
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
                    onApagarAvaliacao={aoApagarAvaliacao}
                  />
                )}
              </>
            )}

            {aba === "aulas" && (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <Titulo nivel="secao">Aulas ({aulas.length})</Titulo>
                  <Button
                    onClick={() => {
                      setMostrarNovaAula((v) => !v);
                      setEditandoAulaId(null);
                    }}
                  >
                    {mostrarNovaAula ? "Cancelar" : "Nova aula"}
                  </Button>
                </div>

                {mostrarNovaAula && (
                  <Card className="mb-4">
                    {/* Uma aula por vez continua existindo (exceções); ao
                        lado, o modo recorrência gera várias de uma vez
                        pro padrão fixo (ex.: toda terça/quinta) — cada uma
                        editável depois individualmente. */}
                    <div className="mb-3 flex gap-2 border-b border-border">
                      {(["unica", "recorrencia"] as ModoCriacaoAula[]).map((modo) => (
                        <button
                          key={modo}
                          type="button"
                          onClick={() => setModoCriacaoAula(modo)}
                          className={`px-3 py-2 text-body-sm font-medium ${
                            modoCriacaoAula === modo
                              ? "border-b-2 border-primary text-primary"
                              : "text-text-secondary hover:text-text-primary"
                          }`}
                        >
                          {modo === "unica" ? "Uma aula" : "Recorrência"}
                        </button>
                      ))}
                    </div>

                    {modoCriacaoAula === "unica" ? (
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
                    ) : (
                      <form className="flex flex-col gap-3" onSubmit={aoGerarAulas}>
                        <div>
                          <span className="mb-1.5 block text-label font-medium text-text-secondary">
                            Dias da semana
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {DIAS_SEMANA.map(({ valor, label }) => (
                              <button
                                key={valor}
                                type="button"
                                onClick={() => alternarDiaSemana(valor)}
                                className={`h-9 rounded-klass-control border px-3 text-body-sm font-medium transition ${
                                  diasSelecionados.includes(valor)
                                    ? "border-text-primary bg-text-primary text-white"
                                    : "border-border bg-surface text-text-secondary"
                                }`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-4">
                          <label className="flex flex-1 flex-col gap-1.5">
                            <span className="text-label font-medium text-text-secondary">
                              Data de início
                            </span>
                            <Input
                              type="date"
                              required
                              value={recorrenciaInicio}
                              onChange={(e) => setRecorrenciaInicio(e.target.value)}
                            />
                          </label>
                          <label className="flex flex-1 flex-col gap-1.5">
                            <span className="text-label font-medium text-text-secondary">
                              Data de fim
                            </span>
                            <Input
                              type="date"
                              required
                              value={recorrenciaFim}
                              onChange={(e) => setRecorrenciaFim(e.target.value)}
                            />
                          </label>
                          <label className="flex flex-1 flex-col gap-1.5">
                            <span className="text-label font-medium text-text-secondary">
                              Horário (opcional)
                            </span>
                            <Input
                              type="time"
                              value={recorrenciaHorario}
                              onChange={(e) => setRecorrenciaHorario(e.target.value)}
                            />
                          </label>
                        </div>
                        <label className="flex flex-col gap-1.5">
                          <span className="text-label font-medium text-text-secondary">
                            Descrição (opcional, aplicada a todas)
                          </span>
                          <Input
                            value={recorrenciaDescricao}
                            onChange={(e) => setRecorrenciaDescricao(e.target.value)}
                          />
                        </label>
                        <p className="text-label text-text-muted">
                          {datasRecorrencia.length === 0
                            ? "Escolha ao menos um dia da semana e o período."
                            : `${datasRecorrencia.length} aula(s) serão criadas.`}
                        </p>
                        <Button
                          type="submit"
                          disabled={salvandoAula || datasRecorrencia.length === 0}
                          className="self-start"
                        >
                          {salvandoAula ? "Gerando..." : "Gerar aulas"}
                        </Button>
                      </form>
                    )}
                  </Card>
                )}

                <div className="flex flex-col gap-2">
                  {aulas.length === 0 && (
                    <p className="text-body-sm text-text-secondary">Nenhuma aula cadastrada ainda.</p>
                  )}
                  {aulas.map((aula) =>
                    editandoAulaId === aula.id ? (
                      <Card key={aula.id}>
                        <form className="flex flex-col gap-3" onSubmit={aoSalvarEdicaoAula}>
                          <div className="flex gap-4">
                            <label className="flex flex-1 flex-col gap-1.5">
                              <span className="text-label font-medium text-text-secondary">Data</span>
                              <Input
                                type="date"
                                required
                                value={editData}
                                onChange={(e) => setEditData(e.target.value)}
                              />
                            </label>
                            <label className="flex flex-1 flex-col gap-1.5">
                              <span className="text-label font-medium text-text-secondary">
                                Horário (opcional)
                              </span>
                              <Input
                                type="time"
                                value={editHorario}
                                onChange={(e) => setEditHorario(e.target.value)}
                              />
                            </label>
                          </div>
                          <label className="flex flex-col gap-1.5">
                            <span className="text-label font-medium text-text-secondary">
                              Descrição (opcional)
                            </span>
                            <Input
                              value={editDescricao}
                              onChange={(e) => setEditDescricao(e.target.value)}
                            />
                          </label>
                          <div className="flex gap-2">
                            <Button type="submit" disabled={salvandoEdicaoAula}>
                              {salvandoEdicaoAula ? "Salvando..." : "Salvar"}
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              disabled={salvandoEdicaoAula}
                              onClick={() => setEditandoAulaId(null)}
                            >
                              Cancelar
                            </Button>
                          </div>
                        </form>
                      </Card>
                    ) : (
                      <Card key={aula.id} className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-body-sm font-medium text-text-primary">
                            {aula.data}
                            {aula.horario ? ` · ${aula.horario}` : ""}
                          </p>
                          {aula.descricao && (
                            <p className="text-label text-text-muted">{aula.descricao}</p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <button
                            type="button"
                            onClick={() => aoAbrirEdicaoAula(aula)}
                            className="flex items-center gap-1 text-body-sm font-medium text-text-secondary hover:text-text-primary"
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden />
                            Editar
                          </button>
                          <Link
                            to={`/professor/turmas/${id}/aulas/${aula.id}/chamada`}
                            className="text-body-sm font-medium text-primary hover:underline"
                          >
                            Fazer chamada
                          </Link>
                        </div>
                      </Card>
                    ),
                  )}
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
