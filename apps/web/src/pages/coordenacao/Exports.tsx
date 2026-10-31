import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { ChartLine, Download } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Button } from "@/components/Button";
import { CampoData } from "@/components/CampoData";
import { Card } from "@/components/Card";
import { ErroConsulta, mensagemDoErro } from "@/components/ErroConsulta";
import { EsqueletoTabela } from "@/components/Esqueleto";
import { LinkBotao } from "@/components/LinkBotao";
import { PaginaAutenticada } from "@/components/PaginaAutenticada";
import { useTrilhas } from "@/lib/consultas/catalogo";
import {
  opcoesRelatorios,
  useContagemRelatorio,
  usePaginaRelatorio,
} from "@/lib/consultas/relatorios";
import {
  baixarCsv,
  baixarXlsx,
  colunasParaCsv,
  nomeDoArquivo,
  type AbaXlsx,
  type ColunaTipada,
} from "@/lib/csv";
import { lerFiltroRelatorio, paramsDoFiltro, type FiltroRelatorio as FiltroUrl } from "@/lib/filtroRelatorio";
import { formatarData, formatarDecimal } from "@/lib/formato";
import {
  COLUNAS_RELATORIO,
  CONJUNTOS,
  INFO_CONJUNTO,
  type ConjuntoRelatorio,
  type FiltrosRelatorio,
} from "@/lib/relatorios";

const LINHAS_POR_PAGINA = 10;

const classeSelect =
  "h-12 sm:h-10 rounded-klass-control border border-controle bg-surface px-3 text-klass-md text-text-primary";

// As colunas e linhas de cada conjunto têm tipos próprios; a tela só as
// repassa uma à outra, então aqui elas trafegam sem o tipo da linha.
type Colunas = ColunaTipada<never>[];

function textoDaCelula(coluna: ColunaTipada<never>, linha: never): string {
  const v = coluna.valor(linha);
  if (v === null || v === "") return "—";
  if (coluna.tipo === "data") return formatarData(String(v));
  return typeof v === "number" ? formatarDecimal(v, 2) : v;
}

function CartaoConjunto({
  conjunto,
  filtros,
  selecionado,
  aoEscolher,
}: {
  conjunto: ConjuntoRelatorio;
  filtros: FiltrosRelatorio;
  selecionado: boolean;
  aoEscolher: () => void;
}) {
  const contagem = useContagemRelatorio(conjunto, filtros);
  const info = INFO_CONJUNTO[conjunto];
  return (
    <button
      type="button"
      onClick={aoEscolher}
      aria-pressed={selecionado}
      className={`flex flex-col items-start justify-start rounded-klass-card border p-4 text-left transition-colors ${
        selecionado ? "border-primary bg-neutral-subtle" : "border-border bg-surface hover:bg-neutral-subtle"
      }`}
    >
      <span className="block text-body-sm font-medium text-text-primary">{info.titulo}</span>
      <span className="mt-1 block text-heading text-text-primary">
        {contagem.isPending ? "…" : contagem.isError ? "—" : contagem.data}
      </span>
      <span className="mt-1 block text-label text-text-muted">
        {contagem.isError ? "Não foi possível contar." : info.descricao}
      </span>
    </button>
  );
}

export function Exports() {
  const queryClient = useQueryClient();
  const trilhas = useTrilhas();

  const [conjunto, setConjunto] = useState<ConjuntoRelatorio>("alunos");
  // Período e trilha moram na URL, no mesmo formato dos Indicadores. Sem
  // nada na URL, Exports mostra tudo (como antes de existir o link).
  const [params, setParams] = useSearchParams();
  const filtroUrl = lerFiltroRelatorio(params, "tudo");
  const inicio = filtroUrl.inicio ?? "";
  const fim = filtroUrl.fim ?? "";
  const trilhaId = filtroUrl.trilhaId ?? "";
  // Data digitada à mão vira intervalo livre (de/ate); sem datas, "tudo".
  function gravarFiltro(novo: { inicio: string; fim: string; trilhaId: string }) {
    const f: FiltroUrl = {
      periodo: novo.inicio || novo.fim ? null : "tudo",
      inicio: novo.inicio || undefined,
      fim: novo.fim || undefined,
      trilhaId: novo.trilhaId || undefined,
    };
    setParams(paramsDoFiltro(f), { replace: true });
  }
  const setInicio = (v: string) => gravarFiltro({ inicio: v, fim, trilhaId });
  const setFim = (v: string) => gravarFiltro({ inicio, fim: v, trilhaId });
  const setTrilhaId = (v: string) => gravarFiltro({ inicio, fim, trilhaId: v });
  const [status, setStatus] = useState("");
  const [pagina, setPagina] = useState(0);
  const [gerando, setGerando] = useState<"csv" | "xlsx" | "tudo" | null>(null);
  const [erroGeracao, setErroGeracao] = useState<string | null>(null);

  const info = INFO_CONJUNTO[conjunto];
  const periodoInvertido = Boolean(inicio && fim && inicio > fim);
  // Contagens e "Exportar tudo" ignoram o status: ele é próprio de cada conjunto.
  const filtrosBase: FiltrosRelatorio = {
    inicio: inicio || undefined,
    fim: fim || undefined,
    trilhaId: trilhaId || undefined,
  };
  const filtros: FiltrosRelatorio = { ...filtrosBase, status: status || undefined };

  const consulta = usePaginaRelatorio(conjunto, filtros, pagina, LINHAS_POR_PAGINA);
  const colunas = COLUNAS_RELATORIO[conjunto] as unknown as Colunas;
  const linhas = (consulta.data?.linhas ?? []) as unknown as never[];
  const total = consulta.data?.total ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / LINHAS_POR_PAGINA));

  function escolher(novo: ConjuntoRelatorio) {
    setConjunto(novo);
    setStatus("");
    setPagina(0);
  }

  function mudarFiltro(aplicar: () => void) {
    aplicar();
    setPagina(0);
  }

  async function gerar(tipo: "csv" | "xlsx" | "tudo") {
    setGerando(tipo);
    setErroGeracao(null);
    try {
      if (tipo === "tudo") {
        const abas: AbaXlsx<never>[] = [];
        for (const c of CONJUNTOS) {
          const completo = await queryClient.fetchQuery(opcoesRelatorios.completo(c, filtrosBase));
          abas.push({
            nome: INFO_CONJUNTO[c].titulo,
            colunas: COLUNAS_RELATORIO[c] as unknown as Colunas,
            linhas: completo as unknown as never[],
          });
        }
        await baixarXlsx(nomeDoArquivo(["klass", "tudo"], "xlsx"), abas);
      } else {
        const completo = (await queryClient.fetchQuery(
          opcoesRelatorios.completo(conjunto, filtros),
        )) as unknown as never[];
        const nome = ["klass", info.slug];
        if (tipo === "csv") {
          baixarCsv(nomeDoArquivo(nome, "csv"), colunasParaCsv(colunas), completo);
        } else {
          await baixarXlsx(nomeDoArquivo(nome, "xlsx"), [{ nome: info.titulo, colunas, linhas: completo }]);
        }
      }
    } catch (erro) {
      setErroGeracao(mensagemDoErro(erro, "Não foi possível gerar o arquivo."));
    } finally {
      setGerando(null);
    }
  }

  const ocupado = gerando !== null;

  return (
    <PaginaAutenticada
      titulo="Exports"
      acoes={
        <>
        <LinkBotao to={`/coordenacao/indicadores?${paramsDoFiltro(filtroUrl).toString()}`} variant="secondary">
          <ChartLine className="h-4 w-4" aria-hidden />
          Ver indicadores
        </LinkBotao>
        <Button
          type="button"
          disabled={ocupado || periodoInvertido}
          onClick={() => void gerar("tudo")}
        >
          <Download className="h-4 w-4" aria-hidden />
          {gerando === "tudo" ? "Gerando…" : "Exportar tudo (XLSX)"}
        </Button>
        </>
      }
    >
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {CONJUNTOS.map((c) => (
          <CartaoConjunto
            key={c}
            conjunto={c}
            filtros={filtrosBase}
            selecionado={c === conjunto}
            aoEscolher={() => escolher(c)}
          />
        ))}
      </div>

      <div className="mb-2 flex flex-wrap items-end gap-3">
        <CampoData rotulo="De" valor={inicio} aoMudar={(v) => mudarFiltro(() => setInicio(v))} />
        <CampoData rotulo="Até" valor={fim} aoMudar={(v) => mudarFiltro(() => setFim(v))} />
        <label className="flex flex-col gap-1.5">
          <span className="text-label font-medium text-text-secondary">Trilha</span>
          <select
            value={trilhaId}
            onChange={(e) => mudarFiltro(() => setTrilhaId(e.target.value))}
            className={classeSelect}
          >
            <option value="">Todas</option>
            {(trilhas.data ?? []).map((tr) => (
              <option key={tr.id} value={tr.id}>
                {tr.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-label font-medium text-text-secondary">Status ({info.titulo})</span>
          <select
            value={status}
            onChange={(e) => mudarFiltro(() => setStatus(e.target.value))}
            className={classeSelect}
          >
            <option value="">Todos</option>
            {info.status.map((s) => (
              <option key={s.valor} value={s.valor}>
                {s.rotulo}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="mb-4 text-label text-text-muted">
        {info.periodo} O período, a trilha e o status valem para a tabela e para o arquivo; o
        status não vale para o “Exportar tudo”.
      </p>

      {periodoInvertido && (
        <Aviso variant="danger" className="mb-4">
          A data inicial é depois da final.
        </Aviso>
      )}
      {erroGeracao && (
        <Aviso variant="danger" className="mb-4">
          {erroGeracao}
        </Aviso>
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-body font-medium text-text-primary">
          {info.titulo}
          {consulta.data && (
            <span className="ml-2 text-body-sm font-normal text-text-muted">
              {total} {total === 1 ? "linha" : "linhas"}
            </span>
          )}
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={ocupado || periodoInvertido || total === 0}
            onClick={() => void gerar("csv")}
          >
            <Download className="h-4 w-4" aria-hidden />
            {gerando === "csv" ? "Gerando…" : "Baixar CSV"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={ocupado || periodoInvertido || total === 0}
            onClick={() => void gerar("xlsx")}
          >
            <Download className="h-4 w-4" aria-hidden />
            {gerando === "xlsx" ? "Gerando…" : "Baixar XLSX"}
          </Button>
        </div>
      </div>

      {consulta.isError && !consulta.data && (
        <ErroConsulta
          erro={consulta.error}
          padrao="Não foi possível carregar a prévia."
          tentarDeNovo={() => void consulta.refetch()}
        />
      )}
      {consulta.isPending && <EsqueletoTabela linhas={4} colunas={Math.min(colunas.length, 6)} />}
      {consulta.data && total === 0 && (
        <p className="text-body-sm text-text-secondary">Nada encontrado com esses filtros.</p>
      )}

      {consulta.data && total > 0 && (
        <>
          <Card className="overflow-x-auto !px-0 !py-0">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border text-label text-text-muted">
                  {colunas.map((c) => (
                    <th key={c.titulo} className="whitespace-nowrap px-4 py-3 font-medium">
                      {c.titulo}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {linhas.map((linha, i) => (
                  <tr key={i} className="border-b border-border last:border-b-0">
                    {colunas.map((c) => (
                      <td key={c.titulo} className="whitespace-nowrap px-4 py-3 text-body-sm text-text-primary">
                        {textoDaCelula(c, linha)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <div className="mt-3 flex items-center justify-between text-body-sm text-text-secondary">
            <span>
              Página {pagina + 1} de {totalPaginas}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={pagina === 0}
                onClick={() => setPagina(pagina - 1)}
              >
                Anterior
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={pagina + 1 >= totalPaginas}
                onClick={() => setPagina(pagina + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        </>
      )}
    </PaginaAutenticada>
  );
}
