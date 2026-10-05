import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Check, Clock, Lock } from "lucide-react";
import { useAuth } from "@/auth";
import { CancelarInscricao } from "@/components/aluno/CancelarInscricao";
import { Aviso } from "@/components/Aviso";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Esqueleto, EsqueletoCards, RegiaoCarregando } from "@/components/Esqueleto";
import { ErroConsulta } from "@/components/ErroConsulta";
import { IconeCatalogo } from "@/components/IconeCatalogo";
import { PaginaAutenticada } from "@/components/PaginaAutenticada";
import { StatusBadge } from "@/components/StatusBadge";
import { rotaDoPreRequisito, rotuloPreRequisito } from "@/lib/catalogo";
import {
  useModulosDaTrilha,
  usePreRequisitosDoModulo,
  useTrilhaPorSlug,
} from "@/lib/consultas/catalogo";
import { plural } from "@/lib/plural";
import { useGravacao } from "@/lib/consultas/gravacao";
import { invalidar } from "@/lib/consultas/invalidar";
import { useMatriculasDoAluno, useTurmasDaTrilha } from "@/lib/consultas/selecao";
import { formatarDiaMes, formatarMesAno, formatarPeriodo } from "@/lib/formato";
import { codigoComTurno, inscreverAluno, type StatusMatricula } from "@/lib/selecao";
import type { NivelModulo } from "@klass/types";

const NIVEL_LABEL: Record<NivelModulo, string> = {
  iniciante: "Iniciante",
  intermediario: "Intermediário",
  avancado: "Avançado",
};

// Só estes status impedem nova inscrição no módulo (o banco bloqueia
// inscrita/matriculada em checar_matricula_ativa_no_modulo; concluída
// não faz sentido refazer). Rejeitada, cancelada (inclui removido pela
// coordenação) e reprovada liberam escolher outra turma.
const STATUS_VIGENTES: StatusMatricula[] = ["inscrita", "matriculada", "concluida"];

interface PreRequisitoStatus {
  moduloId: string;
  nome: string;
  /** "Trilha · Módulo" quando o pré-requisito é de outra trilha. */
  rotulo: string;
  /** Rota da página do módulo pré-requisito, para virar link quando pendente. */
  rota: string;
  status: "concluido" | "cursando" | "pendente";
  data: string | null;
}

// D4 (klass-uikit.pdf) — "Detalhe de módulo/inscrição": tela dedicada por
// módulo (não mais inline na trilha inteira). Antes do botão de
// inscrição, mostra os pré-requisitos com status individual; ao lado,
// "Escolha a turma" em seleção única. Sem "avise-me quando liberar"
// (fora de escopo deste prompt — ver exclusões).
export function DetalheModulo() {
  const { slug, moduloId } = useParams<{ slug: string; moduloId: string }>();
  const { usuario, profile } = useAuth();
  const navigate = useNavigate();
  const gravar = useGravacao();

  // Pré-requisitos e matrículas não dependem da trilha: saem junto com
  // ela. Módulos e turmas esperam só o id da trilha (que pode já estar em
  // cache, vindo do catálogo).
  const consultaTrilha = useTrilhaPorSlug(slug);
  const trilha = consultaTrilha.data;
  const consultaModulos = useModulosDaTrilha(trilha?.id);
  const consultaPreRequisitos = usePreRequisitosDoModulo(moduloId);
  const consultaTurmas = useTurmasDaTrilha(trilha?.id, usuario?.id ?? null);
  const consultaMatriculas = useMatriculasDoAluno(usuario?.id);

  const [escolha, setEscolha] = useState<{ moduloId: string; turmaId: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [inscrevendo, setInscrevendo] = useState(false);

  const consultas = [consultaTrilha, consultaModulos, consultaPreRequisitos, consultaTurmas, consultaMatriculas];
  const erroDeLeitura = consultas.find((c) => c.isError)?.error ?? null;
  // Primeira carga: algum dado ainda não chegou. A trilha nula (não
  // encontrada) encerra a espera — os demais nem rodam.
  const carregando =
    consultaTrilha.isPending ||
    (!!trilha &&
      (consultaModulos.isPending ||
        consultaPreRequisitos.isPending ||
        consultaTurmas.isPending ||
        consultaMatriculas.isPending));
  const atualizando = consultaTurmas.isFetching || consultaMatriculas.isFetching;

  const modulo = consultaModulos.data?.find((m) => m.id === moduloId) ?? null;
  const minhasMatriculas = consultaMatriculas.data ?? [];

  // Nome, trilha e slug vêm do próprio pré-requisito (pode ser de outra
  // trilha): o link nunca depende da lista de módulos da trilha atual.
  const preRequisitos: PreRequisitoStatus[] = (consultaPreRequisitos.data ?? []).map((pr) => {
    const base = {
      moduloId: pr.pre_requisito_id,
      nome: pr.nome,
      rotulo: rotuloPreRequisito(pr, trilha?.id),
      rota: rotaDoPreRequisito(pr),
    };
    // some/find por status, não a primeira matrícula do módulo: depois
    // de uma reinscrição o aluno pode ter mais de uma ali.
    const doModulo = minhasMatriculas.filter((m) => m.moduloId === pr.pre_requisito_id);
    const concluida = doModulo.find((m) => m.status === "concluida");
    if (concluida) return { ...base, status: "concluido", data: concluida.periodoFim };
    const cursando = doModulo.find((m) => m.status === "matriculada");
    if (cursando) return { ...base, status: "cursando", data: cursando.periodoFim };
    return { ...base, status: "pendente", data: null };
  });
  const turmas = consultaTurmas.data?.find((m) => m.moduloId === moduloId)?.turmas ?? [];
  const matriculasNoModulo = minhasMatriculas.filter((m) => m.moduloId === moduloId);
  // Turma onde o aluno já teve matrícula não pode ser escolhida de
  // novo (unique aluno+turma no banco) — pré-seleciona a primeira livre.
  const turmaSelecionada =
    escolha && escolha.moduloId === moduloId
      ? escolha.turmaId
      : (turmas.find((t) => !t.minhaMatricula && t.vagasRestantes > 0 && !t.inscricoesEncerradas)?.id ?? null);

  const preRequisitosPendentes = preRequisitos.filter((p) => p.status !== "concluido");
  const podeInscrever = preRequisitosPendentes.length === 0;

  async function aoInscrever() {
    if (!turmaSelecionada || !usuario) return;
    setErro(null);
    setMensagem(null);
    setInscrevendo(true);
    try {
      await gravar(
        () => inscreverAluno(turmaSelecionada),
        (qc) => invalidar.inscricao(qc, usuario.id),
      );
      setMensagem("Inscrição enviada — a coordenação vai avaliar em breve.");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível se inscrever nesta turma.");
    } finally {
      setInscrevendo(false);
    }
  }

  // Erro de carregamento (rede, RLS, timeout) precisa vir antes das
  // checagens abaixo — sem isso, uma falha na consulta ficava mascarada
  // como "Módulo não encontrado" ou como um carregamento que nunca resolve.
  if (erroDeLeitura && !modulo) {
    return (
      <PaginaAutenticada largura="media" voltar={{ para: "/catalogo", rotulo: "Catálogo", posicao: "acima" }}>
        <ErroConsulta
          erro={erroDeLeitura}
          padrao="Não foi possível carregar o módulo."
          tentarDeNovo={() => consultas.forEach((c) => c.isError && void c.refetch())}
        />
      </PaginaAutenticada>
    );
  }

  // "Módulo não encontrado" só com a leitura concluída: trilha inexistente
  // ou módulo fora da lista de módulos dela.
  if (carregando) {
    return (
      <PaginaAutenticada largura="media">
        <RegiaoCarregando className="flex flex-col gap-3">
          <Esqueleto className="h-4 w-32" />
          <Esqueleto className="h-8 w-64" />
          <div className="flex gap-2">
            <Esqueleto className="h-6 w-24" />
            <Esqueleto className="h-6 w-16" />
            <Esqueleto className="h-6 w-32" />
          </div>
          <Esqueleto className="h-4 w-full" />
        </RegiaoCarregando>
        <EsqueletoCards className="mt-4" quantidade={2} altura="h-36" />
      </PaginaAutenticada>
    );
  }

  if (!trilha || !modulo) {
    return (
      <PaginaAutenticada largura="media" voltar={{ para: "/catalogo", rotulo: "Catálogo", posicao: "acima" }}>
        <Aviso variant="danger">Módulo não encontrado.</Aviso>
      </PaginaAutenticada>
    );
  }

  // listarMatriculasDoAluno vem do mais recente para o mais antigo.
  const matriculaVigente = matriculasNoModulo.find((m) => STATUS_VIGENTES.includes(m.status));
  const matriculaAnterior = matriculaVigente ? undefined : matriculasNoModulo[0];

  return (
    // Voltar com destino fixo na trilha (não navigate(-1)): é ela que, por
    // sua vez, volta fixo ao catálogo — sem loop trilha ↔ módulo.
    <PaginaAutenticada
      largura="media"
      voltar={{ para: `/catalogo/${trilha.slug}`, rotulo: trilha.nome, posicao: "acima" }}
      titulo={
        <span className="flex items-center gap-2">
          <IconeCatalogo nome={modulo.icone} className="h-6 w-6 shrink-0 text-primary" />
          {modulo.nome}
        </span>
      }
    >
      <div className="flex flex-wrap gap-2">
        <Badge variant="contorno">{NIVEL_LABEL[modulo.nivel]}</Badge>
        <Badge variant="contorno">{modulo.carga_horaria_horas} h</Badge>
        <Badge variant="contorno">Trilha {trilha.nome}</Badge>
      </div>
      {modulo.descricao && <p className="mt-3 text-body-sm text-text-secondary">{modulo.descricao}</p>}

      {erro && (
        <Aviso variant="danger" className="mt-4">
          {erro}
        </Aviso>
      )}
      {mensagem && (
        <Aviso variant="success" className="mt-4">
          {mensagem}
        </Aviso>
      )}

      {preRequisitos.length > 0 && (
        <Card className="mt-4">
          <h2 className="mb-3 text-klass-lg text-text-primary">Antes de se inscrever</h2>
          <div className="flex flex-col divide-y divide-border">
            {preRequisitos.map((p) => (
              <div key={p.moduloId} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                {/* Ícone por situação (pág. 6): ✓ concluído, relógio cursando, cadeado pendente. */}
                {p.status === "concluido" && <Check className="mt-0.5 h-5 w-5 shrink-0 text-text-primary" aria-label="Concluído" />}
                {p.status === "cursando" && <Clock className="mt-0.5 h-5 w-5 shrink-0 text-text-primary" aria-label="Cursando" />}
                {p.status === "pendente" && <Lock className="mt-0.5 h-5 w-5 shrink-0 text-text-primary" aria-label="Pendente" />}
                <div>
                  {p.status === "concluido" ? (
                    <p className="text-body-sm font-medium text-text-primary">{p.rotulo}</p>
                  ) : (
                    <Link to={p.rota} className="text-body-sm font-medium text-primary hover:underline">
                      {p.rotulo}
                    </Link>
                  )}
                  <p className="text-body-sm text-text-secondary">
                    {p.status === "concluido" && p.data && `Concluído em ${formatarMesAno(p.data)}`}
                    {p.status === "cursando" && p.data && `Você está cursando. Conclusão prevista: ${formatarDiaMes(p.data)}.`}
                    {p.status === "pendente" && "Ainda não cursado."}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {profile?.papel === "aluno" && matriculaAnterior && (
        <Card className="mt-4 flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <p className="text-body-sm text-text-secondary">
              Sua inscrição anterior, na turma {matriculaAnterior.turmaCodigo}:
            </p>
            <StatusBadge tipo="matricula" status={matriculaAnterior.status} />
          </div>
          {matriculaAnterior.motivoConclusao && (
            <p className="text-label text-text-muted">{matriculaAnterior.motivoConclusao}</p>
          )}
          <p className="text-label text-text-muted">Você pode se inscrever de novo em outra turma.</p>
        </Card>
      )}

      {profile?.papel === "aluno" && !matriculaVigente && (
        <>
          <h2 className="mb-3 mt-6 text-klass-lg text-text-primary">Escolha a turma</h2>
          {turmas.length === 0 && (
            <p className="text-body-sm text-text-secondary">Nenhuma turma aberta para este módulo no momento.</p>
          )}
          <div className="flex flex-col gap-3">
            {turmas.map((turma) =>
              // Período encerrado: o banco recusa a inscrição. Cartão sem
              // rádio, só informativo (as turmas passadas continuam na lista
              // para o aluno ver o histórico do módulo).
              turma.inscricoesEncerradas ? (
                <div
                  key={turma.id}
                  className="flex items-center justify-between gap-3 rounded-klass-card border border-border bg-surface px-4 py-3.5"
                >
                  <div className="min-w-0">
                    <p className="text-body-sm font-semibold text-text-primary">{codigoComTurno(turma.codigo, turma.turno)}</p>
                    <p className="text-body-sm text-text-secondary">
                      {formatarPeriodo(turma.periodoInicio, turma.periodoFim, true)} · Prof.{" "}
                      {turma.professorNome}
                    </p>
                  </div>
                  <Badge variant="tracejado">Inscrições encerradas</Badge>
                </div>
              ) : (
              <label
                key={turma.id}
                // Cartão por turma (pág. 6); o selecionado ganha borda escura
                // de 2px (não preenchimento colorido): o único azul da tela é
                // o ponto do rádio, via accent-acento.
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-klass-card bg-surface px-4 py-3.5 ${
                  turmaSelecionada === turma.id ? "border-2 border-text-primary" : "border border-border"
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <input
                    type="radio"
                    name="turma"
                    className="h-5 w-5 shrink-0 accent-acento"
                    checked={turmaSelecionada === turma.id}
                    onChange={() => setEscolha({ moduloId: moduloId!, turmaId: turma.id })}
                    disabled={turma.vagasRestantes <= 0 || turma.minhaMatricula !== null}
                  />
                  <div className="min-w-0">
                    <p className="text-body-sm font-semibold text-text-primary">{codigoComTurno(turma.codigo, turma.turno)}</p>
                    <p className="text-body-sm text-text-secondary">
                      {formatarPeriodo(turma.periodoInicio, turma.periodoFim, true)} · Prof.{" "}
                      {turma.professorNome}
                    </p>
                    {turma.minhaMatricula && (
                      <p className="text-label text-text-secondary">Você já se inscreveu nesta turma antes.</p>
                    )}
                  </div>
                </div>
                <span className="shrink-0 font-mono text-body-sm tabular-nums text-text-primary">
                  {plural(turma.vagasRestantes, "vaga", "vagas")}
                </span>
              </label>
              ),
            )}
          </div>

          <p className="mt-4 rounded-klass-card border border-dashed border-controle px-4 py-3 text-body-sm text-text-secondary">
            Depois de enviar: a coordenação analisa a inscrição, e você recebe um e-mail e um aviso
            aqui quando ela for aprovada.
          </p>

          {/* Estado bloqueado (pág. 6): cadeado + motivo acima do botão, que
              fica tracejado e desabilitado. Sem "Avise-me quando liberar":
              não há backend para esse aviso. */}
          {!podeInscrever && (
            <p className="mt-4 flex items-start gap-2 text-body-sm font-medium text-text-primary">
              <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              Inscrição abre quando você concluir {preRequisitosPendentes.map((p) => p.rotulo).join(", ")}
            </p>
          )}
          <Button
            className="mt-3 w-full"
            variant={!podeInscrever ? "tracejado" : "primary"}
            disabled={!podeInscrever || !turmaSelecionada || inscrevendo || atualizando || turmas.length === 0}
            onClick={() => void aoInscrever()}
          >
            {inscrevendo ? "Inscrevendo..." : "Inscrever-se"}
          </Button>
        </>
      )}

      {matriculaVigente && (
        <Card className="mt-4 flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <p className="text-body-sm font-medium text-text-primary">
              Turma {matriculaVigente.turmaCodigo}
            </p>
            <StatusBadge tipo="matricula" status={matriculaVigente.status} />
          </div>
          <p className="text-body-sm text-text-secondary">
            {matriculaVigente.status === "inscrita" && "Sua inscrição está em análise pela coordenação. "}
            {matriculaVigente.status === "matriculada" && "Você está cursando este módulo. "}
            {matriculaVigente.status === "concluida" && "Você já concluiu este módulo. "}
            Acompanhe pelo{" "}
            <Link to="/aluno/boletim" className="font-medium text-primary hover:underline">
              boletim
            </Link>
            .
          </p>
          {matriculaVigente.status === "inscrita" && (
            <CancelarInscricao matriculaId={matriculaVigente.id} turmaCodigo={matriculaVigente.turmaCodigo} />
          )}
        </Card>
      )}

      {profile?.papel !== "aluno" && (
        <Button variant="secondary" className="mt-4" onClick={() => navigate(-1)}>
          Voltar
        </Button>
      )}
    </PaginaAutenticada>
  );
}
