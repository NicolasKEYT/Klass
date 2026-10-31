import { useSearchParams } from "react-router-dom";
import { Aviso } from "@/components/Aviso";
import { ErroConsulta } from "@/components/ErroConsulta";
import { GraficoBarras, type ItemGrafico } from "@/components/graficos/GraficoBarras";
import { GraficoColunas } from "@/components/graficos/GraficoColunas";
import { GraficoLinha, type PontoGrafico } from "@/components/graficos/GraficoLinha";
import { completarMeses, rotuloDoMes } from "@/components/graficos/escalaGrafico";
import { KpiCartao, type VariacaoKpi } from "@/components/graficos/KpiCartao";
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

/** Abertura sem parâmetros: o ano corrente. */
export const PADRAO_RELATORIO: PeriodoPredefinido = "ano";
const FREQUENCIA_MINIMA = 75;

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
  { chave: "alunos_ativos", rotulo: "Alunos com matrícula ativa", formatar: String, unidade: "" },
  { chave: "matriculas_ativas", rotulo: "Matrículas ativas", formatar: String, unidade: "" },
  { chave: "inscricoes_pendentes", rotulo: "Inscrições pendentes", apoio: "aguardando deferimento", formatar: String, unidade: "" },
  { chave: "taxa_conclusao", rotulo: "Conclusão das encerradas", apoio: "matrículas concluídas ou reprovadas", formatar: formatarPercentual, unidade: " p.p." },
  { chave: "taxa_evasao", rotulo: "Evasão das encerradas", apoio: "canceladas ou reprovadas", formatar: formatarPercentual, unidade: " p.p." },
  { chave: "frequencia_media", rotulo: "Frequência de quem cursa", apoio: `mínimo ${FREQUENCIA_MINIMA}%`, formatar: formatarPercentual, unidade: " p.p." },
  { chave: "nota_media", rotulo: "Nota média das matrículas", apoio: "de 0 a 10", formatar: formatarMedia, unidade: "" },
  { chave: "certificados_periodo", rotulo: "Certificados emitidos", formatar: String, unidade: "" },
  { chave: "ocupacao_media", rotulo: "Ocupação das turmas abertas", apoio: "matriculadas sobre vagas", formatar: formatarPercentual, unidade: " p.p." },
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

export function RelatorioDoPeriodo() {
  const [params, setParams] = useSearchParams();
  const trilhas = useTrilhas();
  const filtro = lerFiltroRelatorio(params, PADRAO_RELATORIO);
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

  const carregando = consulta.isPending;

  return (
    <section aria-labelledby="titulo-relatorio" className="mt-10">
      <h2 id="titulo-relatorio" className="text-klass-xl text-text-primary">
        Relatório do período
      </h2>
      <p className="mb-4 text-body-sm text-text-secondary">
        Período e trilha valem só para esta seção; o panorama acima não muda com eles.
      </p>

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-label font-medium text-text-secondary">Período</span>
          <select
            value={filtro.periodo ?? "livre"}
            onChange={(e) =>
              aplicar({
                ...lerFiltroRelatorio(new URLSearchParams({ periodo: e.target.value }), PADRAO_RELATORIO),
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
          </div>
        </>
      )}
    </section>
  );
}
