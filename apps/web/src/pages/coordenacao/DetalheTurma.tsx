import { useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Check, X } from "lucide-react";
import { Abas } from "@/components/Abas";
import { Aviso } from "@/components/Aviso";
import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import { BotaoExportarCsv } from "@/components/BotaoExportarCsv";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { MateriaisDaTurma } from "@/components/diario/MateriaisDaTurma";
import { Esqueleto, EsqueletoCards, RegiaoCarregando } from "@/components/Esqueleto";
import { ErroConsulta } from "@/components/ErroConsulta";
import { LinkBotao } from "@/components/LinkBotao";
import { LinkComPrefetch } from "@/components/LinkComPrefetch";
import { PaginaAutenticada } from "@/components/PaginaAutenticada";
import { StatusBadge, textoDoStatusMatricula } from "@/components/StatusBadge";
import { Titulo } from "@/components/Titulo";
import { useAuth } from "@/auth";
import { useModulosDaTrilha } from "@/lib/consultas/catalogo";
import {
  useAulasDaTurma,
  useAvaliacoesDaTurma,
  useHistoricoEncerramentos,
  useProgressoDaTurma,
  useProgressos,
} from "@/lib/consultas/diario";
import { ResumoDaTurma } from "@/components/turma/ResumoDaTurma";
import { HistoricoDeEncerramento } from "@/components/turma/HistoricoDeEncerramento";
import { SituacaoDaChamada } from "@/components/diario/SituacaoDaChamada";
import { flexionar, plural } from "@/lib/plural";
import { useGravacao } from "@/lib/consultas/gravacao";
import { invalidar } from "@/lib/consultas/invalidar";
import {
  useMatriculasDaTurma,
  useMatriculasDoAluno,
  usePreRequisitosDasInscricoes,
  useTurma,
} from "@/lib/consultas/selecao";
import {
  desfazerEncerramento,
  filtrarAlunosDoDiario,
  liberarChamada,
  reativarTurma,
  type AlunoDoDiario,
  type ProgressoMatricula,
  type RegistroDeEncerramento,
  type ResumoReativacaoTurma,
} from "@/lib/diario";
import {
  formatarData,
  formatarDataHora,
  formatarDiaMes,
  formatarHora,
  formatarMedia,
  formatarPercentual,
  formatarPeriodo,
} from "@/lib/formato";
import {
  aprovarMatricula,
  codigoComTurno,
  rejeitarMatricula,
  removerAlunoDaTurma,
  type MatriculaListagem,
  type SituacaoPreRequisitos,
  type TurmaDetalhada,
} from "@/lib/selecao";

interface AlunoComProgresso extends AlunoDoDiario {
  progresso: ProgressoMatricula;
}

type AbaTurma = "resumo" | "inscricoes" | "alunos" | "aulas" | "avaliacoes" | "materiais";

const CLASSE_TEXTAREA =
  "rounded-klass-control border border-controle bg-surface px-3.5 py-2 text-body-sm text-text-primary transition focus:border-primary";

// O banco exige motivo de rejeição/remoção com pelo menos 10 caracteres.
const MOTIVO_MINIMO = 10;

/** "2026-09-21T09:14:..." → "21/09 09:14" (coluna "Inscrito em"). */
function dataHoraCurta(iso: string): string {
  return `${formatarDiaMes(iso)} ${formatarHora(iso)}`;
}

function BadgePreRequisitos({ situacao }: { situacao: SituacaoPreRequisitos | undefined }) {
  if (!situacao) return <span className="text-body-sm text-text-secondary">Verificando…</span>;
  if (situacao.cumpridos) {
    return (
      <Badge variant="contorno">
        <Check className="h-3.5 w-3.5" aria-hidden />
        Cumpridos
      </Badge>
    );
  }
  return (
    <Badge variant="tracejado" quebraLinha>
      <X className="h-3.5 w-3.5 shrink-0" aria-hidden />
      Pendente: {situacao.pendentes}
    </Badge>
  );
}

// D14 (klass-uikit.pdf, pág. 11) — painel lateral (não modal: a lista
// continua usável ao lado) com o histórico do aluno na trilha da turma.
function PainelInscricao({
  matricula,
  turma,
  preRequisitos,
  processando,
  aoFechar,
  aoAprovar,
  aoRejeitar,
}: {
  matricula: MatriculaListagem;
  turma: TurmaDetalhada;
  preRequisitos: SituacaoPreRequisitos | undefined;
  processando: boolean;
  aoFechar: () => void;
  aoAprovar: () => void;
  aoRejeitar: (motivo: string) => Promise<boolean>;
}) {
  const consultaMatriculas = useMatriculasDoAluno(matricula.alunoId);
  const consultaModulos = useModulosDaTrilha(turma.trilhaId);
  const naTrilha = (consultaMatriculas.data ?? []).filter(
    (m) => m.trilhaId === turma.trilhaId && m.id !== matricula.id,
  );
  const progressos = useProgressos(naTrilha.map((m) => m.id));
  const [rejeitando, setRejeitando] = useState(false);
  const [motivo, setMotivo] = useState("");

  // Uma linha por módulo da trilha em que o aluno tem ou teve matrícula
  // (a mais recente, se houver mais de uma).
  const porModulo = new Map<string, (typeof naTrilha)[number]>();
  for (const m of naTrilha) if (!porModulo.has(m.moduloId)) porModulo.set(m.moduloId, m);
  const linhas = (consultaModulos.data ?? []).flatMap((modulo) => {
    const m = porModulo.get(modulo.id);
    return m ? [{ modulo, matricula: m, progresso: progressos.porMatricula.get(m.id) }] : [];
  });
  const carregando = consultaMatriculas.isPending || consultaModulos.isPending || progressos.pendente;
  const erro = consultaMatriculas.error ?? consultaModulos.error ?? progressos.erro;

  return (
    <aside
      aria-label={`Inscrição de ${matricula.alunoNome}`}
      className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-border bg-surface md:w-klass-painel"
    >
      <div className="flex justify-end p-4">
        <Button variant="secondary" className="!h-10 !w-10 !px-0" aria-label="Fechar painel" onClick={aoFechar}>
          <X className="h-5 w-5" aria-hidden />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="mb-6 flex items-center gap-4">
          <Avatar nome={matricula.alunoNome} tamanho="grande" />
          <div className="min-w-0">
            <h2 className="break-words text-klass-lg text-text-primary">{matricula.alunoNome}</h2>
            <p className="text-body-sm text-text-secondary">
              Inscrito em {formatarDataHora(matricula.criadoEm)}
            </p>
          </div>
        </div>

        <p className="mb-2 flex items-center gap-2 text-body-sm text-text-secondary">
          Pré-requisitos: <BadgePreRequisitos situacao={preRequisitos} />
        </p>

        <h3 className="mb-1 mt-4 text-klass-md font-semibold text-text-primary">Histórico na trilha</h3>
        {erro && <p className="text-body-sm text-text-secondary">Não foi possível carregar o histórico.</p>}
        {carregando && !erro && <EsqueletoCards quantidade={2} altura="h-10" />}
        {!carregando && !erro && linhas.length === 0 && (
          <p className="text-body-sm text-text-secondary">Primeira matrícula nesta trilha.</p>
        )}
        <div className="flex flex-col divide-y divide-border">
          {linhas.map(({ modulo, matricula: m, progresso }) => (
            <div key={modulo.id} className="flex items-center justify-between gap-3 py-2.5">
              <span className="min-w-0 text-body-sm text-text-primary">{modulo.nome}</span>
              <span className="flex shrink-0 items-center gap-2">
                {progresso?.media !== null && progresso?.media !== undefined && (
                  <span className="font-mono text-body-sm font-semibold tabular-nums">
                    {formatarMedia(progresso.media)}
                  </span>
                )}
                <StatusBadge tipo="matricula" status={m.status} />
              </span>
            </div>
          ))}
        </div>

        <p className="mt-4 rounded-klass-card border border-dashed border-controle px-4 py-3 text-body-sm text-text-secondary">
          Ao aprovar, o aluno recebe um e-mail de confirmação e a matrícula aparece para ele na hora.
        </p>

        {rejeitando && (
          <label className="mt-4 flex flex-col gap-1.5">
            <span className="text-label font-medium text-text-secondary">Motivo da rejeição</span>
            <textarea
              required
              rows={3}
              className={CLASSE_TEXTAREA}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </label>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 border-t border-border p-4">
        {rejeitando ? (
          <>
            <Button variant="secondary" disabled={processando} onClick={() => setRejeitando(false)}>
              Cancelar
            </Button>
            <Button
              disabled={motivo.trim().length < MOTIVO_MINIMO || processando}
              onClick={() => void aoRejeitar(motivo).then((ok) => ok && setRejeitando(false))}
            >
              Confirmar rejeição
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" disabled={processando} onClick={() => setRejeitando(true)}>
              Rejeitar
            </Button>
            <Button disabled={processando} onClick={aoAprovar}>
              Aprovar
            </Button>
          </>
        )}
      </div>
    </aside>
  );
}

export function DetalheTurma() {
  const { id } = useParams<{ id: string }>();
  const { usuario } = useAuth();
  const gravar = useGravacao();
  // A aba mora na URL (?aba=), como na turma do professor.
  const [searchParams, setSearchParams] = useSearchParams();
  const abaParam = searchParams.get("aba");
  const aba: AbaTurma =
    abaParam === "inscricoes" ||
    abaParam === "alunos" ||
    abaParam === "aulas" ||
    abaParam === "avaliacoes" ||
    abaParam === "materiais"
      ? abaParam
      : // Sem ?aba=, abre no Resumo (aba padrão); os valores antigos continuam.
        "resumo";
  function mudarAba(valor: AbaTurma) {
    setSearchParams(
      (atual) => {
        const proximo = new URLSearchParams(atual);
        proximo.set("aba", valor);
        return proximo;
      },
      { replace: true },
    );
  }

  // Uma lista de matrículas alimenta inscrições, matriculados, histórico e
  // o diário (antes eram duas buscas da mesma tabela); tudo em paralelo.
  const consultaTurma = useTurma(id);
  const consultaMatriculas = useMatriculasDaTurma(id);
  const consultaAvaliacoes = useAvaliacoesDaTurma(id);
  const consultaAulas = useAulasDaTurma(id);
  const alunosDoDiario = consultaMatriculas.data ? filtrarAlunosDoDiario(consultaMatriculas.data) : undefined;
  // Uma RPC para a turma inteira (antes: três por aluno).
  const progressos = useProgressoDaTurma(id);
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
  // Desfazer/reativar pedem motivo (o banco exige 10+ caracteres e grava
  // no histórico, junto com quem fez e quando).
  const [motivoDesfazer, setMotivoDesfazer] = useState("");
  const [motivoReativar, setMotivoReativar] = useState("");
  // Resumo da última reativação: fica na tela porque lista quem foi pulado
  // e por quê (sem vaga, matrícula ativa em outra turma).
  const [resumoReativacao, setResumoReativacao] = useState<ResumoReativacaoTurma | null>(null);

  const consultaHistorico = useHistoricoEncerramentos(id);
  const historicoPorMatricula = new Map<string, RegistroDeEncerramento[]>();
  for (const r of consultaHistorico.data ?? []) {
    const lista = historicoPorMatricula.get(r.matricula_id) ?? [];
    lista.push(r);
    historicoPorMatricula.set(r.matricula_id, lista);
  }

  // Aba de inscrições: seleção múltipla, rejeição em lote e painel lateral.
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [rejeitandoLote, setRejeitandoLote] = useState(false);
  const [motivoLote, setMotivoLote] = useState("");
  const [abertaId, setAbertaId] = useState<string | null>(null);

  const pendentes = matriculas.filter((m) => m.status === "inscrita");
  const matriculados = matriculas.filter((m) => m.status === "matriculada");
  const historico = matriculas.filter((m) =>
    ["rejeitada", "cancelada", "concluida", "reprovada"].includes(m.status),
  );
  // Reativar turma só faz sentido quando há matrícula encerrada (concluída
  // ou reprovada) — rejeitada/cancelada não voltam por aqui.
  const temEncerradas = matriculas.some((m) => m.status === "concluida" || m.status === "reprovada");

  const preRequisitos = usePreRequisitosDasInscricoes(
    pendentes.map((m) => m.alunoId),
    turma?.moduloId,
  );
  const situacaoDe = (m: MatriculaListagem) => preRequisitos.get(m.alunoId)?.data;

  // "Vagas após aprovar" (pág. 11): vagas livres hoje, descontando uma a
  // uma as inscrições aptas, na ordem de chegada. Inscrição com
  // pré-requisito pendente não consome vaga ("—").
  let vagasLivres = turma ? turma.vagasTotal - matriculados.length : 0;
  const vagasApos = new Map<string, number | null>();
  for (const m of pendentes) {
    if (situacaoDe(m)?.cumpridos) {
      vagasLivres -= 1;
      vagasApos.set(m.id, vagasLivres);
    } else vagasApos.set(m.id, null);
  }

  // Só ids ainda pendentes contam (uma aprovação pelo painel tira a linha).
  const selecionadasValidas = pendentes.filter((m) => selecionadas.has(m.id));
  const aptasSelecionadas = selecionadasValidas.filter((m) => situacaoDe(m)?.cumpridos);
  const todasSelecionadas = pendentes.length > 0 && selecionadasValidas.length === pendentes.length;
  const aberta = pendentes.find((m) => m.id === abertaId) ?? null;

  function alternarSelecao(matriculaId: string) {
    setSelecionadas((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(matriculaId)) proximo.delete(matriculaId);
      else proximo.add(matriculaId);
      return proximo;
    });
  }

  function iniciarAcao() {
    setErro(null);
    setMensagem(null);
    setProcessando(true);
  }

  // Aprovar/rejeitar em lote usam as mesmas funções da ação individual,
  // uma matrícula por vez, numa gravação só (um "Salvando…", uma
  // invalidação no fim). Se uma falhar, as anteriores ficam feitas e o
  // aviso diz quantas passaram.
  async function aprovar(alvos: MatriculaListagem[]) {
    if (!usuario || !id || processando || alvos.length === 0) return;
    iniciarAcao();
    let feitas = 0;
    try {
      await gravar(
        async () => {
          for (const m of alvos) {
            await aprovarMatricula(m.id, usuario.id);
            feitas += 1;
          }
        },
        (qc) => invalidar.matriculas(qc, id),
      );
      setMensagem(
        `${plural(feitas, "matrícula aprovada", "matrículas aprovadas")} — ${flexionar(feitas, "o aluno recebe", "cada aluno recebe")} um e-mail de confirmação.`,
      );
      setSelecionadas(new Set());
      setAbertaId(null);
    } catch (e) {
      const motivo = e instanceof Error ? e.message : "Não foi possível aprovar.";
      setErro(feitas > 0 ? `${plural(feitas, "matrícula aprovada", "matrículas aprovadas")}; a seguinte falhou: ${motivo}` : motivo);
    } finally {
      setProcessando(false);
    }
  }

  async function rejeitar(alvos: MatriculaListagem[], motivo: string): Promise<boolean> {
    if (!usuario || !id || processando || alvos.length === 0) return false;
    iniciarAcao();
    let feitas = 0;
    try {
      await gravar(
        async () => {
          for (const m of alvos) {
            await rejeitarMatricula(m.id, usuario.id, motivo.trim());
            feitas += 1;
          }
        },
        (qc) => invalidar.matriculas(qc, id),
      );
      setMensagem(`${plural(feitas, "inscrição rejeitada", "inscrições rejeitadas")}.`);
      setSelecionadas(new Set());
      setRejeitandoLote(false);
      setMotivoLote("");
      setAbertaId(null);
      return true;
    } catch (e) {
      const texto = e instanceof Error ? e.message : "Não foi possível rejeitar.";
      setErro(feitas > 0 ? `${plural(feitas, "inscrição rejeitada", "inscrições rejeitadas")}; a seguinte falhou: ${texto}` : texto);
      return false;
    } finally {
      setProcessando(false);
    }
  }

  async function aoDesfazer(matriculaId: string) {
    if (!id || processando) return;
    iniciarAcao();
    try {
      const { certificados_revogados: revogados } = await gravar(
        () => desfazerEncerramento(matriculaId, motivoDesfazer.trim()),
        (qc) => invalidar.matriculas(qc, id),
      );
      setMensagem(
        "Encerramento desfeito — a matrícula voltou a 'Cursando'." +
          (revogados > 0
            ? ` ${plural(revogados, "certificado foi revogado", "certificados foram revogados")}; uma nova conclusão emite um certificado novo.`
            : ""),
      );
      setDesfazendoId(null);
      setMotivoDesfazer("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível desfazer o encerramento.");
    } finally {
      setProcessando(false);
    }
  }

  const [liberandoAulaId, setLiberandoAulaId] = useState<string | null>(null);
  async function aoLiberarChamada(aulaId: string) {
    if (!id) return;
    setErro(null);
    setMensagem(null);
    setLiberandoAulaId(aulaId);
    try {
      const ate = await gravar(() => liberarChamada(aulaId), (qc) => invalidar.liberacaoDeChamada(qc, id, aulaId));
      setMensagem(`Chamada liberada: o professor pode fazê-la ou alterá-la até ${formatarData(ate)}.`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível liberar a chamada.");
    } finally {
      setLiberandoAulaId(null);
    }
  }

  async function aoRemover(matriculaId: string) {
    if (!id || processando) return;
    iniciarAcao();
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
    setResumoReativacao(null);
    try {
      const resumo = await gravar(
        () => reativarTurma(id, motivoReativar.trim()),
        (qc) => invalidar.matriculas(qc, id),
      );
      // No aviso do topo da tela, não dentro do bloco "Encerramento da
      // turma": reativar deixa a turma sem encerradas e o bloco some junto
      // com o retorno.
      setMensagem(
        `${plural(resumo.reativadas, "matrícula reativada", "matrículas reativadas")} — ${flexionar(resumo.reativadas, "voltou", "voltaram")} para "Cursando".` +
          (resumo.puladas > 0 ? ` ${plural(resumo.puladas, "aluno ficou de fora", "alunos ficaram de fora")} (veja abaixo).` : "") +
          (resumo.certificados_revogados > 0
            ? ` ${plural(resumo.certificados_revogados, "certificado revogado", "certificados revogados")}.`
            : ""),
      );
      setResumoReativacao(resumo);
      setConfirmandoReativarTurma(false);
      setMotivoReativar("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível reativar a turma.");
    } finally {
      setReativandoTurma(false);
    }
  }

  const carregandoTela = (consultaTurma.isPending || consultaMatriculas.isPending) && !erroDeLeitura;

  return (
    // pág. 11 — "Turmas / CÓDIGO", nome do módulo, "Editar turma" e as abas
    // na faixa do cabeçalho.
    <PaginaAutenticada
      comPainelLateral={aba === "inscricoes" && !!aberta}
      sobrelinha={
        <span>
          <LinkComPrefetch to="/coordenacao/turmas" className="hover:text-text-primary hover:underline">
            Turmas
          </LinkComPrefetch>
          {turma ? ` / ${codigoComTurno(turma.codigo, turma.turno)}` : ""}
        </span>
      }
      titulo={turma?.moduloNome}
      subtitulo={
        turma
          ? `${turma.trilhaNome} · Prof. ${turma.professorNome} · ${formatarPeriodo(turma.periodoInicio, turma.periodoFim)} · ${turma.vagasTotal} vagas · frequência mínima ${formatarPercentual(turma.frequenciaMinimaPercentual)}`
          : undefined
      }
      acoes={
        turma ? (
          <LinkBotao to={`/coordenacao/turmas/${turma.id}/editar`} variant="secondary">
            Editar turma
          </LinkBotao>
        ) : undefined
      }
      abas={
        turma && consultaMatriculas.data ? (
          <Abas<AbaTurma>
            rotulo="Seções da turma"
            ativa={aba}
            aoTrocar={mudarAba}
            abas={[
              { valor: "resumo", rotulo: "Resumo" },
              { valor: "inscricoes", rotulo: "Inscrições", contador: pendentes.length, formaContador: "circulo" },
              { valor: "alunos", rotulo: "Alunos", contador: matriculados.length },
              { valor: "aulas", rotulo: "Aulas" },
              { valor: "avaliacoes", rotulo: "Avaliações" },
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
      {carregandoTela && (
        <RegiaoCarregando className="flex flex-col gap-3">
          <Esqueleto className="h-6 w-56" />
          <EsqueletoCards quantidade={3} altura="h-16" />
        </RegiaoCarregando>
      )}
      {turma === null && <p className="text-body-sm text-text-secondary">Turma não encontrada.</p>}

      {turma && consultaMatriculas.data && aba === "inscricoes" && (
        <div>
          <h2 className="sr-only">Inscrições pendentes</h2>
          {pendentes.length === 0 && (
            <p className="text-body-sm text-text-secondary">Nenhuma inscrição pendente.</p>
          )}

          {selecionadasValidas.length > 0 && (
            // Barra de ações em lote (pág. 11): preenchida a preto, como o
            // estado mais "digno de nota" da tela.
            <div className="mb-4 flex flex-col gap-3 rounded-klass-card bg-primary px-4 py-3 text-primary-contraste">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-body-sm">
                  <strong className="font-semibold">
                    {plural(selecionadasValidas.length, "selecionada", "selecionadas")}
                  </strong>{" "}
                  {aptasSelecionadas.length === selecionadasValidas.length
                    ? flexionar(selecionadasValidas.length, "com pré-requisitos cumpridos", "todas com pré-requisitos cumpridos")
                    : `${selecionadasValidas.length - aptasSelecionadas.length} com pré-requisito pendente (não ${flexionar(selecionadasValidas.length - aptasSelecionadas.length, "entra", "entram")} na aprovação)`}
                </p>
                {!rejeitandoLote && (
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      className="!border-primary-contraste !bg-transparent !text-primary-contraste hover:!bg-primary-contraste/10"
                      disabled={processando}
                      onClick={() => {
                        setRejeitandoLote(true);
                        setMotivoLote("");
                      }}
                    >
                      Rejeitar
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={processando || aptasSelecionadas.length === 0}
                      onClick={() => void aprovar(aptasSelecionadas)}
                    >
                      Aprovar {aptasSelecionadas.length}
                    </Button>
                  </div>
                )}
              </div>
              {rejeitandoLote && (
                <div className="flex flex-col gap-2">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-label font-medium">
                      Motivo da rejeição (vale para {plural(selecionadasValidas.length, "inscrição", "inscrições")})
                    </span>
                    <textarea
                      required
                      rows={2}
                      className={CLASSE_TEXTAREA}
                      value={motivoLote}
                      onChange={(e) => setMotivoLote(e.target.value)}
                    />
                  </label>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      disabled={motivoLote.trim().length < MOTIVO_MINIMO || processando}
                      onClick={() => void rejeitar(selecionadasValidas, motivoLote)}
                    >
                      Confirmar rejeição
                    </Button>
                    <Button
                      variant="secondary"
                      className="!border-primary-contraste !bg-transparent !text-primary-contraste hover:!bg-primary-contraste/10"
                      onClick={() => setRejeitandoLote(false)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {pendentes.length > 0 && (
            <Card className="overflow-x-auto !px-0 !py-0">
              <table className="w-full min-w-max text-left md:min-w-0">
                <thead>
                  <tr className="border-b border-border text-label text-text-secondary">
                    <th className="w-12 px-4 py-3">
                      <input
                        type="checkbox"
                        className="h-5 w-5"
                        aria-label="Selecionar todas as inscrições"
                        checked={todasSelecionadas}
                        onChange={() =>
                          setSelecionadas(todasSelecionadas ? new Set() : new Set(pendentes.map((m) => m.id)))
                        }
                      />
                    </th>
                    <th className="px-4 py-3 font-medium">Aluno</th>
                    <th className="px-4 py-3 font-medium">Inscrito em</th>
                    <th className="px-4 py-3 font-medium">Pré-requisitos</th>
                    <th className="px-4 py-3 text-right font-medium">Vagas após aprovar</th>
                  </tr>
                </thead>
                <tbody>
                  {pendentes.map((m) => {
                    const marcada = selecionadas.has(m.id);
                    const vagas = vagasApos.get(m.id);
                    return (
                      <tr
                        key={m.id}
                        // Clicar na linha abre o painel; o checkbox só seleciona.
                        onClick={() => setAbertaId(m.id)}
                        className={`h-[60px] cursor-pointer border-b border-border last:border-b-0 ${
                          marcada || abertaId === m.id ? "bg-background" : "hover:bg-background"
                        }`}
                      >
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="h-5 w-5"
                            aria-label={`Selecionar ${m.alunoNome}`}
                            checked={marcada}
                            onChange={() => alternarSelecao(m.id)}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            className="flex items-center gap-3 text-left text-body-sm font-medium text-text-primary hover:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setAbertaId(m.id);
                            }}
                          >
                            <Avatar nome={m.alunoNome} />
                            {m.alunoNome}
                          </button>
                        </td>
                        <td className="px-4 py-3 font-mono text-body-sm tabular-nums text-text-primary">
                          {dataHoraCurta(m.criadoEm)}
                        </td>
                        <td className="px-4 py-3">
                          <BadgePreRequisitos situacao={situacaoDe(m)} />
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-body-sm tabular-nums text-text-primary">
                          {vagas === null || vagas === undefined ? "—" : vagas < 0 ? "sem vaga" : vagas}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}
          {pendentes.length > 0 && (
            <p className="mt-3 text-body-sm text-text-secondary">
              A coluna de pré-requisitos mostra a validação do motor de seleção, a mesma que o banco
              aplica na matrícula — sem precisar abrir inscrição por inscrição.
            </p>
          )}

          {aberta && (
            <PainelInscricao
              key={aberta.id}
              matricula={aberta}
              turma={turma}
              preRequisitos={situacaoDe(aberta)}
              processando={processando}
              aoFechar={() => setAbertaId(null)}
              aoAprovar={() => void aprovar([aberta])}
              aoRejeitar={(motivo) => rejeitar([aberta], motivo)}
            />
          )}
        </div>
      )}

      {turma && consultaMatriculas.data && aba === "alunos" && (
        <>
          <h2 className="sr-only">Alunos</h2>
          {/* Exporta matriculados e histórico juntos (a mesma lista da aba),
              com média e frequência de quem está no diário. */}
          <div className="mb-3 flex justify-end">
            <BotaoExportarCsv
              nome={["alunos", turma.codigo]}
              rotulo={`Exportar alunos da turma ${turma.codigo} em CSV`}
              linhas={[...matriculados, ...historico]}
              colunas={[
                { titulo: "Aluno", valor: (m) => m.alunoNome },
                { titulo: "Situação", valor: (m) => textoDoStatusMatricula(m.status) },
                {
                  titulo: "Média",
                  valor: (m) => {
                    const media = progressos.porMatricula.get(m.id)?.media;
                    return media !== null && media !== undefined ? formatarMedia(media) : null;
                  },
                },
                {
                  titulo: "Frequência (%)",
                  valor: (m) => {
                    const freq = progressos.porMatricula.get(m.id)?.frequencia;
                    return freq !== null && freq !== undefined ? Math.trunc(freq) : null;
                  },
                },
                { titulo: "Inscrito em", valor: (m) => formatarData(m.criadoEm) },
                { titulo: "Motivo", valor: (m) => m.motivoRejeicao ?? m.motivoConclusao },
              ]}
            />
          </div>
          <div className="mb-6 flex flex-col gap-2">
            {/* QA, F3: com todos encerrados, "nenhum matriculado ainda" contradizia o Histórico. */}
            {matriculados.length === 0 && (
              <p className="text-body-sm text-text-secondary">
                {historico.length === 0
                  ? "Nenhum aluno matriculado ainda."
                  : temEncerradas
                    ? `Nenhum aluno cursando agora. ${plural(historico.filter((m) => m.status === "concluida" || m.status === "reprovada").length, "matrícula encerrada está", "matrículas encerradas estão")} no Histórico abaixo.`
                    : `Nenhum aluno cursando agora. ${plural(historico.length, "inscrição rejeitada ou cancelada está", "inscrições rejeitadas ou canceladas estão")} no Histórico abaixo.`}
              </p>
            )}
            {matriculados.map((matricula) => (
              <Card key={matricula.id} className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                  <span className="flex items-center gap-3 text-body-sm text-text-primary">
                    <Avatar nome={matricula.alunoNome} />
                    {matricula.alunoNome}
                  </span>
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

                <HistoricoDeEncerramento registros={historicoPorMatricula.get(matricula.id) ?? []} />

                {removendoId === matricula.id && (
                  <div className="flex flex-col gap-2">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-label font-medium text-text-secondary">Motivo da remoção</span>
                      <textarea
                        required
                        rows={2}
                        className={CLASSE_TEXTAREA}
                        value={motivoRemocao}
                        onChange={(e) => setMotivoRemocao(e.target.value)}
                      />
                    </label>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        disabled={motivoRemocao.trim().length < MOTIVO_MINIMO || processando}
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
              encerradas da turma para "Cursando", simétrico ao
              "Desfazer encerramento" por aluno logo abaixo. */}
          {temEncerradas && (
            <div className="mb-4 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-4">
                <Titulo nivel="secao">Encerramento da turma</Titulo>
                {!confirmandoReativarTurma && (
                  <Button variant="secondary" onClick={() => setConfirmandoReativarTurma(true)}>
                    Reativar turma inteira
                  </Button>
                )}
              </div>
              {confirmandoReativarTurma && (
                <Card className="flex flex-col gap-3">
                  <p className="text-body-sm text-text-secondary">
                    Isto devolve todos os alunos aprovados e reprovados desta turma para "Cursando",
                    permitindo ao professor lançar de novo. Certificados já emitidos para estes
                    módulos são revogados. Quem não couber (turma sem vaga, ou matrícula ativa em
                    outra turma do mesmo módulo) fica de fora, com o motivo.
                  </p>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-label font-medium text-text-secondary">
                      Motivo da reativação (fica registrado no histórico)
                    </span>
                    <textarea
                      required
                      rows={2}
                      className={CLASSE_TEXTAREA}
                      value={motivoReativar}
                      onChange={(e) => setMotivoReativar(e.target.value)}
                    />
                  </label>
                  <div className="flex gap-2">
                    <Button
                      disabled={reativandoTurma || motivoReativar.trim().length < MOTIVO_MINIMO}
                      onClick={() => void aoReativarTurma()}
                    >
                      {reativandoTurma ? "Reativando..." : "Reativar turma inteira"}
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={reativandoTurma}
                      onClick={() => {
                        setConfirmandoReativarTurma(false);
                        setMotivoReativar("");
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                </Card>
              )}
            </div>
          )}

          {resumoReativacao && resumoReativacao.puladas > 0 && (
            <Card className="mb-4 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-4">
                <Titulo nivel="item" as="h3">
                  Ficaram de fora da reativação
                </Titulo>
                <Button variant="secondary" onClick={() => setResumoReativacao(null)}>
                  Fechar
                </Button>
              </div>
              <ul className="flex flex-col gap-1">
                {resumoReativacao.alunos_pulados.map((p) => (
                  <li key={p.matricula_id} className="text-body-sm text-text-secondary">
                    <span className="text-text-primary">{p.aluno_nome ?? "Aluno"}</span>: {p.motivo}.
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {historico.length > 0 && (
            <>
              <Titulo nivel="secao" className="mb-3">
                Histórico
              </Titulo>
              <div className="mb-6 flex flex-col gap-2">
                {historico.map((matricula) => {
                  const podeDesfazer = matricula.status === "concluida" || matricula.status === "reprovada";
                  return (
                    <Card key={matricula.id} className="flex flex-col gap-2">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <Avatar nome={matricula.alunoNome} />
                          <div className="flex flex-col">
                            <span className="text-body-sm text-text-primary">{matricula.alunoNome}</span>
                            {(matricula.motivoRejeicao ?? matricula.motivoConclusao) && (
                              <span className="text-label text-text-secondary">
                                {matricula.motivoRejeicao ?? matricula.motivoConclusao}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge tipo="matricula" status={matricula.status} />
                          {podeDesfazer && desfazendoId !== matricula.id && (
                            <Button
                              variant="secondary"
                              onClick={() => {
                                setDesfazendoId(matricula.id);
                                setMotivoDesfazer("");
                              }}
                            >
                              Desfazer encerramento
                            </Button>
                          )}
                        </div>
                      </div>
                      {podeDesfazer && desfazendoId === matricula.id && (
                        <div className="flex flex-col gap-2">
                          <span className="text-label text-text-secondary">
                            Volta para "Cursando" — o professor pode lançar de novo.
                            {matricula.status === "concluida" &&
                              " Se o aluno já tem certificado deste módulo (ou da trilha), ele é revogado e continua aparecendo como revogado na verificação pública."}
                          </span>
                          <label className="flex flex-col gap-1.5">
                            <span className="text-label font-medium text-text-secondary">
                              Motivo (fica registrado no histórico)
                            </span>
                            <textarea
                              required
                              rows={2}
                              className={CLASSE_TEXTAREA}
                              value={motivoDesfazer}
                              onChange={(e) => setMotivoDesfazer(e.target.value)}
                            />
                          </label>
                          <div className="flex gap-2">
                            <Button
                              variant="secondary"
                              disabled={processando || motivoDesfazer.trim().length < MOTIVO_MINIMO}
                              onClick={() => void aoDesfazer(matricula.id)}
                            >
                              Desfazer encerramento
                            </Button>
                            <Button
                              variant="secondary"
                              onClick={() => {
                                setDesfazendoId(null);
                                setMotivoDesfazer("");
                              }}
                            >
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      )}
                      <HistoricoDeEncerramento registros={historicoPorMatricula.get(matricula.id) ?? []} />
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {/* Diário (MS4) — coordenação só consulta, quem lança nota/presença é o professor. */}
      {turma && aba === "resumo" && <ResumoDaTurma turma={turma} papel="coordenacao" />}
      {/* Coordenação gerencia materiais como o professor (RLS: diario.pode_gerenciar_turma). */}
      {turma && aba === "materiais" && (
        <>
          <h2 className="sr-only">Materiais</h2>
          <MateriaisDaTurma turmaId={turma.id} modo="gestao" />
        </>
      )}
      {turma && consultaMatriculas.data && aba === "aulas" && (
        <>
          <h2 className="sr-only">Aulas</h2>
          {consultaAulas.isPending && <EsqueletoCards quantidade={3} altura="h-12" />}
          {consultaAulas.data && (
            <Card className="flex flex-col divide-y divide-border !py-0">
              {aulas.length === 0 && (
                <p className="py-4 text-body-sm text-text-secondary">Nenhuma aula cadastrada.</p>
              )}
              {aulas.map((au, i) => (
                <div key={au.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-body-sm text-text-primary">Aula {i + 1}</span>
                    <span className="font-mono text-body-sm tabular-nums text-text-secondary">
                      {formatarData(au.data)}
                      {au.horario ? ` · ${formatarHora(au.horario)}` : ""}
                      {au.sala ? ` · ${au.sala}` : ""}
                    </span>
                    <SituacaoDaChamada aula={au} />
                  </div>
                  {/* Prazo do professor (7 dias) vencido: a coordenação devolve
                      mais 7 dias a partir de hoje, com registro de quem liberou. */}
                  {au.situacao_chamada === "encerrada" && (
                    <Button
                      variant="secondary"
                      disabled={liberandoAulaId !== null}
                      onClick={() => void aoLiberarChamada(au.id)}
                    >
                      {liberandoAulaId === au.id ? "Liberando..." : "Liberar chamada"}
                    </Button>
                  )}
                </div>
              ))}
            </Card>
          )}
        </>
      )}

      {turma && consultaMatriculas.data && aba === "avaliacoes" && (
        <>
          <h2 className="sr-only">Avaliações</h2>
          {carregandoDiario && !erroDeLeitura && <EsqueletoCards quantidade={3} altura="h-20" />}
          {!carregandoDiario && (
            <>
              <Card className="mb-4">
                <h3 className="mb-2 text-klass-md font-semibold text-text-primary">
                  Avaliações ({avaliacoes.length})
                </h3>
                {avaliacoes.length === 0 ? (
                  <p className="text-body-sm text-text-secondary">Nenhuma avaliação cadastrada.</p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {avaliacoes.map((a) => (
                      <li key={a.id} className="text-body-sm text-text-secondary">
                        {a.titulo} · peso {a.peso}
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
                  <Card key={aluno.matriculaId} className="flex flex-wrap items-center justify-between gap-3">
                    <span className="flex items-center gap-3 text-body-sm text-text-primary">
                      <Avatar nome={aluno.alunoNome} />
                      {aluno.alunoNome}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-body-sm text-text-secondary">
                        Média{" "}
                        <span className="font-mono tabular-nums text-text-primary">
                          {aluno.progresso.media !== null ? formatarMedia(aluno.progresso.media) : "—"}
                        </span>
                        {" · Freq. "}
                        <span className="font-mono tabular-nums text-text-primary">
                          {aluno.progresso.frequencia !== null ? formatarPercentual(aluno.progresso.frequencia) : "—"}
                        </span>
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
