import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Aviso } from "@/components/Aviso";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { PaginaAutenticada } from "@/components/PaginaAutenticada";
import { Titulo } from "@/components/Titulo";
import { listarModulosDaTrilha, listarTrilhas } from "@/lib/catalogo";
import {
  criarTurma,
  listarProfessores,
  validarPeriodoTurma,
  PERIODO_TURMA_DATA_MIN,
  PERIODO_TURMA_DATA_MAX,
} from "@/lib/selecao";
import type { Modulo, Trilha } from "@klass/types";

const ATRASO_ANTES_DE_NAVEGAR_MS = 700;
const FREQUENCIA_MINIMA_PADRAO = 75;

export function NovaTurma() {
  const navigate = useNavigate();
  const [trilhas, setTrilhas] = useState<Trilha[]>([]);
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [professores, setProfessores] = useState<Array<{ id: string; nomeCompleto: string }>>([]);

  const [trilhaId, setTrilhaId] = useState("");
  const [moduloId, setModuloId] = useState("");
  const [codigo, setCodigo] = useState("");
  const [professorId, setProfessorId] = useState("");
  const [periodoInicio, setPeriodoInicio] = useState("");
  const [periodoFim, setPeriodoFim] = useState("");
  const [vagasTotal, setVagasTotal] = useState(30);
  const [frequenciaMinimaPercentual, setFrequenciaMinimaPercentual] = useState(
    FREQUENCIA_MINIMA_PADRAO,
  );

  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    Promise.all([listarTrilhas(), listarProfessores()])
      .then(([todasTrilhas, todosProfessores]) => {
        const publicadas = todasTrilhas.filter((t) => t.publicada);
        setTrilhas(publicadas);
        setProfessores(todosProfessores);
        if (publicadas[0]) setTrilhaId(publicadas[0].id);
        if (todosProfessores[0]) setProfessorId(todosProfessores[0].id);
      })
      .catch((e) => setErro(e instanceof Error ? e.message : "Não foi possível carregar o formulário."));
  }, []);

  // Turma é oferta de um módulo específico — a trilha só existe aqui pra
  // filtrar a lista de módulos, não é gravada em lugar nenhum.
  useEffect(() => {
    if (!trilhaId) {
      setModulos([]);
      setModuloId("");
      return;
    }
    listarModulosDaTrilha(trilhaId)
      .then((lista) => {
        setModulos(lista);
        setModuloId(lista[0]?.id ?? "");
      })
      .catch((e) => setErro(e instanceof Error ? e.message : "Não foi possível carregar os módulos."));
  }, [trilhaId]);

  // "Ficar na tela" não existe pra turma como existe pra trilha — não há
  // uma edição de turma neste módulo. O equivalente de "continuar
  // trabalhando" é ir para a tela de detalhes, não repetir o envio.
  async function salvar(irParaListaAoInves: boolean) {
    setErro(null);
    setMensagem(null);
    const erroPeriodo = validarPeriodoTurma(periodoInicio, periodoFim);
    if (erroPeriodo) {
      setErro(erroPeriodo);
      return;
    }
    setEnviando(true);
    try {
      const turma = await criarTurma({
        moduloId,
        codigo,
        professorId,
        periodoInicio,
        periodoFim,
        vagasTotal,
        frequenciaMinimaPercentual,
      });
      setMensagem("Turma criada.");
      await new Promise((resolve) => setTimeout(resolve, ATRASO_ANTES_DE_NAVEGAR_MS));
      navigate(irParaListaAoInves ? "/coordenacao/turmas" : `/coordenacao/turmas/${turma.id}`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível criar a turma.");
    } finally {
      setEnviando(false);
    }
  }

  async function aoSubmeter(evento: FormEvent) {
    evento.preventDefault();
    await salvar(true);
  }

  return (
    <PaginaAutenticada largura="estreita">
        <BotaoVoltar />
        <Titulo className="mb-6">Nova turma</Titulo>

        <Card>
          <form className="flex flex-col gap-4" onSubmit={aoSubmeter}>
            <label className="flex flex-col gap-1.5">
              <span className="text-label font-medium text-text-secondary">Trilha</span>
              <select
                required
                className="h-9 rounded-klass-control border border-border bg-surface px-3.5 text-body-sm text-text-primary transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={trilhaId}
                onChange={(e) => setTrilhaId(e.target.value)}
              >
                {trilhas.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </select>
              {trilhas.length === 0 && (
                <span className="text-label text-text-muted">
                  Nenhuma trilha publicada ainda — publique uma antes de criar turma.
                </span>
              )}
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-label font-medium text-text-secondary">
                Módulo (disciplina)
              </span>
              <select
                required
                className="h-9 rounded-klass-control border border-border bg-surface px-3.5 text-body-sm text-text-primary transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={moduloId}
                onChange={(e) => setModuloId(e.target.value)}
              >
                {modulos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome}
                  </option>
                ))}
              </select>
              {trilhaId && modulos.length === 0 && (
                <span className="text-label text-text-muted">
                  Essa trilha ainda não tem módulos cadastrados.
                </span>
              )}
            </label>

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
              <span className="text-label font-medium text-text-secondary">
                Professor responsável
              </span>
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
              {professores.length === 0 && (
                <span className="text-label text-text-muted">
                  Nenhum profile com papel de professor cadastrado ainda.
                </span>
              )}
            </label>

            {/* Data: mantemos o input nativo do navegador (type=date), não
                uma máscara própria de dia/mês/ano. É o mais simples de
                manter e não tem a classe de bug de foco/auto-avanço entre
                segmentos que uma máscara manual teria. Os únicos ajustes
                são min/max (limita o ano a 4 dígitos numa faixa sã) e a
                validação de período antes de salvar. */}
            <div className="flex gap-4">
              <label className="flex flex-1 flex-col gap-1.5">
                <span className="text-label font-medium text-text-secondary">
                  Período — início
                </span>
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
              </label>
              <label className="flex flex-1 flex-col gap-1.5">
                <span className="text-label font-medium text-text-secondary">
                  Frequência mínima (%)
                </span>
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
              <Button type="submit" disabled={enviando}>
                {enviando ? "Criando..." : "Salvar e voltar"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={enviando}
                onClick={() => void salvar(false)}
              >
                Salvar e ver detalhes
              </Button>
            </div>
          </form>
        </Card>
    </PaginaAutenticada>
  );
}
