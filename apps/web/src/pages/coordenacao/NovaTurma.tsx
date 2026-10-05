import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Aviso } from "@/components/Aviso";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { CampoData } from "@/components/CampoData";
import { Input } from "@/components/Input";
import { PaginaAutenticada } from "@/components/PaginaAutenticada";
import { ErroConsulta } from "@/components/ErroConsulta";
import { CampoCodigoTurma } from "@/components/turma/CampoCodigoTurma";
import { CampoTurno } from "@/components/turma/CampoTurno";
import { plural } from "@/lib/plural";
import { useAvaliacoesModelo, useModulosDaTrilha, useTrilhas } from "@/lib/consultas/catalogo";
import { useGravacao } from "@/lib/consultas/gravacao";
import { useProfessores } from "@/lib/consultas/identidade";
import { useTurmasDaCoordenacao } from "@/lib/consultas/selecao";
import { invalidar } from "@/lib/consultas/invalidar";
import {
  criarTurma,
  turmasSobrepostas,
  validarCodigoTurma,
  validarPeriodoTurma,
  PERIODO_TURMA_DATA_MIN,
  PERIODO_TURMA_DATA_MAX,
} from "@/lib/selecao";

const ATRASO_ANTES_DE_NAVEGAR_MS = 700;
const FREQUENCIA_MINIMA_PADRAO = 75;

export function NovaTurma() {
  const navigate = useNavigate();
  const gravar = useGravacao();
  const consultaTrilhas = useTrilhas();
  const consultaProfessores = useProfessores();
  const trilhas = (consultaTrilhas.data ?? []).filter((t) => t.publicada);
  const professores = consultaProfessores.data ?? [];

  // Escolha do usuário; sem escolha, vale o primeiro item da lista (o
  // padrão chega junto com os dados, sem efeito de sincronização).
  const [trilhaEscolhida, setTrilhaId] = useState("");
  const trilhaId = trilhaEscolhida || trilhas[0]?.id || "";
  // Turma é oferta de um módulo específico — a trilha só existe aqui pra
  // filtrar a lista de módulos, não é gravada em lugar nenhum.
  const consultaModulos = useModulosDaTrilha(trilhaId || undefined);
  const modulos = consultaModulos.isPlaceholderData ? [] : (consultaModulos.data ?? []);
  const [moduloEscolhido, setModuloEscolhido] = useState<{ trilhaId: string; moduloId: string } | null>(null);
  const moduloId =
    moduloEscolhido && moduloEscolhido.trilhaId === trilhaId ? moduloEscolhido.moduloId : (modulos[0]?.id ?? "");
  const setModuloId = (id: string) => setModuloEscolhido({ trilhaId, moduloId: id });
  const modeloDoModulo = useAvaliacoesModelo(moduloId || undefined);
  const [codigo, setCodigo] = useState("");
  const [turno, setTurno] = useState("");
  const [professorEscolhido, setProfessorId] = useState("");
  const professorId = professorEscolhido || professores[0]?.id || "";
  const erroDeLeitura = consultaTrilhas.error ?? consultaProfessores.error ?? consultaModulos.error;
  const [periodoInicio, setPeriodoInicio] = useState("");
  const [periodoFim, setPeriodoFim] = useState("");
  const [vagasTotal, setVagasTotal] = useState(30);
  // A frequência nasce com o padrão da trilha escolhida (C9) e pode ser
  // ajustada só para esta turma; trocar de trilha volta ao padrão dela.
  const trilhaSelecionada = trilhas.find((t) => t.id === trilhaId);
  const frequenciaDaTrilha = trilhaSelecionada?.frequencia_minima_percentual ?? FREQUENCIA_MINIMA_PADRAO;
  const [frequenciaEditada, setFrequenciaEditada] = useState<{ trilhaId: string; valor: number } | null>(null);
  const frequenciaMinimaPercentual =
    frequenciaEditada && frequenciaEditada.trilhaId === trilhaId ? frequenciaEditada.valor : frequenciaDaTrilha;
  const setFrequenciaMinimaPercentual = (valor: number) => setFrequenciaEditada({ trilhaId, valor });

  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // "Ficar na tela" não existe pra turma como existe pra trilha — não há
  // uma edição de turma neste módulo. O equivalente de "continuar
  // trabalhando" é ir para a tela de detalhes, não repetir o envio.
  async function salvar(irParaListaAoInves: boolean) {
    setErro(null);
    setMensagem(null);
    const erroValidacao = validarCodigoTurma(codigo) ?? validarPeriodoTurma(periodoInicio, periodoFim);
    if (erroValidacao) {
      setErro(erroValidacao);
      return;
    }
    setEnviando(true);
    try {
      const turma = await gravar(
        () =>
          criarTurma({
            moduloId,
            codigo,
            professorId,
            periodoInicio,
            periodoFim,
            vagasTotal,
            frequenciaMinimaPercentual,
            turno,
          }),
        (qc) => invalidar.turma(qc),
      );
      setMensagem("Turma criada.");
      await new Promise((resolve) => setTimeout(resolve, ATRASO_ANTES_DE_NAVEGAR_MS));
      navigate(irParaListaAoInves ? "/coordenacao/turmas" : `/coordenacao/turmas/${turma.id}`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível criar a turma.");
    } finally {
      setEnviando(false);
    }
  }

  // Os dois botões são submit (o segundo era type="button" e pulava a
  // validação nativa do formulário — required, min/max); qual foi clicado
  // vem do submitter.
  async function aoSubmeter(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const submitter = (evento.nativeEvent as SubmitEvent).submitter;
    await salvar(submitter?.dataset.destino !== "detalhes");
  }

  // Turmas paralelas do mesmo módulo são legítimas (ex.: noite e sábado);
  // o aviso só evita criar uma duplicada sem querer.
  const consultaTurmas = useTurmasDaCoordenacao();
  const sobrepostas = turmasSobrepostas(consultaTurmas.data ?? [], moduloId, periodoInicio, periodoFim);

  return (
    <PaginaAutenticada largura="estreita" titulo="Nova turma" voltar={{}}>
        {erroDeLeitura && (
          <ErroConsulta
            className="mb-4"
            erro={erroDeLeitura}
            padrao="Não foi possível carregar o formulário."
            tentarDeNovo={() => {
              if (consultaTrilhas.isError) void consultaTrilhas.refetch();
              if (consultaProfessores.isError) void consultaProfessores.refetch();
              if (consultaModulos.isError) void consultaModulos.refetch();
            }}
          />
        )}

        <Card>
          <form className="flex flex-col gap-4" onSubmit={aoSubmeter}>
            <label className="flex flex-col gap-1.5">
              <span className="text-label font-medium text-text-secondary">Trilha</span>
              <select
                required
                className="h-12 sm:h-10 rounded-klass-control border border-controle bg-surface px-3.5 text-body-sm text-text-primary transition focus:border-primary"
                value={trilhaId}
                onChange={(e) => setTrilhaId(e.target.value)}
              >
                {trilhas.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </select>
              {consultaTrilhas.isSuccess && trilhas.length === 0 && (
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
                className="h-12 sm:h-10 rounded-klass-control border border-controle bg-surface px-3.5 text-body-sm text-text-primary transition focus:border-primary"
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
              {/* Modelo de avaliações do módulo: a turma nasce com ele (o
                  diário copia no banco ao criar a turma). */}
              {moduloId && modeloDoModulo.data && (
                <span className="text-label text-text-secondary" role="status">
                  {modeloDoModulo.data.length > 0
                    ? `Esta turma vai nascer com ${plural(modeloDoModulo.data.length, "avaliação", "avaliações")} do modelo do módulo (${modeloDoModulo.data.map((a) => a.titulo).join(", ")}); o professor pode ajustar depois.`
                    : "Este módulo não tem avaliações padrão: a turma nasce sem avaliações, e o professor as cria."}
                </span>
              )}
            </label>

            <CampoCodigoTurma valor={codigo} aoMudar={setCodigo} />
            <CampoTurno valor={turno} aoMudar={setTurno} />

            <label className="flex flex-col gap-1.5">
              <span className="text-label font-medium text-text-secondary">
                Professor responsável
              </span>
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
              {professores.length === 0 && (
                <span className="text-label text-text-muted">
                  Nenhum profile com papel de professor cadastrado ainda.
                </span>
              )}
            </label>

            {/* Datas em DD/MM/AAAA com máscara própria (CampoData): o input
                nativo segmentado pulava do dia para o mês ao digitar "1"
                de "12". O valor trocado com o resto continua AAAA-MM-DD. */}
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
                <span className="text-label text-text-muted">
                  Padrão da trilha: {frequenciaDaTrilha}%. Ajuste só se esta turma for diferente.
                </span>
              </label>
            </div>

            {sobrepostas.length > 0 && (
              <p className="text-label text-text-secondary">
                Atenção: {sobrepostas.length === 1 ? "a turma" : "as turmas"}{" "}
                {sobrepostas.map((t) => t.codigo).join(", ")} deste módulo já{" "}
                {sobrepostas.length === 1 ? "tem" : "têm"} período que se sobrepõe a este. Turmas
                paralelas são permitidas; confira se não é uma duplicata.
              </p>
            )}
            {erro && <Aviso variant="danger">{erro}</Aviso>}
            {mensagem && <Aviso variant="success">{mensagem}</Aviso>}

            <div className="flex gap-3">
              <Button type="submit" disabled={enviando}>
                {enviando ? "Criando..." : "Salvar e voltar"}
              </Button>
              <Button type="submit" data-destino="detalhes" variant="secondary" disabled={enviando}>
                Salvar e ver detalhes
              </Button>
            </div>
          </form>
        </Card>
    </PaginaAutenticada>
  );
}
