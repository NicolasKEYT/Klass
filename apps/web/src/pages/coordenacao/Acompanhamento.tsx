import { useSearchParams } from "react-router-dom";
import { Download } from "lucide-react";
import { ErroConsulta } from "@/components/ErroConsulta";
import { GraficoBarras, type ItemGrafico } from "@/components/graficos/GraficoBarras";
import { LinkBotao } from "@/components/LinkBotao";
import { PaginaAutenticada } from "@/components/PaginaAutenticada";
import { useFrequenciasCoordenacao, useLinhasDasViews } from "@/lib/consultas/painelCoordenacao";
import { useTurmasDaCoordenacao } from "@/lib/consultas/selecao";
import { lerFiltroRelatorio, paramsDoFiltro } from "@/lib/filtroRelatorio";
import { formatarPercentual } from "@/lib/formato";
import { montarTurmasEmAndamento, semestreAtual } from "@/lib/painelCoordenacao";
import { plural } from "@/lib/plural";
import { PADRAO_RELATORIO, RelatorioDoPeriodo } from "./RelatorioDoPeriodo";

// Acompanhamento da coordenação: os quatro gráficos de D11, numa tela
// própria e não no Início. O Início é para o relance do dia ("Precisa de
// você", três indicadores, "Esta semana"); quatro gráficos com uma linha
// por trilha/turma o transformariam num relatório comprido. A barra
// lateral já tem os 5 itens que D3 permite, então a entrada é o botão
// "Ver gráficos de acompanhamento" no Início.
//
// É a tela única de gráficos da coordenação. Duas seções: o panorama (D11,
// sem filtro, estado de hoje) e o relatório do período (filtros na URL, os
// mesmos do Exports). Só entram no relatório gráficos que o panorama não tem.
//
// Dados: as duas views do artigo (vw_desempenho_por_trilha,
// vw_taxa_evasao) linha a linha; frequência por turma e lista de turmas
// são as mesmas entradas de cache do Início.

interface ItemTrilha extends ItemGrafico {
  aprovados: number;
  encerrados: number;
  taxa: number;
}
interface ItemSemestre extends ItemGrafico {
  evadidos: number;
  encerrados: number;
  taxa: number;
}
interface ItemTurma extends ItemGrafico {
  modulo: string;
  frequencia: number;
  minima: number;
}
interface ItemOcupacao extends ItemGrafico {
  modulo: string;
  matriculados: number;
  vagas: number;
  ocupacao: number;
}

// Maior primeiro; empate, por nome — a ordem não muda entre recargas.
function ordenar<T extends ItemGrafico>(itens: T[]): T[] {
  return [...itens].sort((a, b) => b.valor - a.valor || a.rotulo.localeCompare(b.rotulo, "pt-BR"));
}

// Uma casa decimal na tabela/CSV (a view já arredonda assim).
const umaCasa = (v: number) => Math.round(v * 10) / 10;

export function Acompanhamento() {
  const [params] = useSearchParams();
  const noExports = `/coordenacao/exports?${paramsDoFiltro(lerFiltroRelatorio(params, PADRAO_RELATORIO)).toString()}`;
  const consultaViews = useLinhasDasViews();
  const consultaFrequencias = useFrequenciasCoordenacao();
  const consultaTurmas = useTurmasDaCoordenacao();
  const consultas = [consultaViews, consultaFrequencias, consultaTurmas];
  const erro = consultas.find((c) => c.isError)?.error ?? null;

  const desempenho = consultaViews.data?.desempenho ?? [];
  const trilhasComEncerrados = desempenho.filter((d) => d.taxaAprovacao !== null && d.totalEncerrados > 0);
  const trilhasSemEncerrados = desempenho.length - trilhasComEncerrados.length;
  const itensAprovacao: ItemTrilha[] = ordenar(
    trilhasComEncerrados.map((d) => ({
      id: d.trilhaId,
      rotulo: d.trilhaNome,
      valor: d.taxaAprovacao!,
      textoValor: formatarPercentual(d.taxaAprovacao!),
      detalhes: [`${d.totalAprovados} de ${plural(d.totalEncerrados, "matrícula encerrada", "matrículas encerradas")}`],
      aprovados: d.totalAprovados,
      encerrados: d.totalEncerrados,
      taxa: d.taxaAprovacao!,
    })),
  );

  // Semestres em ordem cronológica, não por valor: a pergunta é "a evasão
  // está subindo ou caindo?", e o tempo é a ordem natural dessa leitura.
  const itensEvasao: ItemSemestre[] = (consultaViews.data?.evasao ?? [])
    .filter((e) => e.taxaEvasao !== null)
    .sort((a, b) => a.periodo.localeCompare(b.periodo))
    .map((e) => ({
      id: e.periodo,
      rotulo: e.periodo,
      valor: e.taxaEvasao!,
      textoValor: formatarPercentual(e.taxaEvasao!),
      detalhes: [`${e.totalEvadidos} de ${plural(e.totalEncerrados, "matrícula encerrada", "matrículas encerradas")} sem concluir`],
      evadidos: e.totalEvadidos,
      encerrados: e.totalEncerrados,
      taxa: e.taxaEvasao!,
    }));

  const turmas =
    consultaTurmas.data && consultaFrequencias.data
      ? montarTurmasEmAndamento(consultaTurmas.data, consultaFrequencias.data.porTurma)
      : null;
  const turmasComFrequencia = (turmas ?? []).filter((t) => t.frequenciaMedia !== null);
  const itensFrequencia: ItemTurma[] = ordenar(
    turmasComFrequencia.map((t) => {
      const freq = t.frequenciaMedia!;
      return {
        id: t.id,
        rotulo: t.codigo,
        valor: freq,
        textoValor: formatarPercentual(freq),
        meta: t.frequenciaMinimaPercentual,
        alerta:
          freq < t.frequenciaMinimaPercentual
            ? `Abaixo da mínima de ${formatarPercentual(t.frequenciaMinimaPercentual)}`
            : undefined,
        detalhes: [t.moduloNome, `Mínima da turma: ${formatarPercentual(t.frequenciaMinimaPercentual)}`],
        modulo: t.moduloNome,
        frequencia: freq,
        minima: t.frequenciaMinimaPercentual,
      };
    }),
  );
  const turmasSemChamada = (turmas?.length ?? 0) - turmasComFrequencia.length;

  const itensOcupacao: ItemOcupacao[] = ordenar(
    (turmas ?? []).map((t) => {
      const ocupacao = t.vagasTotal > 0 ? (t.matriculados / t.vagasTotal) * 100 : 0;
      return {
        id: t.id,
        rotulo: t.codigo,
        valor: ocupacao,
        textoValor: `${t.matriculados}/${t.vagasTotal}`,
        detalhes: [t.moduloNome, `${formatarPercentual(ocupacao)} das vagas ocupadas`],
        modulo: t.moduloNome,
        matriculados: t.matriculados,
        vagas: t.vagasTotal,
        ocupacao,
      };
    }),
  );

  const carregandoViews = consultaViews.isPending;
  const carregandoTurmas = !turmas && !erro;

  return (
    <PaginaAutenticada
      sobrelinha={`Semestre ${semestreAtual()}`}
      titulo="Acompanhamento"
      voltar={{ seSemHistorico: "/", rotulo: "Início" }}
      acoes={
        <LinkBotao to={noExports} variant="secondary" className="max-md:hidden">
          <Download className="h-4 w-4" aria-hidden />
          Exportar dados
        </LinkBotao>
      }
    >
      {erro && (
        <ErroConsulta
          className="mb-4"
          erro={erro}
          padrao="Não foi possível carregar os gráficos."
          tentarDeNovo={() => consultas.forEach((c) => c.isError && void c.refetch())}
        />
      )}

      <h2 className="text-klass-xl text-text-primary">Panorama da instituição</h2>
      <p className="mb-4 text-body-sm text-text-secondary">
        Todas as trilhas e turmas, como estão hoje. Não muda com os filtros do relatório abaixo.
      </p>
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
        <GraficoBarras
          titulo="Aprovação por trilha"
          descricao="Aprovados sobre matrículas encerradas (aprovadas ou reprovadas) em cada trilha."
          itens={itensAprovacao}
          carregando={carregandoViews}
          vazio="Nenhuma trilha tem matrícula encerrada ainda."
          nota={
            trilhasSemEncerrados > 0
              ? `${plural(trilhasSemEncerrados, "trilha sem matrícula encerrada fica", "trilhas sem matrícula encerrada ficam")} de fora.`
              : undefined
          }
          nomeCsv={["aprovacao-por-trilha"]}
          colunasTabela={[
            { titulo: "Trilha", valor: (i) => i.rotulo },
            { titulo: "Aprovados", valor: (i) => i.aprovados },
            { titulo: "Encerradas", valor: (i) => i.encerrados },
            { titulo: "Aprovação (%)", valor: (i) => umaCasa(i.taxa) },
          ]}
        />

        <GraficoBarras
          titulo="Evasão por semestre"
          descricao="Matrículas canceladas ou reprovadas sobre as encerradas, pelo semestre de início da turma."
          itens={itensEvasao}
          carregando={carregandoViews}
          vazio="Nenhuma matrícula encerrada ainda."
          nomeCsv={["evasao-por-semestre"]}
          colunasTabela={[
            { titulo: "Semestre", valor: (i) => i.rotulo },
            { titulo: "Evadidos", valor: (i) => i.evadidos },
            { titulo: "Encerradas", valor: (i) => i.encerrados },
            { titulo: "Evasão (%)", valor: (i) => umaCasa(i.taxa) },
          ]}
        />

        <GraficoBarras
          titulo="Frequência média por turma"
          descricao="Média da frequência dos alunos cursando, nas aulas com chamada feita."
          legendaMeta="Traço: frequência mínima da turma"
          itens={itensFrequencia}
          carregando={carregandoTurmas}
          vazio="Nenhuma turma em andamento tem chamada registrada."
          nota={
            turmasSemChamada > 0
              ? `${plural(turmasSemChamada, "turma sem chamada registrada fica", "turmas sem chamada registrada ficam")} de fora.`
              : undefined
          }
          nomeCsv={["frequencia-por-turma"]}
          colunasTabela={[
            { titulo: "Turma", valor: (i) => i.rotulo },
            { titulo: "Módulo", valor: (i) => i.modulo },
            { titulo: "Frequência média (%)", valor: (i) => umaCasa(i.frequencia) },
            { titulo: "Mínima (%)", valor: (i) => i.minima },
            { titulo: "Situação", valor: (i) => (i.frequencia < i.minima ? "Abaixo da mínima" : "Na mínima ou acima") },
          ]}
        />

        <GraficoBarras
          titulo="Ocupação por turma"
          descricao="Alunos cursando sobre o total de vagas, nas turmas que ainda não foram encerradas."
          itens={itensOcupacao}
          carregando={carregandoTurmas}
          vazio="Nenhuma turma em andamento."
          nomeCsv={["ocupacao-por-turma"]}
          colunasTabela={[
            { titulo: "Turma", valor: (i) => i.rotulo },
            { titulo: "Módulo", valor: (i) => i.modulo },
            { titulo: "Matriculados", valor: (i) => i.matriculados },
            { titulo: "Vagas", valor: (i) => i.vagas },
            { titulo: "Ocupação (%)", valor: (i) => umaCasa(i.ocupacao) },
          ]}
        />
      </div>

      <RelatorioDoPeriodo />
    </PaginaAutenticada>
  );
}
