import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Check, Clock, Lock } from "lucide-react";
import { useAuth } from "@/auth";
import { Aviso } from "@/components/Aviso";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { IconeCatalogo } from "@/components/IconeCatalogo";
import { PaginaAutenticada } from "@/components/PaginaAutenticada";
import { Titulo } from "@/components/Titulo";
import { buscarTrilhaPorSlug, listarModulosDaTrilha, listarPreRequisitosIds } from "@/lib/catalogo";
import {
  inscreverAluno,
  listarMatriculasDoAluno,
  listarModulosComTurmasDaTrilha,
  type TurmaDisponivel,
} from "@/lib/selecao";
import type { Modulo, NivelModulo, Trilha } from "@klass/types";

const NIVEL_LABEL: Record<NivelModulo, string> = {
  iniciante: "Iniciante",
  intermediario: "Intermediário",
  avancado: "Avançado",
};

interface PreRequisitoStatus {
  moduloId: string;
  nome: string;
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
      try {
        const trilhaEncontrada = await buscarTrilhaPorSlug(slug!);
        if (!ativo) return;
        setTrilha(trilhaEncontrada);
        if (!trilhaEncontrada) return;

        const [modulos, preReqIds, modulosComTurmas, minhasMatriculas] = await Promise.all([
          listarModulosDaTrilha(trilhaEncontrada.id),
          listarPreRequisitosIds(moduloId!),
          listarModulosComTurmasDaTrilha(trilhaEncontrada.id, usuario?.id ?? null),
          usuario ? listarMatriculasDoAluno(usuario.id) : Promise.resolve([]),
        ]);
        if (!ativo) return;

        const alvo = modulos.find((m) => m.id === moduloId) ?? null;
        setModulo(alvo);

        const nomePorId = new Map(modulos.map((m) => [m.id, m.nome]));
        const statusPreReq: PreRequisitoStatus[] = preReqIds.map((id) => {
          const matricula = minhasMatriculas.find((m) => m.moduloId === id);
          if (matricula?.status === "concluida") {
            return { moduloId: id, nome: nomePorId.get(id) ?? "—", status: "concluido", data: matricula.periodoFim };
          }
          if (matricula?.status === "matriculada") {
            return { moduloId: id, nome: nomePorId.get(id) ?? "—", status: "cursando", data: matricula.periodoFim };
          }
          return { moduloId: id, nome: nomePorId.get(id) ?? "—", status: "pendente", data: null };
        });
        setPreRequisitos(statusPreReq);

        const turmasDoModulo = modulosComTurmas.find((m) => m.moduloId === moduloId)?.turmas ?? [];
        setTurmas(turmasDoModulo);
        setTurmaSelecionada(turmasDoModulo[0]?.id ?? null);
      } catch (e) {
        if (ativo) setErro(e instanceof Error ? e.message : "Não foi possível carregar o módulo.");
      }
    }

    void carregar();
    return () => {
      ativo = false;
    };
  }, [slug, moduloId, usuario]);

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
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível se inscrever nesta turma.");
    } finally {
      setInscrevendo(false);
    }
  }

  if (trilha === undefined) {
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

  const minhaMatricula = turmas.find((t) => t.minhaMatricula)?.minhaMatricula;

  return (
    <PaginaAutenticada largura="estreita">
      <Link
        to={`/catalogo/${trilha.slug}`}
        className="mb-4 flex items-center gap-1.5 text-body-sm font-medium text-text-secondary hover:text-text-primary"
      >
        ← Catálogo
      </Link>

      <div className="flex items-center gap-2">
        <IconeCatalogo nome={modulo.icone} className="h-6 w-6 text-primary" />
        <Titulo>{modulo.nome}</Titulo>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Badge variant="neutral">{NIVEL_LABEL[modulo.nivel]}</Badge>
        <Badge variant="neutral">{modulo.carga_horaria_horas} h</Badge>
        <Badge variant="neutral">Trilha {trilha.nome}</Badge>
      </div>

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
                {p.status === "concluido" && <Check className="h-4 w-4 shrink-0 text-success" aria-hidden />}
                {p.status === "cursando" && <Clock className="h-4 w-4 shrink-0 text-warning" aria-hidden />}
                {p.status === "pendente" && <Lock className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />}
                <div>
                  <p className="text-body-sm font-medium text-text-primary">{p.nome}</p>
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

      {profile?.papel === "aluno" && !minhaMatricula && (
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
                  className={`flex cursor-pointer items-center justify-between gap-3 rounded-klass-control border px-3.5 py-3 ${
                    turmaSelecionada === turma.id ? "border-primary bg-primary-subtle" : "border-border"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="turma"
                      className="h-5 w-5"
                      checked={turmaSelecionada === turma.id}
                      onChange={() => setTurmaSelecionada(turma.id)}
                      disabled={turma.vagasRestantes <= 0}
                    />
                    <div>
                      <p className="text-body-sm font-medium text-text-primary">{turma.codigo}</p>
                      <p className="text-label text-text-muted">
                        {turma.periodoInicio} a {turma.periodoFim} · Prof. {turma.professorNome}
                      </p>
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
            disabled={!podeInscrever || !turmaSelecionada || inscrevendo || turmas.length === 0}
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

      {minhaMatricula && (
        <Card className="mt-4">
          <p className="text-body-sm text-text-secondary">
            Você já tem uma inscrição neste módulo — acompanhe pelo{" "}
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
