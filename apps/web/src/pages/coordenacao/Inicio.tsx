import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Badge } from "@/components/Badge";
import { BarraDeMeta } from "@/components/BarraDeMeta";
import { BotaoExportarCsv } from "@/components/BotaoExportarCsv";
import { Card } from "@/components/Card";
import { BlocoDaSemana, CartaoEstaSemana, VazioDaSemana } from "@/components/EstaSemana";
import { Esqueleto, RegiaoCarregando } from "@/components/Esqueleto";
import { ErroConsulta } from "@/components/ErroConsulta";
import { Input } from "@/components/Input";
import { LinkBotao } from "@/components/LinkBotao";
import { LinkComPrefetch } from "@/components/LinkComPrefetch";
import { Titulo } from "@/components/Titulo";
import { useTrilhas } from "@/lib/consultas/catalogo";
import { useBuscaDeAlunos } from "@/lib/consultas/identidade";
import {
  useChamadasAtrasadas,
  useFrequenciasCoordenacao,
  useIndicadoresDasViews,
  useInscricoesRecentes,
  usePendenciasCoordenacao,
} from "@/lib/consultas/painelCoordenacao";
import { useTurmasDaCoordenacao } from "@/lib/consultas/selecao";
import {
  montarIndicadores,
  montarSemanaCoordenacao,
  montarTurmasEmAndamento,
  semestreAtual,
  type PendenciaCoordenacao,
} from "@/lib/painelCoordenacao";
import { PaginaAutenticada } from "@/components/PaginaAutenticada";
import { flexionar, plural } from "@/lib/plural";
import { formatarData, formatarDiaSemanaData, formatarPercentual } from "@/lib/formato";

// Sem o número: ele já aparece em destaque logo acima no cartão.
const TEXTO_PENDENCIA: Record<PendenciaCoordenacao["tipo"], (q: number) => string> = {
  inscricoes: (q) => flexionar(q, "inscrição para aprovar", "inscrições para aprovar"),
  chamadas_atrasadas: (q) => flexionar(q, "chamada atrasada", "chamadas atrasadas"),
  turmas_aguardando_encerramento: (q) =>
    flexionar(q, "turma aguardando encerramento", "turmas aguardando encerramento"),
  turmas_sem_aulas: (q) => flexionar(q, "turma sem aulas cadastradas", "turmas sem aulas cadastradas"),
  turmas_terminando: (q) => flexionar(q, "turma terminando", "turmas terminando"),
};

const ACAO_PENDENCIA: Record<PendenciaCoordenacao["tipo"], string> = {
  inscricoes: "Revisar",
  chamadas_atrasadas: "Ver turmas",
  turmas_aguardando_encerramento: "Ver turmas",
  turmas_sem_aulas: "Ver turmas",
  turmas_terminando: "Ver turmas",
};

// Com uma turma só envolvida, vai direto ao detalhe dela: inscrições na
// aba de inscrições, chamadas atrasadas na de aulas (onde se libera a
// chamada); o resto no Resumo, que é a aba padrão.
function linkDaPendencia(p: PendenciaCoordenacao): string {
  if (p.turmaIds.length !== 1) return "/coordenacao/turmas";
  const base = `/coordenacao/turmas/${p.turmaIds[0]}`;
  if (p.tipo === "inscricoes") return `${base}?aba=inscricoes`;
  if (p.tipo === "chamadas_atrasadas") return `${base}?aba=aulas`;
  return base;
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
  const consultaAtrasadas = useChamadasAtrasadas();
  const consultaInscricoes = useInscricoesRecentes();
  const semana =
    consultaTurmas.data && consultaAtrasadas.data && consultaInscricoes.data
      ? montarSemanaCoordenacao(consultaTurmas.data, consultaAtrasadas.data, consultaInscricoes.data)
      : null;
  const consultas = [
    consultaFrequencias,
    consultaViews,
    consultaPendencias,
    consultaTurmas,
    consultaTrilhas,
    consultaAtrasadas,
    consultaInscricoes,
  ];
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
    <PaginaAutenticada
      sobrelinha={`Semestre ${semestreAtual()}`}
      titulo="Início"
      acoes={
        <div className="relative w-full md:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
          <Input
            className="w-full pl-9"
            type="search"
            aria-label="Buscar aluno, turma ou trilha"
            placeholder="Buscar aluno, turma ou trilha"
            value={termoBusca}
            onChange={(e) => setTermoBusca(e.target.value)}
          />
        </div>
      }
    >

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
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
              <p className="text-body-sm text-text-secondary sm:col-span-2 xl:col-span-4">
                Nenhuma pendência no momento.
              </p>
            )}
            {pendencias?.map((p) => (
              // pág. 10 — número grande e rótulo na mesma linha, detalhe e a ação.
              <Card key={p.tipo} className="flex flex-col gap-2">
                <p className="flex items-baseline gap-2">
                  <span className="font-mono text-klass-stat font-semibold tabular-nums text-text-primary">
                    {p.quantidade}
                  </span>
                  <span className="text-body-sm font-semibold text-text-primary">
                    {TEXTO_PENDENCIA[p.tipo](p.quantidade)}
                  </span>
                </p>
                <p className="text-body-sm text-text-secondary">{p.detalhe}</p>
                <LinkBotao to={linkDaPendencia(p)} variant="secondary" className="mt-auto w-fit">
                  {ACAO_PENDENCIA[p.tipo]}
                </LinkBotao>
              </Card>
            ))}
          </div>

          {/* Os gráficos ficam numa tela própria (Acompanhamento): aqui
              ficam só os três números do relance, para o Início não virar
              um relatório. */}
          <div className="mb-6">
            <Titulo nivel="secao" className="mb-3">
              Relatórios
            </Titulo>
            <div className="flex flex-wrap gap-2">
              <LinkBotao to="/coordenacao/indicadores" variant="secondary">
                Ver indicadores
              </LinkBotao>
              <LinkBotao to="/coordenacao/exports" variant="secondary" className="max-md:hidden">
                Exportar dados
              </LinkBotao>
            </div>
          </div>

          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <Titulo nivel="secao">Indicadores</Titulo>
            <LinkBotao to="/coordenacao/acompanhamento" variant="secondary">
              Ver gráficos de acompanhamento
            </LinkBotao>
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
              <h3 className="text-body-sm font-semibold text-text-primary">Frequência média</h3>
              <p className="mt-1 font-mono text-klass-stat font-semibold tabular-nums text-text-primary">
                {indicadores?.frequenciaMedia !== null && indicadores?.frequenciaMedia !== undefined
                  ? formatarPercentual(indicadores.frequenciaMedia)
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
              <h3 className="text-body-sm font-semibold text-text-primary">Aprovação nos módulos encerrados</h3>
              <p className="mt-1 font-mono text-klass-stat font-semibold tabular-nums text-text-primary">
                {indicadores?.aprovacaoModulosEncerrados !== null &&
                indicadores?.aprovacaoModulosEncerrados !== undefined
                  ? formatarPercentual(indicadores.aprovacaoModulosEncerrados)
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
              <h3 className="text-body-sm font-semibold text-text-primary">
                Evasão {indicadores?.periodoEvasao ? `(${indicadores.periodoEvasao})` : "no semestre"}
              </h3>
              <p className="mt-1 font-mono text-klass-stat font-semibold tabular-nums text-text-primary">
                {indicadores?.evasaoSemestreAtual !== null && indicadores?.evasaoSemestreAtual !== undefined
                  ? formatarPercentual(indicadores.evasaoSemestreAtual)
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

          {/* No celular a tabela rola na horizontal dentro do cartão, em vez
              de espremer as colunas. No desktop ela cabe no cartão: nomes de
              módulo/professor quebram linha, o badge de situação não. O
              título fica dentro do cartão, como na pág. 10. */}
          <Card className="overflow-x-auto !px-0 !py-0">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-4">
              <h2 className="text-klass-lg text-text-primary">Turmas em andamento</h2>
              <BotaoExportarCsv
                nome={["turmas-em-andamento"]}
                rotulo="Exportar turmas em andamento em CSV"
                linhas={turmas ?? []}
                colunas={[
                  { titulo: "Turma", valor: (t) => t.codigo },
                  { titulo: "Módulo", valor: (t) => t.moduloNome },
                  { titulo: "Trilha", valor: (t) => t.trilhaNome },
                  { titulo: "Professor", valor: (t) => t.professorNome },
                  { titulo: "Início", valor: (t) => formatarData(t.periodoInicio) },
                  { titulo: "Fim", valor: (t) => formatarData(t.periodoFim) },
                  { titulo: "Matriculados", valor: (t) => t.matriculados },
                  { titulo: "Vagas", valor: (t) => t.vagasTotal },
                  { titulo: "Inscrições em análise", valor: (t) => t.pendentes },
                  // Inteiro truncado, como na tela.
                  { titulo: "Freq. média (%)", valor: (t) => (t.frequenciaMedia !== null ? Math.trunc(t.frequenciaMedia) : null) },
                  { titulo: "Situação", valor: (t) => t.situacao },
                ]}
              />
            </div>
            <table className="w-full min-w-max text-left md:min-w-0">
              <thead>
                <tr className="border-y border-border bg-background text-label text-text-secondary">
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
                        className="whitespace-nowrap font-mono text-body-sm font-semibold text-primary hover:underline"
                      >
                        {t.codigo}
                      </LinkComPrefetch>
                    </td>
                    <td className="px-4 py-3 text-body-sm text-text-primary">{t.moduloNome}</td>
                    <td className="px-4 py-3 text-body-sm text-text-primary">{t.professorNome}</td>
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
                        {t.frequenciaMedia !== null ? formatarPercentual(t.frequenciaMedia) : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="contorno">{t.situacao}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <CartaoEstaSemana subtitulo="Inscrições dos últimos 7 dias e o que acontece nos próximos 7">
            <BlocoDaSemana titulo="Inscrições recebidas">
              {!semana && !erro && <Esqueleto className="h-4 w-48" />}
              {semana && semana.inscricoesRecebidas === 0 && (
                <VazioDaSemana>Nenhuma inscrição nos últimos 7 dias.</VazioDaSemana>
              )}
              {semana && semana.inscricoesRecebidas > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="flex items-baseline gap-2">
                    <span className="font-mono text-klass-lg font-semibold tabular-nums text-text-primary">
                      {semana.inscricoesRecebidas}
                    </span>
                    <span className="text-body-sm text-text-primary">
                      {flexionar(semana.inscricoesRecebidas, "inscrição recebida", "inscrições recebidas")}
                      {semana.inscricoesEmAnalise > 0
                        ? ` · ${plural(semana.inscricoesEmAnalise, "em análise", "em análise")}`
                        : " · todas já analisadas"}
                    </span>
                  </p>
                  {semana.inscricoesEmAnalise > 0 && (
                    <LinkBotao
                      variant="secondary"
                      to={
                        semana.turmasComInscricao.length === 1
                          ? `/coordenacao/turmas/${semana.turmasComInscricao[0]}?aba=inscricoes`
                          : "/coordenacao/turmas"
                      }
                    >
                      Revisar
                    </LinkBotao>
                  )}
                </div>
              )}
            </BlocoDaSemana>

            <BlocoDaSemana titulo="Turmas que começam ou terminam">
              {!semana && !erro && <Esqueleto className="h-4 w-48" />}
              {semana?.eventosDeTurma.length === 0 && (
                <VazioDaSemana>Nenhuma turma começa ou termina nos próximos 7 dias.</VazioDaSemana>
              )}
              <ul className="flex flex-col divide-y divide-border">
                {semana?.eventosDeTurma.map((e) => (
                  <li key={`${e.turmaId}-${e.tipo}`} className="flex flex-wrap items-baseline justify-between gap-x-3 py-2">
                    <LinkComPrefetch
                      to={`/coordenacao/turmas/${e.turmaId}`}
                      className="min-w-0 text-body-sm text-text-primary hover:underline"
                    >
                      <span className="font-mono font-semibold">{e.codigo}</span> · {e.moduloNome}
                    </LinkComPrefetch>
                    <span className="text-label text-text-secondary">
                      {e.tipo === "comeca" ? "Começa" : "Termina"} {formatarDiaSemanaData(e.data)}
                    </span>
                  </li>
                ))}
              </ul>
            </BlocoDaSemana>

            <BlocoDaSemana titulo="Chamadas atrasadas por turma">
              {!semana && !erro && <Esqueleto className="h-4 w-48" />}
              {semana?.atrasosPorTurma.length === 0 && (
                <VazioDaSemana>Nenhuma chamada atrasada.</VazioDaSemana>
              )}
              <ul className="flex flex-col divide-y divide-border">
                {semana?.atrasosPorTurma.map((a) => (
                  <li key={a.turmaId} className="flex flex-wrap items-baseline justify-between gap-x-3 py-2">
                    <LinkComPrefetch
                      to={`/coordenacao/turmas/${a.turmaId}?aba=aulas`}
                      className="font-mono text-body-sm font-semibold text-text-primary hover:underline"
                    >
                      {a.codigo}
                    </LinkComPrefetch>
                    <span className="text-label text-text-secondary">
                      {plural(a.quantidade, "chamada", "chamadas")} · desde {formatarData(a.maisAntiga)}
                    </span>
                  </li>
                ))}
              </ul>
            </BlocoDaSemana>
          </CartaoEstaSemana>
        </>
      )}
    </PaginaAutenticada>
  );
}
