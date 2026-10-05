import { codigoComTurno } from "@/lib/selecao";
import { TriangleAlert } from "lucide-react";
import { useAuth } from "@/auth";
import { LinkBotao } from "@/components/LinkBotao";
import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/Card";
import {
  BlocoDaSemana,
  CartaoEstaSemana,
  EMais,
  MAXIMO_NA_SEMANA,
  rotuloDoDia,
  VazioDaSemana,
} from "@/components/EstaSemana";
import { EsqueletoLinhas } from "@/components/Esqueleto";
import { ErroConsulta } from "@/components/ErroConsulta";
import { LinkComPrefetch } from "@/components/LinkComPrefetch";
import { StatusBadge } from "@/components/StatusBadge";
import { PaginaAutenticada } from "@/components/PaginaAutenticada";
import {
  useAlunosQuePedemAtencao,
  useAulasDaSemana,
  useAulasDeHoje,
  usePendenciasDoProfessor,
} from "@/lib/consultas/diario";
import { agruparPorDia } from "@/lib/diario";
import { plural } from "@/lib/plural";
import { formatarDataPorExtenso, formatarHora } from "@/lib/formato";

// D4 (klass-uikit.pdf) — tela "Hoje" do professor, substitui a home
// genérica anterior. Três cards construídos com dado real (turmas, aulas,
// avaliações, notas, presenças do próprio professor) — nada inventado.
export function Hoje() {
  // Só o id do usuário entra nas chaves: a revalidação de sessão ao focar
  // a aba troca o objeto `usuario`, mas não dispara busca nenhuma. As três
  // consultas compartilham a lista de turmas do cache (antes, cada card
  // buscava as turmas de novo).
  const { usuario } = useAuth();
  const consultaAulas = useAulasDeHoje(usuario?.id);
  const consultaPendencias = usePendenciasDoProfessor(usuario?.id);
  const consultaAtencao = useAlunosQuePedemAtencao(usuario?.id);
  const consultaSemana = useAulasDaSemana(usuario?.id);
  const aulas = consultaAulas.data;
  const aulasDaSemana = consultaSemana.data;
  // "Avaliação sem nota" não tem data: não é coisa de hoje, é trabalho da
  // semana. Fica em "Esta semana" ("Notas a lançar"), e "Pendências"
  // guarda o que vence agora (chamada atrasada, turma terminando) — o
  // mesmo item não aparece duas vezes na tela.
  const notasALancar = consultaPendencias.data?.filter((p) => p.tipo === "avaliacao_sem_nota");
  const pendencias = consultaPendencias.data?.filter((p) => p.tipo !== "avaliacao_sem_nota");
  const alunosAtencao = consultaAtencao.data;

  const chamadasFeitas = aulas?.filter((a) => a.chamadaFeita).length ?? 0;

  return (
    <PaginaAutenticada sobrelinha={formatarDataPorExtenso(new Date())} titulo="Hoje">

      {/* Duas colunas — esquerda mais larga (aulas do dia), direita mais
          estreita (pendências, depois alunos que pedem atenção), medido
          por proporção na tela de referência. */}
      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <Card>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-border pb-3">
            <h2 className="text-klass-lg text-text-primary">Aulas de hoje</h2>
            {aulas && aulas.length > 0 && (
              <p className="text-body-sm text-text-secondary">
                {plural(aulas.length, "aula", "aulas")} ·{" "}
                {plural(chamadasFeitas, "chamada feita", "chamadas feitas")}
              </p>
            )}
          </div>
          {consultaAulas.isError && !aulas && (
            <ErroConsulta
              erro={consultaAulas.error}
              padrao="Não foi possível carregar as aulas de hoje."
              tentarDeNovo={() => void consultaAulas.refetch()}
            />
          )}
          {consultaAulas.isPending && <EsqueletoLinhas quantidade={2} />}
          {aulas?.length === 0 && (
            <p className="text-body-sm text-text-secondary">Nenhuma aula programada para hoje.</p>
          )}
          <div className="flex flex-col divide-y divide-border">
            {aulas?.map((aula) => (
              <div key={aula.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <span className="w-14 shrink-0 font-mono text-klass-md tabular-nums text-text-primary">
                    {aula.horario ? formatarHora(aula.horario) : "—"}
                  </span>
                  <div>
                    <p className="text-body-sm font-medium text-text-primary">
                      {codigoComTurno(aula.turmaCodigo, aula.turmaTurno)} · {aula.moduloNome}
                      {aula.sala ? ` · ${aula.sala}` : ""}
                    </p>
                    <p className="text-label text-text-muted">{plural(aula.totalAlunos, "aluno", "alunos")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge
                    tipo="aula"
                    status={aula.chamadaFeita ? "chamada_feita" : "chamada_pendente"}
                  />
                  <LinkBotao
                    to={`/professor/turmas/${aula.turmaId}/aulas/${aula.id}/chamada`}
                    variant={aula.chamadaFeita ? "secondary" : "primary"}
                  >
                    {aula.chamadaFeita ? "Ver" : "Fazer chamada"}
                  </LinkBotao>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <h2 className="mb-3 flex items-center gap-2 border-b border-border pb-3 text-klass-lg text-text-primary">
              Pendências
              {pendencias && (
                <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-border px-2 font-mono text-label font-medium tabular-nums">
                  {pendencias.length}
                </span>
              )}
            </h2>
            {consultaPendencias.isError && !pendencias && (
              <ErroConsulta
                erro={consultaPendencias.error}
                padrao="Não foi possível carregar as pendências."
                tentarDeNovo={() => void consultaPendencias.refetch()}
              />
            )}
            {consultaPendencias.isPending && <EsqueletoLinhas quantidade={3} />}
            {pendencias?.length === 0 && (
              <p className="text-body-sm text-text-secondary">Nenhuma pendência no momento.</p>
            )}
            <div className="flex flex-col divide-y divide-border">
              {pendencias?.map((p, i) => (
                <div key={i} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="flex min-w-0 items-start gap-3">
                    <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-text-primary" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-body-sm font-medium text-text-primary">{p.titulo}</p>
                      <p className="text-label text-text-muted">{p.detalhe}</p>
                    </div>
                  </div>
                  <LinkBotao
                    variant="secondary"
                    to={
                      p.tipo === "chamada_atrasada"
                        ? `/professor/turmas/${p.turmaId}/aulas/${p.aulaId}/chamada`
                        : p.tipo === "chamada_fora_do_prazo"
                          ? `/professor/turmas/${p.turmaId}?aba=aulas`
                        : p.tipo === "turma_terminando"
                          ? // "Encerrar turma" fica na aba Alunos.
                            `/professor/turmas/${p.turmaId}?aba=alunos`
                          : `/professor/turmas/${p.turmaId}?aba=avaliacoes`
                    }
                  >
                    {p.tipo === "avaliacao_sem_nota"
                      ? "Lançar notas"
                      : p.tipo === "chamada_atrasada"
                        ? "Fazer chamada"
                        : p.tipo === "chamada_fora_do_prazo"
                          ? "Ver aula"
                          : "Revisar"}
                  </LinkBotao>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="mb-1 text-klass-lg text-text-primary">Alunos que pedem atenção</h2>
            <p className="mb-3 border-b border-border pb-3 text-label text-text-muted">
              Frequência abaixo da mínima da turma ou média abaixo da mínima da trilha.
            </p>
            {consultaAtencao.isError && !alunosAtencao && (
              <ErroConsulta
                erro={consultaAtencao.error}
                padrao="Não foi possível carregar os alunos que pedem atenção."
                tentarDeNovo={() => void consultaAtencao.refetch()}
              />
            )}
            {consultaAtencao.isPending && <EsqueletoLinhas quantidade={2} />}
            {alunosAtencao?.length === 0 && (
              <p className="text-body-sm text-text-secondary">Nenhum aluno nessa situação.</p>
            )}
            <div className="flex flex-col divide-y divide-border">
              {alunosAtencao?.map((a, i) => (
                <LinkComPrefetch
                  key={i}
                  to={`/professor/turmas/${a.turmaId}`}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar nome={a.alunoNome} />
                    <div className="min-w-0">
                      <p className="text-body-sm font-medium text-text-primary">{a.alunoNome}</p>
                      <p className="text-label text-text-muted">
                        {a.turmaCodigo} · {a.motivo}
                      </p>
                    </div>
                  </div>
                  <span className="font-mono text-klass-md font-semibold tabular-nums text-text-primary">
                    {a.valor}
                  </span>
                </LinkComPrefetch>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <CartaoEstaSemana subtitulo="Próximos 7 dias, a partir de amanhã">
        <BlocoDaSemana titulo="Próximas aulas">
          {consultaSemana.isError && !aulasDaSemana && (
            <ErroConsulta
              erro={consultaSemana.error}
              padrao="Não foi possível carregar as aulas da semana."
              tentarDeNovo={() => void consultaSemana.refetch()}
            />
          )}
          {consultaSemana.isPending && <EsqueletoLinhas quantidade={2} />}
          {aulasDaSemana?.length === 0 && <VazioDaSemana>Nenhuma aula nos próximos 7 dias.</VazioDaSemana>}
          <div className="flex flex-col gap-3">
            {aulasDaSemana &&
              agruparPorDia(aulasDaSemana.slice(0, MAXIMO_NA_SEMANA)).map((dia) => (
                <div key={dia.data}>
                  <p className="mb-1 text-label font-medium text-text-muted">{rotuloDoDia(dia.data)}</p>
                  <ul className="flex flex-col divide-y divide-border">
                    {dia.itens.map((aula) => (
                      <li key={aula.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2">
                        <LinkComPrefetch
                          to={`/professor/turmas/${aula.turmaId}?aba=aulas`}
                          className="flex min-w-0 items-baseline gap-3 hover:underline"
                        >
                          <span className="w-12 shrink-0 font-mono text-body-sm tabular-nums text-text-primary">
                            {aula.horario ? formatarHora(aula.horario) : "—"}
                          </span>
                          <span className="min-w-0 text-body-sm text-text-primary">
                            {codigoComTurno(aula.turmaCodigo, aula.turmaTurno)} · {aula.moduloNome}
                      {aula.sala ? ` · ${aula.sala}` : ""}
                          </span>
                        </LinkComPrefetch>
                        {aula.chamadaFeita ? (
                          <StatusBadge tipo="aula" status="chamada_feita" />
                        ) : (
                          // Aula futura sem chamada não é pendência: só "a fazer".
                          <span className="text-label text-text-muted">Chamada a fazer</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
          <EMais quantidade={(aulasDaSemana?.length ?? 0) - MAXIMO_NA_SEMANA}>
            <LinkComPrefetch to="/professor/turmas" className="font-medium text-primary hover:underline">
              ver em Minhas turmas
            </LinkComPrefetch>
          </EMais>
        </BlocoDaSemana>

        <BlocoDaSemana titulo="Notas a lançar">
          {consultaPendencias.isPending && <EsqueletoLinhas quantidade={2} />}
          {notasALancar?.length === 0 && (
            <VazioDaSemana>Todas as avaliações têm nota para os alunos ativos.</VazioDaSemana>
          )}
          <ul className="flex flex-col divide-y divide-border">
            {notasALancar?.map((p, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="text-body-sm text-text-primary">{p.titulo}</p>
                  <p className="text-label text-text-muted">{p.detalhe}</p>
                </div>
                <LinkBotao variant="secondary" to={`/professor/turmas/${p.turmaId}?aba=avaliacoes`}>
                  Lançar notas
                </LinkBotao>
              </li>
            ))}
          </ul>
        </BlocoDaSemana>
      </CartaoEstaSemana>
    </PaginaAutenticada>
  );
}
