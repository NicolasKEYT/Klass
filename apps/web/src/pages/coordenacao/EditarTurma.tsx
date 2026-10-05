import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Aviso } from "@/components/Aviso";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { CampoCodigoTurma } from "@/components/turma/CampoCodigoTurma";
import { CampoTurno } from "@/components/turma/CampoTurno";
import { CampoData } from "@/components/CampoData";
import { Input } from "@/components/Input";
import { PaginaAutenticada } from "@/components/PaginaAutenticada";
import { EsqueletoCards } from "@/components/Esqueleto";
import { ErroConsulta } from "@/components/ErroConsulta";
import { useGravacao } from "@/lib/consultas/gravacao";
import { useProfessores } from "@/lib/consultas/identidade";
import { invalidar } from "@/lib/consultas/invalidar";
import { useTurma } from "@/lib/consultas/selecao";
import {
  atualizarTurma,
  validarCodigoTurma,
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
      <PaginaAutenticada largura="estreita" titulo="Editar turma" voltar={{}}>
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
      <PaginaAutenticada largura="estreita" titulo="Editar turma" voltar={{}}>
        <EsqueletoCards quantidade={1} altura="h-96" />
      </PaginaAutenticada>
    );
  }

  if (!turma) {
    return (
      <PaginaAutenticada largura="estreita" titulo="Editar turma" voltar={{}}>
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
  const [turno, setTurno] = useState(turma.turno ?? "");
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
    const erroValidacao = validarCodigoTurma(codigo) ?? validarPeriodoTurma(periodoInicio, periodoFim);
    if (erroValidacao) {
      setErro(erroValidacao);
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
            turno,
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

  // Os dois botões são submit (o "Salvar" era type="button" e pulava a
  // validação nativa do formulário); qual foi clicado vem do submitter.
  async function aoSubmeter(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const submitter = (evento.nativeEvent as SubmitEvent).submitter;
    await salvar(submitter?.dataset.destino !== "ficar");
  }

  return (
    <PaginaAutenticada
      largura="estreita"
      titulo="Editar turma"
      sobrelinha={`${contexto.moduloNome} · ${contexto.trilhaNome}`}
      voltar={{}}
    >

      <Card>
        <form className="flex flex-col gap-4" onSubmit={aoSubmeter}>
          <CampoCodigoTurma valor={codigo} aoMudar={setCodigo} />
          <CampoTurno valor={turno} aoMudar={setTurno} />

          <label className="flex flex-col gap-1.5">
            <span className="text-label font-medium text-text-secondary">Professor responsável</span>
            <select
              required
              className="h-12 sm:h-10 rounded-klass-control border border-controle bg-surface px-3.5 text-body-sm text-text-primary transition focus:border-primary"
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

          <div className="flex flex-col gap-4 sm:flex-row">
            <CampoData
              className="flex-1"
              rotulo="Período — início"
              obrigatorio
              min={PERIODO_TURMA_DATA_MIN}
              max={PERIODO_TURMA_DATA_MAX}
              valor={periodoInicio}
              aoMudar={setPeriodoInicio}
            />
            <CampoData
              className="flex-1"
              rotulo="Período — fim"
              obrigatorio
              min={PERIODO_TURMA_DATA_MIN}
              max={PERIODO_TURMA_DATA_MAX}
              valor={periodoFim}
              aoMudar={setPeriodoFim}
            />
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
            <Button type="submit" data-destino="ficar" variant="secondary" disabled={salvando}>
              Salvar
            </Button>
          </div>
        </form>
      </Card>
    </PaginaAutenticada>
  );
}
