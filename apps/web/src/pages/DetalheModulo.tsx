import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";
import { Check, Clock, Lock } from "lucide-react";
import { useAuth } from "@/auth";
import { Aviso } from "@/components/Aviso";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Esqueleto, EsqueletoCards, RegiaoCarregando } from "@/components/Esqueleto";
import { ErroConsulta } from "@/components/ErroConsulta";
import { IconeCatalogo } from "@/components/IconeCatalogo";
import { PaginaAutenticada } from "@/components/PaginaAutenticada";
import { StatusBadge } from "@/components/StatusBadge";
import { Titulo } from "@/components/Titulo";
import {
  opcoesCatalogo,
  useModulosDaTrilha,
  usePreRequisitosDoModulo,
  useTrilhaPorSlug,
} from "@/lib/consultas/catalogo";
import { useGravacao } from "@/lib/consultas/gravacao";
import { invalidar } from "@/lib/consultas/invalidar";
import { useMatriculasDoAluno, useTurmasDaTrilha } from "@/lib/consultas/selecao";
import { inscreverAluno, type StatusMatricula } from "@/lib/selecao";
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

  // Hoje o banco só aceita pré-requisito da mesma trilha, mas o slug
  // de outra trilha é buscado mesmo assim — o nome e o link vêm do
  // próprio pré-requisito, nunca mais como "—".
  const outrasTrilhaIds = [
    ...new Set(
      (consultaPreRequisitos.data ?? []).map((p) => p.trilha_id).filter((id) => id !== trilha?.id),
    ),
  ];
  const outrasTrilhas = useQueries({
    queries: trilha ? outrasTrilhaIds.map((id) => opcoesCatalogo.trilhaPorId(id)) : [],
  });

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
        consultaMatriculas.isPending ||
        outrasTrilhas.some((t) => t.isPending)));
  const atualizando = consultaTurmas.isFetching || consultaMatriculas.isFetching;

  const modulo = consultaModulos.data?.find((m) => m.id === moduloId) ?? null;
  const minhasMatriculas = consultaMatriculas.data ?? [];

  const slugPorTrilha = new Map<string, string>();
  if (trilha) slugPorTrilha.set(trilha.id, trilha.slug);
  for (const t of outrasTrilhas) if (t.data) slugPorTrilha.set(t.data.id, t.data.slug);

  const preRequisitos: PreRequisitoStatus[] = (consultaPreRequisitos.data ?? []).map((pr) => {
    const slugTrilha = slugPorTrilha.get(pr.trilha_id);
    const base = {
      moduloId: pr.id,
      nome: pr.nome,
      rota: slugTrilha ? `/catalogo/${slugTrilha}/modulos/${pr.id}` : "/catalogo",
    };
    // some/find por status, não a primeira matrícula do módulo: depois
    // de uma reinscrição o aluno pode ter mais de uma ali.
    const doModulo = minhasMatriculas.filter((m) => m.moduloId === pr.id);
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
      : (turmas.find((t) => !t.minhaMatricula && t.vagasRestantes > 0)?.id ?? null);

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
      <PaginaAutenticada largura="estreita">
        <Link to="/catalogo" className="mb-4 flex items-center gap-1.5 text-body-sm font-medium text-text-secondary hover:text-text-primary">
          ← Catálogo
        </Link>
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
      <PaginaAutenticada largura="estreita">
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
      <PaginaAutenticada largura="estreita">
        <Link to="/catalogo" className="mb-4 flex items-center gap-1.5 text-body-sm font-medium text-text-secondary hover:text-text-primary">
          ← Catálogo
        </Link>
        <Aviso variant="danger">Módulo não encontrado.</Aviso>
      </PaginaAutenticada>
    );
  }

  // listarMatriculasDoAluno vem do mais recente para o mais antigo.
  const matriculaVigente = matriculasNoModulo.find((m) => STATUS_VIGENTES.includes(m.status));
  const matriculaAnterior = matriculaVigente ? undefined : matriculasNoModulo[0];

  return (
    <PaginaAutenticada largura="estreita">
      {/* Destino fixo na trilha (não navigate(-1)): é ela que, por sua vez,
          volta fixo ao catálogo — sem loop trilha ↔ módulo. */}
      <BotaoVoltar para={`/catalogo/${trilha.slug}`} rotulo={trilha.nome} />

      <div className="flex items-center gap-2">
        <IconeCatalogo nome={modulo.icone} className="h-6 w-6 text-primary" />
        <Titulo>{modulo.nome}</Titulo>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Badge variant="neutral">{NIVEL_LABEL[modulo.nivel]}</Badge>
        <Badge variant="neutral">{modulo.carga_horaria_horas} h</Badge>
        <Badge variant="neutral">Trilha {trilha.nome}</Badge>
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
          <p className="mb-3 text-klass-md font-medium text-text-primary">Antes de se inscrever</p>
          <div className="flex flex-col gap-2.5">
            {preRequisitos.map((p) => (
              <div key={p.moduloId} className="flex items-center gap-2.5">
                {p.status === "concluido" && <Check className="h-4 w-4 shrink-0 text-text-primary" aria-hidden />}
                {p.status === "cursando" && <Clock className="h-4 w-4 shrink-0 text-text-secondary" aria-hidden />}
                {p.status === "pendente" && <Lock className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />}
                <div>
                  {p.status === "concluido" ? (
                    <p className="text-body-sm font-medium text-text-primary">{p.nome}</p>
                  ) : (
                    <Link to={p.rota} className="text-body-sm font-medium text-primary hover:underline">
                      {p.nome}
                    </Link>
                  )}
                  <p className="text-label text-text-muted">
                    {p.status === "concluido" && `Concluído em ${p.data}`}
                    {p.status === "cursando" && `Você está cursando. Conclusão prevista: ${p.data}.`}
                    {p.status === "pendente" && "Pendente."}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {profile?.papel === "aluno" && matriculaAnterior && (
        <Card className="mt-4 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
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
          <Card className="mt-4">
            <p className="mb-3 text-klass-md font-medium text-text-primary">Escolha a turma</p>
            {turmas.length === 0 && (
              <p className="text-body-sm text-text-secondary">
                Nenhuma turma aberta para este módulo no momento.
              </p>
            )}
            <div className="flex flex-col gap-2">
              {turmas.map((turma) => (
                <label
                  key={turma.id}
                  // Prompt 17 — a linha selecionada ganha borda preta mais
                  // grossa (não um preenchimento colorido): o único azul da
                  // tela inteira é o próprio ponto do rádio, via
                  // accent-acento abaixo (medido por pixel em "Escolha a
                  // turma": #0A84FF, citado no diagnóstico do PDF).
                  className={`flex cursor-pointer items-center justify-between gap-3 rounded-klass-control border px-3.5 py-3 ${
                    turmaSelecionada === turma.id ? "border-2 border-text-primary" : "border-border"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="turma"
                      className="h-5 w-5 accent-acento"
                      checked={turmaSelecionada === turma.id}
                      onChange={() => setEscolha({ moduloId: moduloId!, turmaId: turma.id })}
                      disabled={turma.vagasRestantes <= 0 || turma.minhaMatricula !== null}
                    />
                    <div>
                      <p className="text-body-sm font-medium text-text-primary">{turma.codigo}</p>
                      <p className="text-label text-text-muted">
                        {turma.periodoInicio} a {turma.periodoFim} · Prof. {turma.professorNome}
                      </p>
                      {turma.minhaMatricula && (
                        <p className="text-label text-text-muted">Você já se inscreveu nesta turma antes.</p>
                      )}
                    </div>
                  </div>
                  <span className="font-mono text-label tabular-nums text-text-muted">
                    {turma.vagasRestantes} vaga(s)
                  </span>
                </label>
              ))}
            </div>
          </Card>

          <Button
            className="mt-4 w-full"
            variant={!podeInscrever ? "tracejado" : "primary"}
            disabled={!podeInscrever || !turmaSelecionada || inscrevendo || atualizando || turmas.length === 0}
            title={
              !podeInscrever
                ? `Conclua ${preRequisitosPendentes.map((p) => p.nome).join(", ")} antes de se inscrever.`
                : undefined
            }
            onClick={() => void aoInscrever()}
          >
            {inscrevendo
              ? "Inscrevendo..."
              : !podeInscrever
                ? `Requer: ${preRequisitosPendentes.map((p) => p.nome).join(", ")}`
                : "Inscrever-se"}
          </Button>
        </>
      )}

      {matriculaVigente && (
        <Card className="mt-4 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
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
