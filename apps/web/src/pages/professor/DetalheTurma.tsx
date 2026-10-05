import { useEffect, useRef, useState, type FormEvent } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { ResumoDaTurma } from "@/components/turma/ResumoDaTurma";
import { MateriaisDaTurma } from "@/components/diario/MateriaisDaTurma";
import { BloqueiosDoEncerramento } from "@/components/diario/BloqueiosDoEncerramento";
import { SituacaoDaChamada, professorPodeFazerChamada } from "@/components/diario/SituacaoDaChamada";
import { useAuth } from "@/auth";
import { Aviso } from "@/components/Aviso";
import { Abas } from "@/components/Abas";
import { BotaoExportarCsv } from "@/components/BotaoExportarCsv";
import { Button } from "@/components/Button";
import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/Card";
import { GradeNotas } from "@/components/diario/GradeNotas";
import { Esqueleto, EsqueletoCards, EsqueletoTabela, RegiaoCarregando } from "@/components/Esqueleto";
import { ErroConsulta } from "@/components/ErroConsulta";
import { Input } from "@/components/Input";
import { LinkComPrefetch } from "@/components/LinkComPrefetch";
import { PaginaAutenticada } from "@/components/PaginaAutenticada";
import { StatusBadge, textoDoStatusMatricula } from "@/components/StatusBadge";
import { Titulo } from "@/components/Titulo";
import {
  opcoesDiario,
  useAulasDaTurma,
  useAvaliacoesDaTurma,
  useNotasDaTurma,
  useProgressoDaTurma,
} from "@/lib/consultas/diario";
import { useGravacao } from "@/lib/consultas/gravacao";
import { useRealtimeDaTurma } from "@/lib/consultas/realtime";
import { invalidar } from "@/lib/consultas/invalidar";
import { useMatriculasDaTurma, useTurma } from "@/lib/consultas/selecao";
import {
  apagarAula,
  apagarAvaliacao,
  atualizarAula,
  BloqueioAlunoEncerrado,
  calcularDatasRecorrentes,
  criarAula,
  criarAulasEmLote,
  criarAvaliacao,
  encerrarMatricula,
  encerrarTurma,
  filtrarAlunosDoDiario,
  proximaOrdemAvaliacao,
  type AlunoDoDiario,
  type Aula,
  type Avaliacao,
  type ProgressoMatricula,
  type ResumoEncerramentoTurma,
} from "@/lib/diario";
import { plural } from "@/lib/plural";
import { codigoComTurno, PERIODO_TURMA_DATA_MAX, PERIODO_TURMA_DATA_MIN } from "@/lib/selecao";
import { CampoData, CampoHora } from "@/components/CampoData";
import {
  formatarData,
  formatarDiaSemanaData,
  formatarHora,
  formatarMedia,
  formatarPercentual,
  formatarPeriodo,
} from "@/lib/formato";

type Aba = "resumo" | "avaliacoes" | "aulas" | "alunos" | "materiais";
type ModoCriacaoAula = "unica" | "recorrencia";

const SEGUNDOS_PARA_DESFAZER = 8;

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

// Horário vem do banco como "HH:MM:SS" e do input como "HH:MM" — a
// comparação de aula repetida usa só horas e minutos.
function chaveAula(data: string, horario: string | null): string {
  return `${data}|${(horario ?? "").slice(0, 5)}`;
}

interface SituacaoApagarAula {
  temChamada: boolean;
  /** Alunos encerrados com presença nesta aula — o banco bloqueia apagar. */
  encerrados: string[];
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
  // Aceita também os nomes por extenso das abas (ex.: ?aba=chamada,
  // ?aba=notas) além dos valores de sempre.
  // Sem ?aba=, abre no Resumo (aba padrão); os valores antigos continuam.
  const aba: Aba =
    abaParam === "aulas" || abaParam === "chamada"
      ? "aulas"
      : abaParam === "alunos"
        ? "alunos"
        : abaParam === "materiais"
          ? "materiais"
          : abaParam === "avaliacoes" || abaParam === "notas"
          ? "avaliacoes"
          : "resumo";
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
  const gravar = useGravacao();
  const qc = useQueryClient();
  // Tudo que as três abas mostram é lido junto, em paralelo, ao abrir a
  // turma — trocar de aba só troca o que aparece, sem buscar nada. As
  // notas da grade também (mesma entrada de cache que a GradeNotas usa).
  const consultaTurma = useTurma(id);
  const consultaAvaliacoes = useAvaliacoesDaTurma(id);
  const consultaAulas = useAulasDaTurma(id);
  const consultaMatriculas = useMatriculasDaTurma(id);
  const alunosDoDiario = consultaMatriculas.data ? filtrarAlunosDoDiario(consultaMatriculas.data) : undefined;
  // Uma RPC para a turma inteira (antes: três por aluno).
  const progressos = useProgressoDaTurma(id);
  useNotasDaTurma(id, consultaAvaliacoes.data?.map((a) => a.id));
  // Notas lançadas por outra sessão (ex.: coordenação) entram na grade sem recarregar.
  useRealtimeDaTurma(id, consultaAvaliacoes.data?.map((a) => a.id) ?? []);

  const turma = consultaTurma.data;
  const avaliacoes = consultaAvaliacoes.data ?? [];
  const aulas = consultaAulas.data ?? [];
  // A lista de alunos só aparece com o progresso de cada um — sem isso,
  // "Nenhum aluno matriculado" ou médias "—" apareciam durante a carga.
  const alunosCarregados = !!alunosDoDiario && !progressos.pendente;
  const alunos: AlunoComProgresso[] = alunosCarregados
    ? alunosDoDiario.flatMap((a) => {
        const progresso = progressos.porMatricula.get(a.matriculaId);
        return progresso ? [{ ...a, progresso }] : [];
      })
    : [];
  const consultasDaTela = [consultaTurma, consultaAvaliacoes, consultaAulas, consultaMatriculas];
  const erroDeLeitura = consultasDaTela.find((c) => c.isError)?.error ?? progressos.erro;
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  // Avaliação sem notas recém-apagada: "Desfazer" fica disponível por alguns segundos.
  const [apagadaRecentemente, setApagadaRecentemente] = useState<Avaliacao | null>(null);
  const temporizadorDesfazer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(temporizadorDesfazer.current), []);

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
  // Sala (UI Kit, pág. 8: "Aula 12 · Sala 3"): opcional, texto curto.
  const [novaAulaSala, setNovaAulaSala] = useState("");
  const [salvandoAula, setSalvandoAula] = useState(false);

  // Recorrência: gera várias aulas de uma vez (dia(s) da semana + período);
  // exceções pontuais continuam tratadas depois, editando a aula gerada.
  const [diasSelecionados, setDiasSelecionados] = useState<number[]>([]);
  const [recorrenciaInicio, setRecorrenciaInicio] = useState("");
  const [recorrenciaFim, setRecorrenciaFim] = useState("");
  const [recorrenciaHorario, setRecorrenciaHorario] = useState("");
  const [recorrenciaDescricao, setRecorrenciaDescricao] = useState("");
  const [recorrenciaSala, setRecorrenciaSala] = useState("");

  const [editandoAulaId, setEditandoAulaId] = useState<string | null>(null);
  const [editData, setEditData] = useState("");
  const [editHorario, setEditHorario] = useState("");
  const [editDescricao, setEditDescricao] = useState("");
  const [editSala, setEditSala] = useState("");
  const [salvandoEdicaoAula, setSalvandoEdicaoAula] = useState(false);

  const [apagandoAulaId, setApagandoAulaId] = useState<string | null>(null);
  // undefined = ainda consultando as presenças da aula.
  const [situacaoApagarAula, setSituacaoApagarAula] = useState<SituacaoApagarAula | undefined>(undefined);
  const [apagandoAula, setApagandoAula] = useState(false);

  const [encerrandoId, setEncerrandoId] = useState<string | null>(null);
  const [confirmandoEncerrarTurma, setConfirmandoEncerrarTurma] = useState(false);
  const [encerrandoTurma, setEncerrandoTurma] = useState(false);
  const [resumoEncerramento, setResumoEncerramento] = useState<ResumoEncerramentoTurma | null>(null);

  async function aoCriarAvaliacao(evento: FormEvent) {
    evento.preventDefault();
    if (!id) return;
    setErro(null);
    setMensagem(null);
    setSalvandoAvaliacao(true);
    try {
      await gravar(
        async () =>
          criarAvaliacao({
            turmaId: id,
            titulo: novoTitulo,
            descricao: novaDescricao,
            peso: novoPeso,
            ordem: await proximaOrdemAvaliacao(id),
          }),
        (qc) => invalidar.avaliacoes(qc, id),
      );
      setNovoTitulo("");
      setNovaDescricao("");
      setNovoPeso(1);
      setMostrarNovaAvaliacao(false);
      setMensagem("Avaliação criada.");
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
      await gravar(
        () =>
          criarAula({
            turmaId: id,
            data: novaData,
            horario: novoHorario,
            descricao: novaAulaDescricao,
            sala: novaAulaSala,
          }),
        (qc) => invalidar.aulas(qc, id),
      );
      setNovaData("");
      setNovoHorario("");
      setNovaAulaDescricao("");
      setNovaAulaSala("");
      setMostrarNovaAula(false);
      setMensagem("Aula criada.");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível criar a aula.");
    } finally {
      setSalvandoAula(false);
    }
  }

  // Validação de conveniência do período do lote (mesma faixa de ano das
  // turmas). Com erro, nem calcula as datas — um ano digitado pela metade
  // geraria milhares de datas na prévia.
  const erroPeriodoLote = (() => {
    if (!recorrenciaInicio || !recorrenciaFim) return null;
    const foraDaFaixa = (d: string) => d < PERIODO_TURMA_DATA_MIN || d > PERIODO_TURMA_DATA_MAX;
    if (foraDaFaixa(recorrenciaInicio) || foraDaFaixa(recorrenciaFim)) {
      return `Use datas entre ${PERIODO_TURMA_DATA_MIN.slice(0, 4)} e ${PERIODO_TURMA_DATA_MAX.slice(0, 4)}.`;
    }
    if (recorrenciaFim < recorrenciaInicio) return "A data de fim não pode ser anterior à de início.";
    return null;
  })();
  const loteForaDoPeriodoDaTurma =
    !!turma &&
    !erroPeriodoLote &&
    !!recorrenciaInicio &&
    !!recorrenciaFim &&
    (recorrenciaInicio < turma.periodoInicio || recorrenciaFim > turma.periodoFim);

  const datasRecorrencia = erroPeriodoLote
    ? []
    : calcularDatasRecorrentes(diasSelecionados, recorrenciaInicio, recorrenciaFim);
  // Gerar o mesmo lote duas vezes duplicava as aulas: a prévia já desconta
  // as que existem na mesma data e horário, e só as novas são criadas.
  const aulasExistentes = new Set(aulas.map((a) => chaveAula(a.data, a.horario)));
  const datasNovas = datasRecorrencia.filter(
    (d) => !aulasExistentes.has(chaveAula(d, recorrenciaHorario || null)),
  );
  const datasJaExistentes = datasRecorrencia.length - datasNovas.length;

  function alternarDiaSemana(valor: number) {
    setDiasSelecionados((atual) =>
      atual.includes(valor) ? atual.filter((d) => d !== valor) : [...atual, valor],
    );
  }

  async function aoGerarAulas(evento: FormEvent) {
    evento.preventDefault();
    if (!id || datasNovas.length === 0 || erroPeriodoLote) return;
    setErro(null);
    setMensagem(null);
    setSalvandoAula(true);
    try {
      await gravar(
        () =>
          criarAulasEmLote({
            turmaId: id,
            datas: datasNovas,
            horario: recorrenciaHorario,
            descricao: recorrenciaDescricao,
            sala: recorrenciaSala,
          }),
        (qc) => invalidar.aulas(qc, id),
      );
      setDiasSelecionados([]);
      setRecorrenciaInicio("");
      setRecorrenciaFim("");
      setRecorrenciaHorario("");
      setRecorrenciaDescricao("");
      setMostrarNovaAula(false);
      setMensagem(`${plural(datasNovas.length, "aula criada", "aulas criadas")}.`);
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
    setEditSala(aula.sala ?? "");
  }

  async function aoSalvarEdicaoAula(evento: FormEvent) {
    evento.preventDefault();
    if (!editandoAulaId || !id) return;
    setErro(null);
    setMensagem(null);
    setSalvandoEdicaoAula(true);
    try {
      const aulaId = editandoAulaId;
      await gravar(
        () => atualizarAula(aulaId, { data: editData, horario: editHorario, descricao: editDescricao, sala: editSala }),
        (qc) => invalidar.aulas(qc, id, aulaId),
      );
      setEditandoAulaId(null);
      setMensagem("Aula atualizada.");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível atualizar a aula.");
    } finally {
      setSalvandoEdicaoAula(false);
    }
  }

  async function aoPedirApagarAula(aula: Aula) {
    setErro(null);
    setMensagem(null);
    setEditandoAulaId(null);
    setApagandoAulaId(aula.id);
    setSituacaoApagarAula(undefined);
    try {
      // staleTime 0: a decisão de apagar precisa da chamada atual, não do cache.
      const presencas = await qc.fetchQuery({ ...opcoesDiario.presencas(aula.id), staleTime: 0 });
      const encerrados = alunos
        .filter(
          (a) => (a.status === "concluida" || a.status === "reprovada") && presencas.has(a.matriculaId),
        )
        .map((a) => a.alunoNome);
      setSituacaoApagarAula({ temChamada: presencas.size > 0, encerrados });
    } catch (e) {
      setApagandoAulaId(null);
      setErro(e instanceof Error ? e.message : "Não foi possível verificar a chamada da aula.");
    }
  }

  async function aoConfirmarApagarAula(aulaId: string) {
    if (!id) return;
    setErro(null);
    setMensagem(null);
    setApagandoAula(true);
    try {
      await gravar(() => apagarAula(aulaId), (qc) => invalidar.aulas(qc, id, aulaId));
      setApagandoAulaId(null);
      setMensagem("Aula apagada.");
    } catch (e) {
      if (e instanceof BloqueioAlunoEncerrado) setApagandoAulaId(null);
      setErro(e instanceof Error ? e.message : "Não foi possível apagar a aula.");
    } finally {
      setApagandoAula(false);
    }
  }

  async function aoApagarAvaliacao(avaliacao: Avaliacao, podeDesfazer: boolean) {
    if (!id) return;
    setMensagem(null);
    await gravar(() => apagarAvaliacao(avaliacao.id), (qc) => invalidar.avaliacoes(qc, id));
    if (podeDesfazer) {
      window.clearTimeout(temporizadorDesfazer.current);
      setApagadaRecentemente(avaliacao);
      temporizadorDesfazer.current = window.setTimeout(() => setApagadaRecentemente(null), SEGUNDOS_PARA_DESFAZER * 1000);
    } else {
      setApagadaRecentemente(null);
      setMensagem(`Avaliação ${avaliacao.titulo} apagada.`);
    }
  }

  // "Desfazer" recria a avaliação com o mesmo título, descrição, peso e
  // ordem (só existe para avaliação sem notas — nada mais se perdeu). Se
  // outra avaliação já ocupou a ordem nesse meio-tempo, vai para o fim.
  async function aoDesfazerApagar() {
    const avaliacao = apagadaRecentemente;
    if (!id || !avaliacao) return;
    window.clearTimeout(temporizadorDesfazer.current);
    setApagadaRecentemente(null);
    setErro(null);
    const recriar = (ordem: number) =>
      criarAvaliacao({
        turmaId: id,
        titulo: avaliacao.titulo,
        descricao: avaliacao.descricao ?? "",
        peso: avaliacao.peso,
        ordem,
      });
    try {
      await gravar(
        async () => {
          try {
            return await recriar(avaliacao.ordem);
          } catch (e) {
            if (e instanceof Error && e.message.includes("nessa posição")) {
              return recriar(await proximaOrdemAvaliacao(id));
            }
            throw e;
          }
        },
        (qc) => invalidar.avaliacoes(qc, id),
      );
      setMensagem(`Avaliação ${avaliacao.titulo} restaurada.`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível restaurar a avaliação.");
    }
  }

  async function aoEncerrar(matriculaId: string) {
    if (!id) return;
    setErro(null);
    setMensagem(null);
    setEncerrandoId(matriculaId);
    try {
      await gravar(() => encerrarMatricula(matriculaId), (qc) => invalidar.matriculas(qc, id));
      setMensagem("Resultado do aluno lançado.");
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
      const resumo = await gravar(() => encerrarTurma(id), (qc) => invalidar.matriculas(qc, id));
      setResumoEncerramento(resumo);
      setConfirmandoEncerrarTurma(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível encerrar a turma.");
    } finally {
      setEncerrandoTurma(false);
    }
  }

  if (!usuario) return null;

  // Peso não tem teto (decisão de manter flexibilidade) — mostrar quanto
  // cada avaliação representa da média final deixa o efeito prático claro
  // sem impor limite. Recalcula sozinho porque `avaliacoes` é estado. O
  // texto precisa dizer que o peso é relativo: com a primeira avaliação o
  // percentual é sempre 100%, o que parecia erro.
  const somaPesos = avaliacoes.reduce((soma, a) => soma + a.peso, 0);
  function percentualDoPeso(peso: number, somaTotal: number): number {
    return somaTotal > 0 ? Math.round((peso / somaTotal) * 100) : 0;
  }

  return (
    // pág. 9 — cabeçalho com "Minhas turmas / CÓDIGO", nome do módulo e as
    // abas dentro da faixa; a trilha de navegação substitui o "Voltar".
    <PaginaAutenticada
      sobrelinha={
        <span>
          <LinkComPrefetch to="/professor/turmas" className="hover:text-text-primary hover:underline">
            Minhas turmas
          </LinkComPrefetch>
          {turma ? ` / ${codigoComTurno(turma.codigo, turma.turno)}` : ""}
        </span>
      }
      titulo={turma?.moduloNome}
      subtitulo={
        turma
          ? `${turma.trilhaNome} · ${formatarPeriodo(turma.periodoInicio, turma.periodoFim)}`
          : undefined
      }
      abas={
        turma ? (
          <Abas<Aba>
            rotulo="Seções da turma"
            ativa={aba}
            aoTrocar={mudarAba}
            abas={[
              { valor: "resumo", rotulo: "Resumo" },
              { valor: "aulas", rotulo: "Aulas e chamada" },
              { valor: "avaliacoes", rotulo: "Avaliações e notas" },
              { valor: "alunos", rotulo: "Alunos", contador: alunosCarregados ? alunos.length : undefined },
              { valor: "materiais", rotulo: "Materiais" },
            ]}
          />
        ) : undefined
      }
    >
        {erro && (
          <Aviso variant="danger" className="mb-4">
            {erro}
          </Aviso>
        )}
        {erroDeLeitura && (
          <ErroConsulta
            className="mb-4"
            erro={erroDeLeitura}
            padrao="Não foi possível carregar a turma."
            tentarDeNovo={() => {
              consultasDaTela.forEach((c) => c.isError && void c.refetch());
              progressos.tentarDeNovo();
            }}
          />
        )}
        {mensagem && (
          <Aviso variant="success" className="mb-4">
            {mensagem}
          </Aviso>
        )}
        {apagadaRecentemente && (
          <Aviso variant="success" className="mb-4 flex flex-wrap items-center justify-between gap-3" role="status">
            <span>Avaliação {apagadaRecentemente.titulo} apagada.</span>
            <button
              type="button"
              onClick={() => void aoDesfazerApagar()}
              className="font-medium underline hover:no-underline"
            >
              Desfazer
            </button>
          </Aviso>
        )}

        {consultaTurma.isPending && !erroDeLeitura && (
          <RegiaoCarregando className="mb-6 flex flex-col gap-2 rounded-klass-card border border-border bg-surface px-klass-card-x py-6">
            <Esqueleto className="h-8 w-40" />
            <Esqueleto className="h-4 w-64" />
            <Esqueleto className="h-3 w-48" />
          </RegiaoCarregando>
        )}
        {turma === null && <p className="text-body-sm text-text-secondary">Turma não encontrada.</p>}

        {turma && (
          <>
            {aba === "avaliacoes" && (
              <>
                {/* Com avaliações, "Nova avaliação" vai para a linha dos chips
                    da grade (pág. 9); sem nenhuma, fica sozinho aqui. */}
                <h2 className="sr-only">Avaliações e notas</h2>
                {avaliacoes.length === 0 && (
                  <div className="mb-4 flex justify-end">
                    <Button onClick={() => setMostrarNovaAvaliacao((v) => !v)}>
                      {mostrarNovaAvaliacao ? "Cancelar" : "Nova avaliação"}
                    </Button>
                  </div>
                )}

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
                          {avaliacoes.length === 0
                            ? "O peso é relativo às outras avaliações da turma. Como esta é a primeira, por enquanto ela vale 100% da média final; o percentual diminui quando outras forem criadas."
                            : `O peso é relativo à soma dos pesos da turma: com as avaliações de hoje, esta valerá ${percentualDoPeso(novoPeso, somaPesos + novoPeso)}% da média final. O percentual muda quando outras avaliações forem criadas.`}
                        </span>
                      </label>
                      <Button type="submit" disabled={salvandoAvaliacao} className="self-start">
                        {salvandoAvaliacao ? "Criando..." : "Criar"}
                      </Button>
                    </form>
                  </Card>
                )}

                {consultaAvaliacoes.isPending && <EsqueletoTabela linhas={3} colunas={6} />}
                {consultaAvaliacoes.data?.length === 0 && (
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
                    acoes={
                      <Button onClick={() => setMostrarNovaAvaliacao((v) => !v)}>
                        {mostrarNovaAvaliacao ? "Cancelar" : "Nova avaliação"}
                      </Button>
                    }
                  />
                )}
              </>
            )}

            {aba === "resumo" && <ResumoDaTurma turma={turma} papel="professor" />}

            {aba === "materiais" && (
              <>
                <h2 className="sr-only">Materiais</h2>
                <MateriaisDaTurma turmaId={turma.id} modo="gestao" />
              </>
            )}

            {aba === "aulas" && (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <Titulo nivel="secao">
                    Aulas{consultaAulas.data ? ` (${aulas.length})` : ""}
                  </Titulo>
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
                        <div className="flex flex-col gap-4 sm:flex-row">
                          <CampoData
                            className="flex-1"
                            rotulo="Data"
                            obrigatorio
                            valor={novaData}
                            aoMudar={setNovaData}
                          />
                          <CampoHora
                            className="flex-1"
                            rotulo="Horário (opcional)"
                            valor={novoHorario}
                            aoMudar={setNovoHorario}
                          />
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
                        <label className="flex flex-col gap-1.5">
                          <span className="text-label font-medium text-text-secondary">Sala (opcional)</span>
                          <Input
                            maxLength={40}
                            placeholder="Ex.: Sala 3"
                            value={novaAulaSala}
                            onChange={(e) => setNovaAulaSala(e.target.value)}
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
                                    ? "border-text-primary bg-text-primary text-primary-contraste"
                                    : "border-border bg-surface text-text-secondary"
                                }`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex flex-col gap-4 sm:flex-row">
                          <CampoData
                            className="flex-1"
                            rotulo="Data de início"
                            obrigatorio
                            min={PERIODO_TURMA_DATA_MIN}
                            max={PERIODO_TURMA_DATA_MAX}
                            valor={recorrenciaInicio}
                            aoMudar={setRecorrenciaInicio}
                          />
                          <CampoData
                            className="flex-1"
                            rotulo="Data de fim"
                            obrigatorio
                            min={PERIODO_TURMA_DATA_MIN}
                            max={PERIODO_TURMA_DATA_MAX}
                            valor={recorrenciaFim}
                            aoMudar={setRecorrenciaFim}
                          />
                          <CampoHora
                            className="flex-1"
                            rotulo="Horário (opcional)"
                            valor={recorrenciaHorario}
                            aoMudar={setRecorrenciaHorario}
                          />
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
                        <label className="flex flex-col gap-1.5">
                          <span className="text-label font-medium text-text-secondary">Sala (opcional, aplicada a todas)</span>
                          <Input
                            maxLength={40}
                            placeholder="Ex.: Sala 3"
                            value={recorrenciaSala}
                            onChange={(e) => setRecorrenciaSala(e.target.value)}
                          />
                        </label>
                        {erroPeriodoLote && (
                          <p className="text-label font-medium text-danger">{erroPeriodoLote}</p>
                        )}
                        {loteForaDoPeriodoDaTurma && turma && (
                          <p className="text-label text-text-secondary">
                            Atenção: o período escolhido sai do período da turma (
                            {formatarPeriodo(turma.periodoInicio, turma.periodoFim)}).
                          </p>
                        )}
                        <p className="text-label text-text-muted">
                          {datasRecorrencia.length === 0
                            ? erroPeriodoLote
                              ? ""
                              : "Escolha ao menos um dia da semana e o período."
                            : datasNovas.length === 0
                              ? `${datasJaExistentes === 1 ? "A aula já existe" : `As ${datasJaExistentes} aulas já existem`} nessa data e horário; nada será criado.`
                              : datasJaExistentes === 0
                                ? `${plural(datasNovas.length, "aula será criada", "aulas serão criadas")}.`
                                : `${plural(datasNovas.length, "aula será criada", "aulas serão criadas")}; ${plural(datasJaExistentes, "já existe e será ignorada", "já existem e serão ignoradas")}.`}
                        </p>
                        <Button
                          type="submit"
                          disabled={salvandoAula || datasNovas.length === 0 || !!erroPeriodoLote}
                          className="self-start"
                        >
                          {salvandoAula ? "Gerando..." : "Gerar aulas"}
                        </Button>
                      </form>
                    )}
                  </Card>
                )}

                <div className="flex flex-col gap-2">
                  {consultaAulas.isPending && <EsqueletoCards quantidade={4} altura="h-16" />}
                  {consultaAulas.data?.length === 0 && (
                    <p className="text-body-sm text-text-secondary">Nenhuma aula cadastrada ainda.</p>
                  )}
                  {aulas.map((aula) =>
                    apagandoAulaId === aula.id ? (
                      <Card key={aula.id} className="flex flex-col gap-3">
                        {situacaoApagarAula === undefined ? (
                          <p className="text-body-sm text-text-secondary">Verificando a chamada da aula...</p>
                        ) : situacaoApagarAula.temChamada && aula.situacao_chamada === "encerrada" ? (
                          <>
                            <p className="text-body-sm text-text-primary">
                              A aula de <strong>{formatarData(aula.data)}</strong> tem chamada e o prazo
                              para alterá-la terminou. Para apagá-la, peça à coordenação para liberar a
                              chamada desta aula.
                            </p>
                            <Button
                              variant="secondary"
                              className="self-start"
                              onClick={() => setApagandoAulaId(null)}
                            >
                              Fechar
                            </Button>
                          </>
                        ) : situacaoApagarAula.encerrados.length > 0 ? (
                          <>
                            <p className="text-body-sm text-text-primary">
                              A aula de <strong>{formatarData(aula.data)}</strong> não pode ser apagada: a chamada dela
                              inclui{" "}
                              {situacaoApagarAula.encerrados.length === 1
                                ? "um aluno já encerrado"
                                : "alunos já encerrados"}{" "}
                              ({situacaoApagarAula.encerrados.join(", ")}). O histórico de quem já foi
                              aprovado ou reprovado não muda. Para apagá-la, peça à coordenação para
                              desfazer o encerramento{" "}
                              {situacaoApagarAula.encerrados.length === 1 ? "desse aluno" : "desses alunos"}.
                            </p>
                            <Button
                              variant="secondary"
                              className="self-start"
                              onClick={() => setApagandoAulaId(null)}
                            >
                              Fechar
                            </Button>
                          </>
                        ) : (
                          <>
                            <p className="text-body-sm text-text-primary">
                              Apagar a aula de <strong>{formatarData(aula.data)}</strong>
                              {aula.horario ? ` · ${formatarHora(aula.horario)}` : ""}?
                              {situacaoApagarAula.temChamada && (
                                <>
                                  {" "}
                                  <span className="font-medium text-danger">
                                    A chamada já feita nesta aula será apagada junto.
                                  </span>
                                </>
                              )}
                            </p>
                            <div className="flex gap-2">
                              <Button disabled={apagandoAula} onClick={() => void aoConfirmarApagarAula(aula.id)}>
                                {apagandoAula ? "Apagando..." : "Apagar aula"}
                              </Button>
                              <Button
                                variant="secondary"
                                disabled={apagandoAula}
                                onClick={() => setApagandoAulaId(null)}
                              >
                                Cancelar
                              </Button>
                            </div>
                          </>
                        )}
                      </Card>
                    ) : editandoAulaId === aula.id ? (
                      <Card key={aula.id}>
                        <form className="flex flex-col gap-3" onSubmit={aoSalvarEdicaoAula}>
                          <div className="flex flex-col gap-4 sm:flex-row">
                            <CampoData
                              className="flex-1"
                              rotulo="Data"
                              obrigatorio
                              valor={editData}
                              aoMudar={setEditData}
                            />
                            <CampoHora
                              className="flex-1"
                              rotulo="Horário (opcional)"
                              valor={editHorario}
                              aoMudar={setEditHorario}
                            />
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
                        <label className="flex flex-col gap-1.5">
                          <span className="text-label font-medium text-text-secondary">Sala (opcional)</span>
                          <Input
                            maxLength={40}
                            placeholder="Ex.: Sala 3"
                            value={editSala}
                            onChange={(e) => setEditSala(e.target.value)}
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
                      // flex-wrap: no celular as ações descem para baixo da data
                      // em vez de vazar do card.
                      <Card key={aula.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                        <div>
                          <p className="text-body-sm font-medium text-text-primary">
                            {formatarDiaSemanaData(aula.data, true)}
                            {aula.horario ? ` · ${formatarHora(aula.horario)}` : ""}
                            {aula.sala ? ` · ${aula.sala}` : ""}
                          </p>
                          {aula.descricao && (
                            <p className="text-label text-text-muted">{aula.descricao}</p>
                          )}
                          <div className="mt-1">
                            <SituacaoDaChamada aula={aula} />
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                          <button
                            type="button"
                            onClick={() => aoAbrirEdicaoAula(aula)}
                            className="flex items-center gap-1 text-body-sm font-medium text-text-secondary hover:text-text-primary"
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden />
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => void aoPedirApagarAula(aula)}
                            className="flex items-center gap-1 text-body-sm font-medium text-text-secondary hover:text-danger"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden />
                            Apagar
                          </button>
                          {/* Aula futura: ainda não há chamada a fazer. Prazo
                              encerrado: a chamada abre só para consulta. */}
                          {aula.situacao_chamada !== "futura" && (
                            <LinkComPrefetch
                              to={`/professor/turmas/${id}/aulas/${aula.id}/chamada`}
                              className="text-body-sm font-medium text-primary hover:underline"
                            >
                              {professorPodeFazerChamada(aula) ? "Fazer chamada" : "Ver chamada"}
                            </LinkComPrefetch>
                          )}
                        </div>
                      </Card>
                    ),
                  )}
                </div>
              </>
            )}

            {aba === "alunos" && (
              <>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                  <Titulo nivel="secao">
                    Alunos{alunosCarregados ? ` (${alunos.length})` : ""}
                  </Titulo>
                  <div className="flex flex-wrap items-center gap-2">
                  {turma && (
                    <BotaoExportarCsv
                      nome={["alunos", turma.codigo]}
                      rotulo={`Exportar alunos da turma ${turma.codigo} em CSV`}
                      linhas={alunos}
                      colunas={[
                        { titulo: "Aluno", valor: (a) => a.alunoNome },
                        { titulo: "Situação", valor: (a) => textoDoStatusMatricula(a.status) },
                        { titulo: "Média", valor: (a) => (a.progresso.media !== null ? formatarMedia(a.progresso.media) : null) },
                        {
                          titulo: "Frequência (%)",
                          valor: (a) => (a.progresso.frequencia !== null ? Math.trunc(a.progresso.frequencia) : null),
                        },
                      ]}
                    />
                  )}
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
                </div>

                {id && alunos.some((a) => a.status === "matriculada" && !a.progresso.prontoParaEncerrar) && (
                  <BloqueiosDoEncerramento
                    turmaId={id}
                    aulas={aulas}
                    avaliacoes={avaliacoes}
                    matriculasAtivas={alunos.filter((a) => a.status === "matriculada").map((a) => a.matriculaId)}
                    aoVerAulas={() => mudarAba("aulas")}
                    aoVerNotas={() => mudarAba("avaliacoes")}
                  />
                )}

                {/* Ação de nível de turma, separada dos botões por aluno abaixo. */}
                {confirmandoEncerrarTurma && (
                  <Card className="mb-4 flex flex-col gap-3">
                    <p className="text-body-sm text-text-secondary">
                      Isto encerra de uma vez todos os alunos matriculados — cada um é aprovado ou
                      reprovado pelos próprios critérios de nota e frequência. Quem ainda estiver sem
                      todas as notas ou chamadas é pulado e continua matriculado (veja “O que impede encerrar”,
                      acima, quando houver). Encerrar a turma
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
                    Encerramento concluído:{" "}
                    {plural(resumoEncerramento.aprovadas, "aprovado", "aprovados")},{" "}
                    {plural(resumoEncerramento.reprovadas, "reprovado", "reprovados")}
                    {resumoEncerramento.puladas > 0
                      ? `, ${plural(resumoEncerramento.puladas, "pulado", "pulados")} (faltam notas ou chamadas)`
                      : ""}
                    .
                  </Aviso>
                )}

                <div className="flex flex-col gap-2">
                  {!alunosCarregados && !erroDeLeitura && <EsqueletoCards quantidade={3} altura="h-16" />}
                  {alunosCarregados && alunos.length === 0 && (
                    <p className="text-body-sm text-text-secondary">
                      Nenhum aluno matriculado ainda.
                    </p>
                  )}
                {alunos.map((aluno) => {
                  const motivoDesabilitado =
                    aluno.status === "matriculada" && !aluno.progresso.prontoParaEncerrar
                      ? "Ainda não pode ser encerrado: falta nota ou presença — veja “O que impede encerrar” acima."
                      : undefined;
                  const idMotivo = `motivo-encerrar-${aluno.matriculaId}`;
                  return (
                    <Card key={aluno.matriculaId} className="flex items-center justify-between gap-4">
                      <div className="flex min-w-0 items-start gap-3">
                        <Avatar nome={aluno.alunoNome} />
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-body-sm font-medium text-text-primary">
                              {aluno.alunoNome}
                            </span>
                            <StatusBadge tipo="matricula" status={aluno.status} />
                          </div>
                          <span className="text-label text-text-muted">
                            Média:{" "}
                            {aluno.progresso.media !== null ? formatarMedia(aluno.progresso.media) : "—"}{" "}
                            · Frequência:{" "}
                            {aluno.progresso.frequencia !== null
                              ? formatarPercentual(aluno.progresso.frequencia)
                              : "—"}
                          </span>
                          {motivoDesabilitado && (
                            <span id={idMotivo} className="text-label text-text-secondary">
                              {motivoDesabilitado}
                            </span>
                          )}
                        </div>
                      </div>
                      {aluno.status === "matriculada" && (
                        <Button
                          variant="secondary"
                          disabled={
                            !aluno.progresso.prontoParaEncerrar || encerrandoId === aluno.matriculaId
                          }
                          title={motivoDesabilitado}
                          aria-describedby={motivoDesabilitado ? idMotivo : undefined}
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
