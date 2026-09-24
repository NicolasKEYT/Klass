import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Aviso } from "@/components/Aviso";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { PaginaAutenticada } from "@/components/PaginaAutenticada";
import { Titulo } from "@/components/Titulo";
import {
  atualizarTurma,
  buscarTurmaDetalhada,
  listarProfessores,
  validarPeriodoTurma,
  PERIODO_TURMA_DATA_MIN,
  PERIODO_TURMA_DATA_MAX,
} from "@/lib/selecao";

// Módulo/trilha não são editáveis aqui: a turma é a oferta de um módulo
// específico, trocar o módulo seria criar outra turma. O que a
// coordenação ajusta depois de criada é código, professor, período,
// vagas e frequência mínima — inclusive corrigir a frequência mínima,
// que antes só dava para definir na criação.
export function EditarTurma() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [contexto, setContexto] = useState<{ moduloNome: string; trilhaNome: string } | null>(null);
  const [professores, setProfessores] = useState<Array<{ id: string; nomeCompleto: string }>>([]);
  const [carregando, setCarregando] = useState(true);

  const [codigo, setCodigo] = useState("");
  const [professorId, setProfessorId] = useState("");
  const [periodoInicio, setPeriodoInicio] = useState("");
  const [periodoFim, setPeriodoFim] = useState("");
  const [vagasTotal, setVagasTotal] = useState(30);
  const [frequenciaMinimaPercentual, setFrequenciaMinimaPercentual] = useState(75);

  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([buscarTurmaDetalhada(id), listarProfessores()])
      .then(([turma, listaProfessores]) => {
        setProfessores(listaProfessores);
        if (!turma) {
          setErro("Turma não encontrada.");
          return;
        }
        setContexto({ moduloNome: turma.moduloNome, trilhaNome: turma.trilhaNome });
        setCodigo(turma.codigo);
        setProfessorId(turma.professorId);
        setPeriodoInicio(turma.periodoInicio);
        setPeriodoFim(turma.periodoFim);
        setVagasTotal(turma.vagasTotal);
        setFrequenciaMinimaPercentual(turma.frequenciaMinimaPercentual);
      })
      .catch((e) => setErro(e instanceof Error ? e.message : "Não foi possível carregar a turma."))
      .finally(() => setCarregando(false));
  }, [id]);

  async function salvar(voltar: boolean) {
    if (!id) return;
    setErro(null);
    setMensagem(null);
    const erroPeriodo = validarPeriodoTurma(periodoInicio, periodoFim);
    if (erroPeriodo) {
      setErro(erroPeriodo);
      return;
    }
    setSalvando(true);
    try {
      await atualizarTurma(id, {
        codigo,
        professorId,
        periodoInicio,
        periodoFim,
        vagasTotal,
        frequenciaMinimaPercentual,
      });
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

  if (carregando) {
    return (
      <PaginaAutenticada largura="estreita">
        <p className="text-body-sm text-text-secondary">Carregando...</p>
      </PaginaAutenticada>
    );
  }

  if (!contexto) {
    return (
      <PaginaAutenticada largura="estreita">
        <BotaoVoltar />
        <Aviso variant="danger">{erro ?? "Turma não encontrada."}</Aviso>
      </PaginaAutenticada>
    );
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
              className="h-9 rounded-klass-control border border-border bg-surface px-3.5 text-body-sm text-text-primary transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
