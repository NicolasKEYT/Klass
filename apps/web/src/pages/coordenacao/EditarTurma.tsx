import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Aviso } from "@/components/Aviso";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { PaginaAutenticada } from "@/components/PaginaAutenticada";
import { Titulo } from "@/components/Titulo";
import { EsqueletoCards } from "@/components/Esqueleto";
import { ErroConsulta } from "@/components/ErroConsulta";
import { useGravacao } from "@/lib/consultas/gravacao";
import { useProfessores } from "@/lib/consultas/identidade";
import { invalidar } from "@/lib/consultas/invalidar";
import { useTurma } from "@/lib/consultas/selecao";
import {
  atualizarTurma,
  validarPeriodoTurma,
  PERIODO_TURMA_DATA_MIN,
  PERIODO_TURMA_DATA_MAX,
  type TurmaDetalhada,
} from "@/lib/selecao";

// Módulo/trilha não são editáveis aqui: a turma é a oferta de um módulo
// específico, trocar o módulo seria criar outra turma. O que a
// coordenação ajusta depois de criada é código, professor, período,
// vagas e frequência mínima — inclusive corrigir a frequência mínima,
// que antes só dava para definir na criação.
export function EditarTurma() {
  const { id } = useParams<{ id: string }>();
  // A turma costuma já estar em cache (vinda do detalhe da turma).
  const consultaTurma = useTurma(id);
  const consultaProfessores = useProfessores();
  const turma = consultaTurma.data;
  const erroDeLeitura = consultaTurma.error ?? consultaProfessores.error;

  if (erroDeLeitura) {
    return (
      <PaginaAutenticada largura="estreita">
        <BotaoVoltar />
        <ErroConsulta
          erro={erroDeLeitura}
          padrao="Não foi possível carregar a turma."
          tentarDeNovo={() => {
            if (consultaTurma.isError) void consultaTurma.refetch();
            if (consultaProfessores.isError) void consultaProfessores.refetch();
          }}
        />
      </PaginaAutenticada>
    );
  }

  if (consultaTurma.isPending || consultaProfessores.isPending) {
    return (
      <PaginaAutenticada largura="estreita">
        <EsqueletoCards quantidade={1} altura="h-96" />
      </PaginaAutenticada>
    );
  }

  if (!turma) {
    return (
      <PaginaAutenticada largura="estreita">
        <BotaoVoltar />
        <Aviso variant="danger">Turma não encontrada.</Aviso>
      </PaginaAutenticada>
    );
  }

  return <FormularioTurma key={turma.id} turma={turma} professores={consultaProfessores.data ?? []} />;
}

function FormularioTurma({
  turma,
  professores,
}: {
  turma: TurmaDetalhada;
  professores: Array<{ id: string; nomeCompleto: string }>;
}) {
  const id = turma.id;
  const navigate = useNavigate();
  const gravar = useGravacao();
  const contexto = { moduloNome: turma.moduloNome, trilhaNome: turma.trilhaNome };

  // O formulário parte da turma como estava ao abrir a tela.
  const [codigo, setCodigo] = useState(turma.codigo);
  const [professorId, setProfessorId] = useState(turma.professorId);
  const [periodoInicio, setPeriodoInicio] = useState(turma.periodoInicio);
  const [periodoFim, setPeriodoFim] = useState(turma.periodoFim);
  const [vagasTotal, setVagasTotal] = useState(turma.vagasTotal);
  const [frequenciaMinimaPercentual, setFrequenciaMinimaPercentual] = useState(
    turma.frequenciaMinimaPercentual,
  );

  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(voltar: boolean) {
    setErro(null);
    setMensagem(null);
    const erroPeriodo = validarPeriodoTurma(periodoInicio, periodoFim);
    if (erroPeriodo) {
      setErro(erroPeriodo);
      return;
    }
    setSalvando(true);
    try {
      await gravar(
        () =>
          atualizarTurma(id, {
            codigo,
            professorId,
            periodoInicio,
            periodoFim,
            vagasTotal,
            frequenciaMinimaPercentual,
          }),
        (qc) => invalidar.turma(qc, id),
      );
      setMensagem("Turma atualizada.");
      if (voltar) {
        // Espera o aviso aparecer antes de sair da tela.
        await new Promise((resolve) => setTimeout(resolve, 700));
        navigate(`/coordenacao/turmas/${id}`);
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar a turma.");
    } finally {
      setSalvando(false);
    }
  }

  async function aoSubmeter(evento: FormEvent) {
    evento.preventDefault();
    await salvar(true);
  }

  return (
    <PaginaAutenticada largura="estreita">
      <BotaoVoltar />
      <Titulo className="mb-1">Editar turma</Titulo>
      <p className="mb-6 text-body-sm text-text-secondary">
        {contexto.moduloNome} · {contexto.trilhaNome}
      </p>

      <Card>
        <form className="flex flex-col gap-4" onSubmit={aoSubmeter}>
          <label className="flex flex-col gap-1.5">
            <span className="text-label font-medium text-text-secondary">Código</span>
            <Input
              required
              placeholder="Ex.: CDA-2026-1"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            />
            <span className="text-label text-text-muted">
              Letras e números separados por hífen, em 2 ou 3 partes. Ex.: CDA-2026-1.
            </span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-label font-medium text-text-secondary">Professor responsável</span>
            <select
              required
              className="h-12 sm:h-10 rounded-klass-control border border-border bg-surface px-3.5 text-body-sm text-text-primary transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              value={professorId}
              onChange={(e) => setProfessorId(e.target.value)}
            >
              {professores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nomeCompleto}
                </option>
              ))}
            </select>
          </label>

          <div className="flex gap-4">
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-label font-medium text-text-secondary">Período — início</span>
              <Input
                type="date"
                required
                min={PERIODO_TURMA_DATA_MIN}
                max={PERIODO_TURMA_DATA_MAX}
                value={periodoInicio}
                onChange={(e) => setPeriodoInicio(e.target.value)}
              />
            </label>
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-label font-medium text-text-secondary">Período — fim</span>
              <Input
                type="date"
                required
                min={PERIODO_TURMA_DATA_MIN}
                max={PERIODO_TURMA_DATA_MAX}
                value={periodoFim}
                onChange={(e) => setPeriodoFim(e.target.value)}
              />
            </label>
          </div>

          <div className="flex gap-4">
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-label font-medium text-text-secondary">Vagas</span>
              <Input
                type="number"
                min={1}
                required
                value={vagasTotal}
                onChange={(e) => setVagasTotal(Number(e.target.value))}
              />
              <span className="text-label text-text-muted">
                Não é possível reduzir abaixo do número de alunos já matriculados.
              </span>
            </label>
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-label font-medium text-text-secondary">Frequência mínima (%)</span>
              <Input
                type="number"
                min={0}
                max={100}
                required
                value={frequenciaMinimaPercentual}
                onChange={(e) => setFrequenciaMinimaPercentual(Number(e.target.value))}
              />
            </label>
          </div>

          {erro && <Aviso variant="danger">{erro}</Aviso>}
          {mensagem && <Aviso variant="success">{mensagem}</Aviso>}

          <div className="flex gap-3">
            <Button type="submit" disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar e voltar"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={salvando}
              onClick={() => void salvar(false)}
            >
              Salvar
            </Button>
          </div>
        </form>
      </Card>
    </PaginaAutenticada>
  );
}
