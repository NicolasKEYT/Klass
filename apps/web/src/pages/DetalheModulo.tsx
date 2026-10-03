import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Check, Clock, Lock } from "lucide-react";
import { useAuth } from "@/auth";
import { Aviso } from "@/components/Aviso";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { IconeCatalogo } from "@/components/IconeCatalogo";
import { PaginaAutenticada } from "@/components/PaginaAutenticada";
import { StatusBadge } from "@/components/StatusBadge";
import { Titulo } from "@/components/Titulo";
import {
  buscarTrilhaPorId,
  buscarTrilhaPorSlug,
  listarModulosDaTrilha,
  listarPreRequisitosDoModulo,
} from "@/lib/catalogo";
import {
  inscreverAluno,
  listarMatriculasDoAluno,
  listarModulosComTurmasDaTrilha,
  type MatriculaDoAluno,
  type StatusMatricula,
  type TurmaDisponivel,
} from "@/lib/selecao";
import type { Modulo, NivelModulo, Trilha } from "@klass/types";

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

  const [trilha, setTrilha] = useState<Trilha | null | undefined>(undefined);
  const [modulo, setModulo] = useState<Modulo | null>(null);
  const [carregando, setCarregando] = useState(true);
  // Incrementado após uma inscrição bem-sucedida, para recarregar a
  // matrícula e trocar o botão pelo estado "Em análise".
  const [recarga, setRecarga] = useState(0);
  const [matriculasNoModulo, setMatriculasNoModulo] = useState<MatriculaDoAluno[]>([]);
  const [preRequisitos, setPreRequisitos] = useState<PreRequisitoStatus[]>([]);
  const [turmas, setTurmas] = useState<TurmaDisponivel[]>([]);
  const [turmaSelecionada, setTurmaSelecionada] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [inscrevendo, setInscrevendo] = useState(false);

  useEffect(() => {
    if (!slug || !moduloId) return;
    let ativo = true;

    async function carregar() {
      setErro(null);
      setCarregando(true);
      try {
        // A trilha só vai para o estado junto com o módulo, no fim: antes,
        // ela era definida sozinha e a tela caía em "Módulo não
        // encontrado" durante toda a busca do módulo.
        const trilhaEncontrada = await buscarTrilhaPorSlug(slug!);
        if (!ativo) return;
        if (!trilhaEncontrada) {
          setTrilha(null);
          setModulo(null);
          return;
        }

        const [modulos, preReqs, modulosComTurmas, minhasMatriculas] = await Promise.all([
          listarModulosDaTrilha(trilhaEncontrada.id),
          listarPreRequisitosDoModulo(moduloId!),
          listarModulosComTurmasDaTrilha(trilhaEncontrada.id, usuario?.id ?? null),
          usuario ? listarMatriculasDoAluno(usuario.id) : Promise.resolve([]),
        ]);
        if (!ativo) return;

        // Hoje o banco só aceita pré-requisito da mesma trilha, mas o slug
        // de outra trilha é buscado mesmo assim — o nome e o link vêm do
        // próprio pré-requisito, nunca mais como "—".
        const outrasTrilhaIds = [
          ...new Set(preReqs.map((p) => p.trilha_id).filter((id) => id !== trilhaEncontrada.id)),
        ];
        const outrasTrilhas = await Promise.all(outrasTrilhaIds.map((id) => buscarTrilhaPorId(id)));
        if (!ativo) return;
        const slugPorTrilha = new Map<string, string>([[trilhaEncontrada.id, trilhaEncontrada.slug]]);
        for (const t of outrasTrilhas) if (t) slugPorTrilha.set(t.id, t.slug);

        const statusPreReq: PreRequisitoStatus[] = preReqs.map((pr) => {
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

        const turmasDoModulo = modulosComTurmas.find((m) => m.moduloId === moduloId)?.turmas ?? [];

        setTrilha(trilhaEncontrada);
        setModulo(modulos.find((m) => m.id === moduloId) ?? null);
        setPreRequisitos(statusPreReq);
        setMatriculasNoModulo(minhasMatriculas.filter((m) => m.moduloId === moduloId));
        setTurmas(turmasDoModulo);
        // Turma onde o aluno já teve matrícula não pode ser escolhida de
        // novo (unique aluno+turma no banco) — pré-seleciona a primeira livre.
        setTurmaSelecionada(
          turmasDoModulo.find((t) => !t.minhaMatricula && t.vagasRestantes > 0)?.id ?? null,
        );
      } catch (e) {
        if (ativo) setErro(e instanceof Error ? e.message : "Não foi possível carregar o módulo.");
      } finally {
        if (ativo) setCarregando(false);
      }
    }

    void carregar();
    return () => {
      ativo = false;
    };
    // usuario?.id, não usuario: o AuthProvider troca a referência do
    // objeto usuario a cada revalidação de sessão (foco de aba, refresh de
    // token — ver AuthProvider.tsx), mesmo sendo o mesmo usuário. Depender
    // do objeto inteiro reiniciava esta busca a cada troca de aba,
    // cancelando a chamada em andamento; se a corrida terminasse mal, a
    // tela ficava com erro=null e módulo=null — "Módulo não encontrado"
    // falso, sem nenhum erro real por trás.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, moduloId, usuario?.id, recarga]);

  const preRequisitosPendentes = preRequisitos.filter((p) => p.status !== "concluido");
  const podeInscrever = preRequisitosPendentes.length === 0;

  async function aoInscrever() {
    if (!turmaSelecionada) return;
    setErro(null);
    setMensagem(null);
    setInscrevendo(true);
    try {
      await inscreverAluno(turmaSelecionada);
      setMensagem("Inscrição enviada — a coordenação vai avaliar em breve.");
      setRecarga((n) => n + 1);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível se inscrever nesta turma.");
    } finally {
      setInscrevendo(false);
    }
  }

  // Erro de carregamento (rede, RLS, timeout) precisa vir antes das
  // checagens abaixo — sem isso, uma falha na consulta ficava mascarada
  // como "Módulo não encontrado" (trilha/modulo nunca chegavam a ser
  // definidos) ou como um "Carregando..." que nunca resolve.
  if (erro && !modulo) {
    return (
      <PaginaAutenticada largura="estreita">
        <Link to="/catalogo" className="mb-4 flex items-center gap-1.5 text-body-sm font-medium text-text-secondary hover:text-text-primary">
          ← Catálogo
        </Link>
        <Aviso variant="danger">{erro}</Aviso>
      </PaginaAutenticada>
    );
  }

  // Comparar o id evita mostrar o módulo anterior ao trocar de módulo e
  // evita piscar a tela inteira no recarregamento pós-inscrição.
  if (carregando && modulo?.id !== moduloId) {
    return (
      <PaginaAutenticada largura="estreita">
        <p className="text-body-sm text-text-secondary">Carregando...</p>
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
                      onChange={() => setTurmaSelecionada(turma.id)}
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
            disabled={!podeInscrever || !turmaSelecionada || inscrevendo || carregando || turmas.length === 0}
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
