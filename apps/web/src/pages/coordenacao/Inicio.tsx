import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Badge } from "@/components/Badge";
import { BarraDeMeta } from "@/components/BarraDeMeta";
import { Card } from "@/components/Card";
import { Esqueleto, RegiaoCarregando } from "@/components/Esqueleto";
import { ErroConsulta } from "@/components/ErroConsulta";
import { Input } from "@/components/Input";
import { LinkBotao } from "@/components/LinkBotao";
import { LinkComPrefetch } from "@/components/LinkComPrefetch";
import { Titulo } from "@/components/Titulo";
import { useTrilhas } from "@/lib/consultas/catalogo";
import { useBuscaDeAlunos } from "@/lib/consultas/identidade";
import {
  useFrequenciasCoordenacao,
  useIndicadoresDasViews,
  usePendenciasCoordenacao,
} from "@/lib/consultas/painelCoordenacao";
import { useTurmasDaCoordenacao } from "@/lib/consultas/selecao";
import {
  montarIndicadores,
  montarTurmasEmAndamento,
  type PendenciaCoordenacao,
} from "@/lib/painelCoordenacao";
import { flexionar, plural } from "@/lib/plural";

// Sem o número: ele já aparece em destaque logo acima no cartão.
const TEXTO_PENDENCIA: Record<PendenciaCoordenacao["tipo"], (q: number) => string> = {
  inscricoes: (q) => flexionar(q, "inscrição para aprovar", "inscrições para aprovar"),
  chamadas_atrasadas: (q) => flexionar(q, "chamada atrasada", "chamadas atrasadas"),
  turmas_terminando: (q) => flexionar(q, "turma terminando", "turmas terminando"),
};

// Com uma turma só envolvida, vai direto ao detalhe dela.
function linkDaPendencia(p: PendenciaCoordenacao): string {
  return p.turmaIds.length === 1 ? `/coordenacao/turmas/${p.turmaIds[0]}` : "/coordenacao/turmas";
}

// D7 (klass-uikit.pdf) — painel "Início" da coordenação: busca global,
// "Precisa de você" (pendências acionáveis), três indicadores em barra
// contra meta, e a tabela de turmas em andamento.
//
// Decisão própria: o wireframe original mostra 4 cards em "Precisa de
// você", incluindo "turma sem professor" e "certificados prontos para
// emitir". Nenhum dos dois corresponde a um estado real do sistema —
// selecao.turmas.professor_id é NOT NULL (toda turma já nasce com
// professor), e certificacao.certificados é emitido automaticamente por
// trigger, sem etapa manual de "emitir". Em vez de fingir uma ação que
// não existe, o painel mostra só os 3 cards com dado e ação reais.
export function Inicio() {
  // Frequências calculadas uma vez só e usadas nos indicadores e na tabela;
  // a lista de turmas é a mesma da tela "Turmas" (cache compartilhado).
  const consultaFrequencias = useFrequenciasCoordenacao();
  const consultaViews = useIndicadoresDasViews();
  const consultaPendencias = usePendenciasCoordenacao();
  const consultaTurmas = useTurmasDaCoordenacao();
  const consultaTrilhas = useTrilhas();
  const pendencias = consultaPendencias.data;
  const indicadores =
    consultaFrequencias.data && consultaViews.data
      ? montarIndicadores(consultaFrequencias.data, consultaViews.data)
      : null;
  const turmas =
    consultaTurmas.data && consultaFrequencias.data
      ? montarTurmasEmAndamento(consultaTurmas.data, consultaFrequencias.data.porTurma)
      : null;
  const trilhas = consultaTrilhas.data ?? [];
  const consultas = [consultaFrequencias, consultaViews, consultaPendencias, consultaTurmas, consultaTrilhas];
  const erro = consultas.find((c) => c.isError)?.error ?? null;

  const [termoBusca, setTermoBusca] = useState("");
  // Espera o usuário parar de digitar (300 ms) antes de consultar.
  const [termoConsultado, setTermoConsultado] = useState("");
  useEffect(() => {
    const debounce = setTimeout(() => setTermoConsultado(termoBusca), 300);
    return () => clearTimeout(debounce);
  }, [termoBusca]);
  const consultaAlunos = useBuscaDeAlunos(termoConsultado);
  const alunosEncontrados = termoBusca.trim().length >= 2 ? (consultaAlunos.data ?? []) : [];

  const turmasFiltradas = (turmas ?? []).filter(
    (t) =>
      termoBusca.trim().length < 2 ||
      t.codigo.toLowerCase().includes(termoBusca.toLowerCase()) ||
      t.moduloNome.toLowerCase().includes(termoBusca.toLowerCase()) ||
      t.trilhaNome.toLowerCase().includes(termoBusca.toLowerCase()),
  );
  const trilhasFiltradas = trilhas.filter((t) =>
    termoBusca.trim().length >= 2 ? t.nome.toLowerCase().includes(termoBusca.toLowerCase()) : false,
  );
  const mostrandoBusca = termoBusca.trim().length >= 2;

  return (
    <>
      <div className="mb-6 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <Titulo>Início</Titulo>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <Input
            className="pl-9"
            type="search"
            placeholder="Buscar aluno, turma ou trilha"
            value={termoBusca}
            onChange={(e) => setTermoBusca(e.target.value)}
          />
        </div>
      </div>

      {erro && (
        <ErroConsulta
          className="mb-4"
          erro={erro}
          padrao="Não foi possível carregar o painel."
          tentarDeNovo={() => consultas.forEach((c) => c.isError && void c.refetch())}
        />
      )}

      {mostrandoBusca ? (
        <div className="flex flex-col gap-6">
          <div>
            <p className="mb-2 text-label font-medium text-text-muted">Alunos</p>
            {alunosEncontrados.length === 0 && (
              <p className="text-body-sm text-text-secondary">Nenhum aluno encontrado.</p>
            )}
            <div className="flex flex-col gap-2">
              {alunosEncontrados.map((a) => (
                <Card key={a.id} className="text-body-sm text-text-primary">
                  {a.nomeCompleto}
                </Card>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-label font-medium text-text-muted">Turmas</p>
            {turmasFiltradas.length === 0 && (
              <p className="text-body-sm text-text-secondary">Nenhuma turma encontrada.</p>
            )}
            <div className="flex flex-col gap-2">
              {turmasFiltradas.map((t) => (
                <LinkComPrefetch key={t.id} to={`/coordenacao/turmas/${t.id}`}>
                  <Card className="text-body-sm text-text-primary transition hover:border-text-primary/40">
                    {t.codigo} · {t.moduloNome} · {t.trilhaNome}
                  </Card>
                </LinkComPrefetch>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-label font-medium text-text-muted">Trilhas</p>
            {trilhasFiltradas.length === 0 && (
              <p className="text-body-sm text-text-secondary">Nenhuma trilha encontrada.</p>
            )}
            <div className="flex flex-col gap-2">
              {trilhasFiltradas.map((t) => (
                <LinkComPrefetch key={t.id} to={`/coordenacao/trilhas/${t.slug}/editar`}>
                  <Card className="text-body-sm text-text-primary transition hover:border-text-primary/40">{t.nome}</Card>
                </LinkComPrefetch>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          <Titulo nivel="secao" className="mb-3">
            Precisa de você
          </Titulo>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            {consultaPendencias.isPending &&
              [0, 1, 2].map((i) => (
                <RegiaoCarregando key={i} className="flex flex-col gap-2 rounded-klass-card border border-border bg-surface px-klass-card-x py-6">
                  <Esqueleto className="h-9 w-12" />
                  <Esqueleto className="h-4 w-40" />
                  <Esqueleto className="h-3 w-32" />
                  <Esqueleto className="mt-1 h-10 w-full" />
                </RegiaoCarregando>
              ))}
            {pendencias?.length === 0 && (
              <p className="text-body-sm text-text-secondary sm:col-span-3">
                Nenhuma pendência no momento.
              </p>
            )}
            {pendencias?.map((p) => (
              <Card key={p.tipo} className="flex flex-col gap-2">
                <span className="font-mono text-klass-stat font-semibold tabular-nums text-text-primary">
                  {p.quantidade}
                </span>
                <p className="text-body-sm text-text-secondary">{TEXTO_PENDENCIA[p.tipo](p.quantidade)}</p>
                <p className="text-label text-text-muted">{p.detalhe}</p>
                <LinkBotao to={linkDaPendencia(p)} variant="secondary" className="mt-1 w-full">
                  Revisar
                </LinkBotao>
              </Card>
            ))}
          </div>

          {!indicadores && !erro ? (
            <div className="mb-6 grid gap-4 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <RegiaoCarregando key={i} className="flex flex-col gap-2 rounded-klass-card border border-border bg-surface px-klass-card-x py-6">
                  <Esqueleto className="h-3 w-32" />
                  <Esqueleto className="h-9 w-16" />
                  <Esqueleto className="h-3 w-20" />
                  <Esqueleto className="h-2 w-full" />
                </RegiaoCarregando>
              ))}
            </div>
          ) : (
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <Card>
              <p className="text-label font-medium text-text-muted">Frequência média</p>
              <p className="mt-1 font-mono text-klass-stat font-semibold tabular-nums text-text-primary">
                {indicadores?.frequenciaMedia !== null && indicadores?.frequenciaMedia !== undefined
                  ? `${indicadores.frequenciaMedia.toFixed(0)}%`
                  : "—"}
              </p>
              <p className="mb-2 text-label text-text-muted">mínimo 75%</p>
              <BarraDeMeta
                valor={indicadores?.frequenciaMedia ?? 0}
                meta={75}
                rotulo="Frequência média da instituição"
              />
              {indicadores && indicadores.alunosAbaixoDoMinimo > 0 && (
                <p className="mt-2 text-label text-text-muted">
                  {plural(indicadores.alunosAbaixoDoMinimo, "aluno abaixo do mínimo", "alunos abaixo do mínimo")}
                </p>
              )}
            </Card>
            <Card>
              <p className="text-label font-medium text-text-muted">Aprovação nos módulos encerrados</p>
              <p className="mt-1 font-mono text-klass-stat font-semibold tabular-nums text-text-primary">
                {indicadores?.aprovacaoModulosEncerrados !== null &&
                indicadores?.aprovacaoModulosEncerrados !== undefined
                  ? `${indicadores.aprovacaoModulosEncerrados.toFixed(0)}%`
                  : "—"}
              </p>
              <p className="mb-2 text-label text-text-muted">
                {indicadores && indicadores.totalEncerrados > 0
                  ? `${indicadores.totalAprovados} de ${plural(indicadores.totalEncerrados, "matrícula encerrada", "matrículas encerradas")} · meta 80%`
                  : "Nenhuma matrícula encerrada ainda"}
              </p>
              <BarraDeMeta
                valor={indicadores?.aprovacaoModulosEncerrados ?? 0}
                meta={80}
                rotulo="Aprovação nos módulos encerrados"
              />
            </Card>
            <Card>
              <p className="text-label font-medium text-text-muted">
                Evasão {indicadores?.periodoEvasao ? `(${indicadores.periodoEvasao})` : "no semestre"}
              </p>
              <p className="mt-1 font-mono text-klass-stat font-semibold tabular-nums text-text-primary">
                {indicadores?.evasaoSemestreAtual !== null && indicadores?.evasaoSemestreAtual !== undefined
                  ? `${indicadores.evasaoSemestreAtual.toFixed(0)}%`
                  : "—"}
              </p>
              <p className="mb-2 text-label text-text-muted">meta: até 10%</p>
              <BarraDeMeta
                valor={indicadores?.evasaoSemestreAtual ?? 0}
                meta={10}
                rotulo="Evasão no semestre"
              />
            </Card>
          </div>
          )}

          <Titulo nivel="secao" className="mb-3">
            Turmas em andamento
          </Titulo>
          {/* No celular a tabela rola na horizontal dentro do cartão, em vez
              de espremer as colunas. */}
          <Card className="overflow-x-auto !px-0 !py-0">
            <table className="w-full min-w-max text-left">
              <thead>
                <tr className="border-b border-border text-label text-text-muted">
                  <th className="px-4 py-3 font-medium">Turma</th>
                  <th className="px-4 py-3 font-medium">Módulo</th>
                  <th className="px-4 py-3 font-medium">Professor</th>
                  <th className="px-4 py-3 font-medium">Ocupação</th>
                  <th className="px-4 py-3 font-medium">Freq. média</th>
                  <th className="px-4 py-3 font-medium">Situação</th>
                </tr>
              </thead>
              <tbody>
                {turmas === null &&
                  !erro &&
                  [0, 1, 2, 3].map((i) => (
                    <tr key={i} className="h-[52px] border-b border-border last:border-b-0" aria-busy="true">
                      {[0, 1, 2, 3, 4, 5].map((j) => (
                        <td key={j} className="px-4 py-3">
                          <Esqueleto className="h-4 w-20" />
                        </td>
                      ))}
                    </tr>
                  ))}
                {turmas?.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-3 text-body-sm text-text-secondary">
                      Nenhuma turma em andamento.
                    </td>
                  </tr>
                )}
                {turmas?.map((t) => (
                  <tr key={t.id} className="h-[52px] border-b border-border last:border-b-0">
                    <td className="px-4 py-3">
                      <LinkComPrefetch
                        to={`/coordenacao/turmas/${t.id}`}
                        className="text-body-sm font-medium text-primary hover:underline"
                      >
                        {t.codigo}
                      </LinkComPrefetch>
                    </td>
                    <td className="px-4 py-3 text-body-sm text-text-secondary">{t.moduloNome}</td>
                    <td className="px-4 py-3 text-body-sm text-text-secondary">{t.professorNome}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2 w-24 rounded-full bg-neutral-subtle"
                          role="img"
                          aria-label={`Ocupação: ${t.matriculados} de ${t.vagasTotal} vagas`}
                        >
                          <div
                            className="h-2 rounded-full bg-text-primary"
                            style={{
                              width: `${t.vagasTotal > 0 ? Math.min(100, (t.matriculados / t.vagasTotal) * 100) : 0}%`,
                            }}
                          />
                        </div>
                        <span className="font-mono text-body-sm tabular-nums text-text-secondary">
                          {t.matriculados}/{t.vagasTotal}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-body-sm tabular-nums text-text-secondary">
                        {t.frequenciaMedia !== null ? `${t.frequenciaMedia.toFixed(0)}%` : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="neutral">{t.situacao}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </>
  );
}
