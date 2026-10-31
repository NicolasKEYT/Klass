import { useSearchParams } from "react-router-dom";
import { Download } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { ErroConsulta } from "@/components/ErroConsulta";
import { GraficoBarras, type ItemGrafico } from "@/components/graficos/GraficoBarras";
import { GraficoColunas } from "@/components/graficos/GraficoColunas";
import { GraficoLinha, type PontoGrafico } from "@/components/graficos/GraficoLinha";
import { completarMeses, rotuloDoMes } from "@/components/graficos/escalaGrafico";
import { KpiCartao, type VariacaoKpi } from "@/components/graficos/KpiCartao";
import { LinkBotao } from "@/components/LinkBotao";
import { PaginaAutenticada } from "@/components/PaginaAutenticada";
import { useTrilhas } from "@/lib/consultas/catalogo";
import { useIndicadoresCoordenacao } from "@/lib/consultas/relatorios";
import {
  lerFiltroRelatorio,
  paramsDoFiltro,
  periodoAnterior,
  PERIODOS,
  type FiltroRelatorio,
  type PeriodoPredefinido,
} from "@/lib/filtroRelatorio";
import { formatarData, formatarDecimal, formatarMedia, formatarPercentual } from "@/lib/formato";
import type { IndicadoresCoordenacao } from "@/lib/relatorios";

const PADRAO: PeriodoPredefinido = "ano";
const FREQUENCIA_MINIMA = 75;
const MAX_TURMAS = 15;

const classeSelect =
  "h-12 sm:h-10 rounded-klass-control border border-controle bg-surface px-3 text-klass-md text-text-primary";

type Kpis = IndicadoresCoordenacao["kpis"];

interface DefinicaoKpi {
  chave: keyof Kpis;
  rotulo: string;
  apoio?: string;
  formatar: (v: number) => string;
  /** Percentuais variam em pontos percentuais; contagens, em unidades. */
  unidade: "" | " p.p.";
}

const KPIS: DefinicaoKpi[] = [
  { chave: "alunos_ativos", rotulo: "Alunos ativos", formatar: String, unidade: "" },
  { chave: "matriculas_ativas", rotulo: "Matrículas ativas", formatar: String, unidade: "" },
  { chave: "inscricoes_pendentes", rotulo: "Inscrições pendentes", apoio: "aguardando deferimento", formatar: String, unidade: "" },
  { chave: "taxa_conclusao", rotulo: "Taxa de conclusão", apoio: "das matrículas encerradas", formatar: formatarPercentual, unidade: " p.p." },
  { chave: "taxa_evasao", rotulo: "Taxa de evasão", apoio: "canceladas ou reprovadas", formatar: formatarPercentual, unidade: " p.p." },
  { chave: "frequencia_media", rotulo: "Frequência média", apoio: `mínimo ${FREQUENCIA_MINIMA}%`, formatar: formatarPercentual, unidade: " p.p." },
  { chave: "nota_media", rotulo: "Nota média", apoio: "de 0 a 10", formatar: formatarMedia, unidade: "" },
  { chave: "certificados_periodo", rotulo: "Certificados no período", formatar: String, unidade: "" },
  { chave: "ocupacao_media", rotulo: "Ocupação média das turmas", apoio: "vagas preenchidas", formatar: formatarPercentual, unidade: " p.p." },
];

function variacaoDo(def: DefinicaoKpi, atual: number | null, anterior: number | null | undefined): VariacaoKpi | undefined {
  if (atual === null || anterior === null || anterior === undefined) return undefined;
  const dif = Math.round((atual - anterior) * 10) / 10;
  if (dif === 0) return { texto: "igual", sentido: "igual" };
  const sinal = dif > 0 ? "+" : "−";
  return {
    texto: `${sinal}${formatarDecimal(Math.abs(dif), 1)}${def.unidade}`,
    sentido: dif > 0 ? "alta" : "queda",
  };
}

const ordenarPorValor = <T extends ItemGrafico>(itens: T[]) =>
  [...itens].sort((a, b) => b.valor - a.valor || a.rotulo.localeCompare(b.rotulo, "pt-BR"));

export function Indicadores() {
  const [params, setParams] = useSearchParams();
  const trilhas = useTrilhas();
  const filtro = lerFiltroRelatorio(params, PADRAO);
  const anterior = periodoAnterior(filtro);

  const consulta = useIndicadoresCoordenacao({ inicio: filtro.inicio, fim: filtro.fim, trilhaId: filtro.trilhaId });
  const consultaAnterior = useIndicadoresCoordenacao(
    { inicio: anterior?.inicio, fim: anterior?.fim, trilhaId: filtro.trilhaId },
    anterior !== null,
  );
  const dados = consulta.data;

  function aplicar(novo: FiltroRelatorio) {
    setParams(paramsDoFiltro(novo), { replace: true });
  }

  const noExports = `/coordenacao/exports?${paramsDoFiltro(filtro).toString()}`;

  const trilhaNome = (id: string) => trilhas.data?.find((t) => t.id === id)?.nome;
  const rotuloPeriodo = filtro.periodo
    ? PERIODOS.find((p) => p.valor === filtro.periodo)?.rotulo
    : `${filtro.inicio ? formatarData(filtro.inicio) : "início"} a ${filtro.fim ? formatarData(filtro.fim) : "hoje"}`;

  // --- séries -------------------------------------------------------------
  const matriculasPorMes: PontoGrafico[] = completarMeses(dados?.matriculas_por_mes ?? []).map((m) => ({
    id: m.mes,
    rotulo: rotuloDoMes(m.mes),
    valor: m.total,
  }));
  const certificadosPorMes: PontoGrafico[] = completarMeses(dados?.certificados_por_mes ?? []).map((m) => ({
    id: m.mes,
    rotulo: rotuloDoMes(m.mes),
    valor: m.total,
  }));
  const notas: PontoGrafico[] = (dados?.distribuicao_notas ?? []).map((f) => ({
    id: String(f.faixa_inicio),
    rotulo: `${f.faixa_inicio}–${f.faixa_fim}`,
    valor: f.total,
  }));
  const totalNotas = notas.reduce((s, n) => s + n.valor, 0);

  const alunosPorTrilha = ordenarPorValor<ItemGrafico>(
    (dados?.alunos_por_trilha ?? []).map((t) => ({
      id: t.trilha_id,
      rotulo: t.trilha_nome,
      valor: t.alunos,
      textoValor: String(t.alunos),
    })),
  );
  const maxAlunos = Math.max(4, ...alunosPorTrilha.map((i) => i.valor));

  const aprovacao = ordenarPorValor<ItemGrafico & { concluidas: number; reprovadas: number }>(
    (dados?.desempenho_por_trilha ?? [])
      .filter((t) => t.taxa_aprovacao !== null)
      .map((t) => ({
        id: t.trilha_id,
        rotulo: t.trilha_nome,
        valor: t.taxa_aprovacao ?? 0,
        textoValor: formatarPercentual(t.taxa_aprovacao ?? 0),
        detalhes: [`${t.concluidas} concluídas, ${t.reprovadas} reprovadas`],
        concluidas: t.concluidas,
        reprovadas: t.reprovadas,
      })),
  );
  const evasao = ordenarPorValor<ItemGrafico & { canceladas: number; reprovadas: number }>(
    (dados?.desempenho_por_trilha ?? [])
      .filter((t) => t.taxa_evasao !== null)
      .map((t) => ({
        id: t.trilha_id,
        rotulo: t.trilha_nome,
        valor: t.taxa_evasao ?? 0,
        textoValor: formatarPercentual(t.taxa_evasao ?? 0),
        detalhes: [`${t.canceladas} canceladas, ${t.reprovadas} reprovadas`],
        canceladas: t.canceladas,
        reprovadas: t.reprovadas,
      })),
  );
  const semBase = (dados?.desempenho_por_trilha.length ?? 0) - aprovacao.length;

  const frequencias = (dados?.frequencia_por_turma ?? []).slice(0, MAX_TURMAS).map<ItemGrafico & { trilha: string }>((t) => ({
    id: t.turma_id,
    rotulo: t.turma_codigo,
    valor: t.frequencia,
    textoValor: formatarPercentual(t.frequencia),
    detalhes: [t.trilha_nome],
    meta: FREQUENCIA_MINIMA,
    alerta: t.frequencia < FREQUENCIA_MINIMA ? `Abaixo de ${FREQUENCIA_MINIMA}%` : undefined,
    trilha: t.trilha_nome,
  }));
  const turmasOcultas = (dados?.frequencia_por_turma.length ?? 0) - frequencias.length;

  const carregando = consulta.isPending;

  return (
    <PaginaAutenticada
      titulo="Indicadores"
      acoes={
        <LinkBotao to={noExports} variant="secondary" className="max-md:hidden">
          <Download className="h-4 w-4" aria-hidden />
          Exportar dados
        </LinkBotao>
      }
    >
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-label font-medium text-text-secondary">Período</span>
          <select
            value={filtro.periodo ?? "livre"}
            onChange={(e) =>
              aplicar({
                ...lerFiltroRelatorio(new URLSearchParams({ periodo: e.target.value }), PADRAO),
                trilhaId: filtro.trilhaId,
              })
            }
            className={classeSelect}
          >
            {PERIODOS.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.rotulo}
              </option>
            ))}
            {filtro.periodo === null && <option value="livre">{rotuloPeriodo}</option>}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-label font-medium text-text-secondary">Trilha</span>
          <select
            value={filtro.trilhaId ?? ""}
            onChange={(e) => aplicar({ ...filtro, trilhaId: e.target.value || undefined })}
            className={`${classeSelect} max-w-full`}
          >
            <option value="">Todas</option>
            {(trilhas.data ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
        </label>
        <p className="pb-2 text-label text-text-muted" aria-live="polite">
          {rotuloPeriodo}
          {filtro.trilhaId && trilhaNome(filtro.trilhaId) ? ` · ${trilhaNome(filtro.trilhaId)}` : ""}
        </p>
      </div>

      {consulta.isError && !dados && (
        <ErroConsulta
          erro={consulta.error}
          padrao="Não foi possível carregar os indicadores."
          tentarDeNovo={() => void consulta.refetch()}
        />
      )}
      {consulta.isError && dados && (
        <Aviso variant="danger" className="mb-4">
          Não foi possível atualizar os indicadores. Os números abaixo podem estar desatualizados.
        </Aviso>
      )}

      {!(consulta.isError && !dados) && (
        <>
          <section aria-label="Indicadores principais" className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
            {KPIS.map((def) => {
              const atual = dados?.kpis[def.chave] ?? null;
              // Sem período anterior a consulta fica desligada, mas a chave igual à atual devolveria os mesmos números.
              const antes = anterior ? consultaAnterior.data?.kpis[def.chave] : undefined;
              return (
                <KpiCartao
                  key={def.chave}
                  rotulo={def.rotulo}
                  apoio={def.apoio}
                  valor={atual === null ? "—" : def.formatar(atual)}
                  variacao={variacaoDo(def, atual, antes)}
                  carregando={carregando}
                />
              );
            })}
          </section>
          {anterior && (
            <p className="-mt-3 mb-6 text-label text-text-muted">
              Variação contra {formatarData(anterior.inicio)} a {formatarData(anterior.fim)}; pontos percentuais (p.p.)
              nos percentuais.
            </p>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <GraficoLinha
              titulo="Matrículas por mês"
              descricao="Inscrições registradas em cada mês, pela data da inscrição."
              unidade="matrículas"
              pontos={matriculasPorMes}
              vazio="Nenhuma matrícula neste período."
              colunasTabela={[
                { titulo: "Mês", valor: (p) => p.rotulo },
                { titulo: "Matrículas", valor: (p) => p.valor },
              ]}
              nomeCsv={["indicadores", "matriculas-por-mes"]}
              carregando={carregando}
            />
            <GraficoColunas
              titulo="Certificados por mês"
              descricao="Certificados emitidos em cada mês."
              unidade="certificados"
              pontos={certificadosPorMes}
              vazio="Nenhum certificado emitido neste período."
              colunasTabela={[
                { titulo: "Mês", valor: (p) => p.rotulo },
                { titulo: "Certificados", valor: (p) => p.valor },
              ]}
              nomeCsv={["indicadores", "certificados-por-mes"]}
              carregando={carregando}
            />
            <GraficoBarras
              titulo="Alunos por trilha"
              descricao="Alunos distintos com matrícula ativa em cada trilha."
              itens={alunosPorTrilha}
              max={maxAlunos}
              sufixoEixo=""
              vazio="Nenhum aluno ativo neste período."
              colunasTabela={[
                { titulo: "Trilha", valor: (i) => i.rotulo },
                { titulo: "Alunos", valor: (i) => i.valor },
              ]}
              nomeCsv={["indicadores", "alunos-por-trilha"]}
              carregando={carregando}
            />
            <GraficoColunas
              titulo="Distribuição de notas"
              descricao={`Notas finais por faixa, de 0 a 10${totalNotas > 0 ? ` (${totalNotas} no total)` : ""}.`}
              unidade="notas"
              pontos={totalNotas > 0 ? notas : []}
              histograma
              vazio="Nenhuma nota lançada neste período."
              colunasTabela={[
                { titulo: "Faixa", valor: (p) => p.rotulo },
                { titulo: "Notas", valor: (p) => p.valor },
              ]}
              nomeCsv={["indicadores", "distribuicao-de-notas"]}
              carregando={carregando}
            />
            <GraficoBarras
              titulo="Aprovação por trilha"
              descricao="Concluídas sobre concluídas e reprovadas, por trilha."
              itens={aprovacao}
              nota={semBase > 0 ? `${semBase} trilha(s) sem matrícula encerrada ficam de fora.` : undefined}
              vazio="Nenhuma matrícula encerrada neste período."
              colunasTabela={[
                { titulo: "Trilha", valor: (i) => i.rotulo },
                { titulo: "Aprovação (%)", valor: (i) => Math.round(i.valor * 10) / 10 },
                { titulo: "Concluídas", valor: (i) => i.concluidas },
                { titulo: "Reprovadas", valor: (i) => i.reprovadas },
              ]}
              nomeCsv={["indicadores", "aprovacao-por-trilha"]}
              carregando={carregando}
            />
            <GraficoBarras
              titulo="Evasão por trilha"
              descricao="Canceladas ou reprovadas sobre as matrículas encerradas, por trilha."
              itens={evasao}
              vazio="Nenhuma matrícula encerrada neste período."
              colunasTabela={[
                { titulo: "Trilha", valor: (i) => i.rotulo },
                { titulo: "Evasão (%)", valor: (i) => Math.round(i.valor * 10) / 10 },
                { titulo: "Canceladas", valor: (i) => i.canceladas },
                { titulo: "Reprovadas", valor: (i) => i.reprovadas },
              ]}
              nomeCsv={["indicadores", "evasao-por-trilha"]}
              carregando={carregando}
            />
            <div className="min-w-0 lg:col-span-2">
              <GraficoBarras
                titulo="Frequência por turma"
                descricao="Frequência média de cada turma, das piores para as melhores."
                itens={frequencias}
                legendaMeta={`Mínimo de ${FREQUENCIA_MINIMA}%`}
                nota={turmasOcultas > 0 ? `Mostrando as ${MAX_TURMAS} piores; mais ${turmasOcultas} turma(s) acima.` : undefined}
                vazio="Nenhuma turma com frequência registrada neste período."
                colunasTabela={[
                  { titulo: "Turma", valor: (i) => i.rotulo },
                  { titulo: "Trilha", valor: (i) => i.trilha },
                  { titulo: "Frequência (%)", valor: (i) => Math.round(i.valor * 10) / 10 },
                ]}
                nomeCsv={["indicadores", "frequencia-por-turma"]}
                carregando={carregando}
              />
            </div>
          </div>
        </>
      )}
    </PaginaAutenticada>
  );
}
