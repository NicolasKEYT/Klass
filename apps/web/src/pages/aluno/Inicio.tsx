import { Link } from "react-router-dom";
import { Award, Check, FileText } from "lucide-react";
import { useAuth } from "@/auth";
import { BarraDeMeta } from "@/components/BarraDeMeta";
import { LinkBotao } from "@/components/LinkBotao";
import { Badge } from "@/components/Badge";
import { Card } from "@/components/Card";
import {
  BlocoDaSemana,
  CartaoEstaSemana,
  EMais,
  MAXIMO_NA_SEMANA,
  rotuloDoDia,
  VazioDaSemana,
} from "@/components/EstaSemana";
import { EsqueletoLinhas, RegiaoCarregando } from "@/components/Esqueleto";
import { ErroConsulta } from "@/components/ErroConsulta";
import { PaginaAutenticada } from "@/components/PaginaAutenticada";
import { useModulosDaTrilha, useTrilhaPorId } from "@/lib/consultas/catalogo";
import { flexionar, plural } from "@/lib/plural";
import {
  useAulasDaSemanaDoAluno,
  useAulasDoAluno,
  useNotasDaSemana,
  useNovidadesDoAluno,
  useProgresso,
} from "@/lib/consultas/diario";
import { INSTITUICAO } from "@/lib/instituicao";
import { useMatriculasDoAluno } from "@/lib/consultas/selecao";
import {
  agruparPorDia,
  calcularMargemDeFaltas,
  escolherMatriculaEmAndamento,
  montarProximoPasso,
  type MargemDeFaltas,
  type ProximoPassoAluno,
} from "@/lib/diario";
import type { MatriculaDoAluno } from "@/lib/selecao";
import {
  formatarDiaSemanaData,
  formatarHora,
  formatarNota,
  formatarPercentual,
  formatarTempoRelativo,
} from "@/lib/formato";

// Quando não há módulo em curso (passo = null), o motivo muda a mensagem:
// a mesma frase de "explore o catálogo" aparecia para quem só esperava a
// análise da inscrição ou já tinha concluído tudo.
type SituacaoSemCurso = "sem_matricula" | "em_analise" | "tudo_concluido";

function situacaoSemCurso(matriculas: MatriculaDoAluno[]): SituacaoSemCurso {
  if (matriculas.some((m) => m.status === "inscrita")) return "em_analise";
  if (matriculas.some((m) => m.status === "concluida")) return "tudo_concluido";
  return "sem_matricula";
}

const UM_DIA_MS = 86_400_000;

// Frase do card de frequência (pág. 4): diz sem rodeio se ainda dá para
// faltar, se o limite chegou ou se já passou dele.
function fraseDaMargem(m: MargemDeFaltas): string {
  if (m.totalAulas === 0) return "As aulas deste módulo ainda não foram cadastradas.";
  if (m.restantes > 0) return `Você pode faltar mais ${plural(m.restantes, "aula", "aulas")} até o fim do módulo.`;
  if (m.restantes === 0) return "Você não pode faltar mais nenhuma aula até o fim do módulo.";
  return `Você já passou do limite de faltas deste módulo: ${plural(m.faltas, "falta", "faltas")}, para um máximo de ${m.limite}.`;
}

// O título do "próximo passo" segue o modo de certificação da trilha: por
// módulo, o certificado sai ao concluir o módulo em curso; só da trilha,
// ao concluir todos; no combinado, os dois (e coincidem no último módulo).
function fraseDoCertificado(p: ProximoPassoAluno): string {
  const faltam = Math.max(p.totalModulos - p.modulosConcluidos, 1);
  const faltamTexto = `${flexionar(faltam, "Falta", "Faltam")} ${plural(faltam, "módulo", "módulos")}`;
  if (p.tipoCertificacao === "modulo") return `Seu próximo certificado sai ao concluir ${p.moduloAtualNome}`;
  if (p.tipoCertificacao === "modulo_e_trilha") {
    return faltam === 1
      ? `Ao concluir ${p.moduloAtualNome}, você recebe o certificado do módulo e o da trilha`
      : `Seu próximo certificado sai ao concluir ${p.moduloAtualNome}. ${faltamTexto} para o da trilha`;
  }
  return `${faltamTexto} para o seu certificado`;
}

// D4 (klass-uikit.pdf) — "Início" do aluno, mobile-first: "Seu próximo
// passo" com progresso em barra segmentada, frequência do módulo atual
// contra a meta de 75%, e um feed de novidades derivado dos mesmos dados
// do Realtime.
export function Inicio() {
  const { usuario, profile } = useAuth();
  // Cada pedaço vem da sua entrada no cache (as mesmas do Boletim): a
  // matrícula escolhida decide quais trilha, módulos e progresso ler.
  const consultaMatriculas = useMatriculasDoAluno(usuario?.id);
  const matriculas = consultaMatriculas.data;
  const escolha = matriculas ? escolherMatriculaEmAndamento(matriculas) : undefined;
  const consultaTrilha = useTrilhaPorId(escolha?.matricula.trilhaId);
  const consultaModulos = useModulosDaTrilha(escolha?.matricula.trilhaId);
  const consultaProgresso = useProgresso(escolha?.matricula.id);
  const consultaAulas = useAulasDoAluno(escolha?.matricula.id, escolha?.matricula.turmaId);
  const margem =
    consultaAulas.data && escolha
      ? calcularMargemDeFaltas(consultaAulas.data, escolha.matricula.frequenciaMinimaPercentual)
      : null;
  // undefined = ainda carregando; [] = carregou e não há nada — sem essa
  // distinção, "Nada novo por enquanto." aparecia durante a carga.
  const consultaNovidades = useNovidadesDoAluno(usuario?.id);
  const novidades = consultaNovidades.data;
  const semana = useAulasDaSemanaDoAluno(matriculas);
  const consultaNotasDaSemana = useNotasDaSemana(usuario?.id);
  const notasDaSemana = consultaNotasDaSemana.data;

  // Erro de carregamento não pode virar "passo = null" — esse valor já
  // tem um significado real (aluno sem matrícula em andamento) e mostra a
  // mensagem de "explore o catálogo". Confundir os dois escondia falha de
  // rede/RLS por trás de uma mensagem enganosa.
  const consultasDoPasso = escolha
    ? [consultaMatriculas, consultaTrilha, consultaModulos, consultaProgresso]
    : [consultaMatriculas];
  const consultaComErro = consultasDoPasso.find((c) => c.isError);
  const erro = consultaComErro?.error ?? null;

  let passo: ProximoPassoAluno | null | undefined;
  if (escolha === undefined) passo = undefined;
  else if (escolha === null) passo = null;
  else if (!consultaTrilha.data || !consultaModulos.data || !consultaProgresso.data)
    passo = consultaTrilha.data === null ? null : undefined;
  else passo = montarProximoPasso(escolha, consultaTrilha.data, consultaModulos.data, consultaProgresso.data);
  const situacao = situacaoSemCurso(matriculas ?? []);

  return (
    <PaginaAutenticada
      largura="media"
      sobrelinha={INSTITUICAO.nome}
      titulo={`Olá, ${profile?.nome_completo?.split(" ")[0] ?? "..."}`}
    >

      {erro && (
        <ErroConsulta
          className="mt-4"
          erro={erro}
          padrao="Não foi possível carregar seu painel."
          tentarDeNovo={() => consultasDoPasso.forEach((c) => c.isError && void c.refetch())}
        />
      )}

      {!erro && passo === undefined && (
        <RegiaoCarregando className="mt-4 flex flex-col gap-4">
          <div className="h-48 animate-pulse rounded-klass-card border border-border bg-surface-subtle" />
          <div className="h-32 animate-pulse rounded-klass-card border border-border bg-surface-subtle" />
        </RegiaoCarregando>
      )}

      {!erro && passo === null && (
        <Card className="mt-4">
          <p className="text-body-sm text-text-secondary">
            {situacao === "sem_matricula" && (
              <>
                Você ainda não está cursando nenhuma trilha. Que tal explorar o{" "}
                <Link to="/catalogo" className="font-medium text-primary hover:underline">
                  catálogo
                </Link>
                ?
              </>
            )}
            {situacao === "em_analise" && (
              <>
                Sua inscrição está em análise pela coordenação. Acompanhe pelo{" "}
                <Link to="/aluno/boletim" className="font-medium text-primary hover:underline">
                  boletim
                </Link>
                .
              </>
            )}
            {situacao === "tudo_concluido" && (
              <>
                Você concluiu todos os módulos em que se inscreveu. Veja seus{" "}
                <Link to="/aluno/certificados" className="font-medium text-primary hover:underline">
                  certificados
                </Link>
                .
              </>
            )}
          </p>
        </Card>
      )}

      {passo && (
        <>
          <Card destaque className="mt-4">
            <p className="mb-2 text-label font-medium text-text-secondary">Seu próximo passo</p>
            <p className="mb-3 text-klass-lg font-semibold text-text-primary">
              {fraseDoCertificado(passo)}
            </p>
            {/* Barra segmentada — um bloco por módulo: concluídos em preto, o
                que está em curso em cinza médio, os demais claros (pág. 4). */}
            <div className="flex gap-1">
              {Array.from({ length: passo.totalModulos }).map((_, i) => (
                <div
                  key={i}
                  className={`h-2 flex-1 rounded-full ${
                    i < passo.modulosConcluidos
                      ? "bg-text-primary"
                      : i === passo.modulosConcluidos
                        ? "bg-controle"
                        : "bg-neutral-subtle"
                  }`}
                />
              ))}
            </div>
            <p className="mt-2 text-body-sm text-text-secondary">
              {passo.trilhaNome} · {passo.modulosConcluidos} de {passo.totalModulos} módulos ·
              cursando {passo.moduloAtualNome}
            </p>
            <LinkBotao to="/aluno/boletim" className="mt-3 w-full">
              Ver boletim
            </LinkBotao>
          </Card>

          <Card className="mt-4">
            <h2 className="mb-2 text-klass-md font-semibold text-text-primary">Frequência no módulo</h2>
            <p className="mb-2 flex items-baseline gap-2">
              <span className="font-mono text-klass-xl font-semibold tabular-nums text-text-primary">
                {passo.frequenciaAtual !== null ? formatarPercentual(passo.frequenciaAtual) : "—"}
              </span>
              <span className="text-body-sm text-text-secondary">mínimo {formatarPercentual(passo.frequenciaMinima)}</span>
            </p>
            <BarraDeMeta
              valor={passo.frequenciaAtual ?? 0}
              meta={passo.frequenciaMinima}
              rotulo="Frequência no módulo atual"
            />
            {margem && <p className="mt-2 text-body-sm text-text-secondary">{fraseDaMargem(margem)}</p>}
          </Card>
        </>
      )}

      <Card className="mt-4">
        <h2 className="mb-1 border-b border-border pb-3 text-klass-md font-semibold text-text-primary">
          Novidades
        </h2>
        {consultaNovidades.isError && !novidades && (
          <ErroConsulta
            erro={consultaNovidades.error}
            padrao="Não foi possível carregar as novidades."
            tentarDeNovo={() => void consultaNovidades.refetch()}
          />
        )}
        {consultaNovidades.isPending && (
          <EsqueletoLinhas quantidade={3} />
        )}
        {novidades?.length === 0 && (
          <p className="text-body-sm text-text-secondary">Nada novo por enquanto.</p>
        )}
        <div className="flex flex-col divide-y divide-border">
          {novidades?.map((n, i) => (
            <div key={i} className="flex items-center gap-3 py-3 last:pb-0">
              {n.tipo === "nota" ? (
                <FileText className="h-5 w-5 shrink-0 text-text-primary" aria-hidden />
              ) : (
                <Check className="h-5 w-5 shrink-0 text-text-primary" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-body-sm font-medium text-text-primary">{n.texto}</p>
                <p className="text-label text-text-secondary">
                  {n.detalhe} · {formatarTempoRelativo(n.quando)}
                </p>
              </div>
              {/* "novo" = chegou nas últimas 24 h. */}
              {Date.now() - new Date(n.quando).getTime() < UM_DIA_MS && <Badge>novo</Badge>}
            </div>
          ))}
        </div>
      </Card>

      <CartaoEstaSemana subtitulo="Aulas dos próximos 7 dias e notas dos últimos 7">
        <BlocoDaSemana titulo="Próximas aulas">
          {semana.erro && !semana.aulas && (
            <ErroConsulta
              erro={semana.erro}
              padrao="Não foi possível carregar as próximas aulas."
              tentarDeNovo={semana.tentarDeNovo}
            />
          )}
          {!semana.aulas && !semana.erro && <EsqueletoLinhas quantidade={2} />}
          {semana.aulas?.length === 0 && <VazioDaSemana>Nenhuma aula nos próximos 7 dias.</VazioDaSemana>}
          <div className="flex flex-col gap-3">
            {semana.aulas &&
              agruparPorDia(semana.aulas.slice(0, MAXIMO_NA_SEMANA)).map((dia) => (
                <div key={dia.data}>
                  <p className="mb-1 text-label font-medium text-text-muted">{rotuloDoDia(dia.data)}</p>
                  <ul className="flex flex-col divide-y divide-border">
                    {dia.itens.map((aula) => (
                      <li key={aula.id} className="flex items-baseline gap-3 py-2">
                        <span className="w-12 shrink-0 font-mono text-body-sm tabular-nums text-text-primary">
                          {aula.horario ? formatarHora(aula.horario) : "—"}
                        </span>
                        <span className="min-w-0 flex-1 text-body-sm text-text-primary">
                          {aula.moduloNome} <span className="text-text-muted">· {aula.turmaCodigo}</span>
                        </span>
                        {/* Só aparece quando a chamada da aula já foi feita (hoje). */}
                        {aula.presente !== null && (
                          <span className="shrink-0 text-label text-text-secondary">
                            {aula.presente ? "Presente" : "Falta"}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
          <EMais quantidade={(semana.aulas?.length ?? 0) - MAXIMO_NA_SEMANA}>
            <Link to="/aluno/boletim" className="font-medium text-primary hover:underline">
              ver no boletim
            </Link>
          </EMais>
        </BlocoDaSemana>

        <BlocoDaSemana titulo="Notas lançadas">
          {consultaNotasDaSemana.isError && !notasDaSemana && (
            <ErroConsulta
              erro={consultaNotasDaSemana.error}
              padrao="Não foi possível carregar as notas da semana."
              tentarDeNovo={() => void consultaNotasDaSemana.refetch()}
            />
          )}
          {consultaNotasDaSemana.isPending && <EsqueletoLinhas quantidade={2} />}
          {notasDaSemana?.length === 0 && <VazioDaSemana>Nenhuma nota lançada nos últimos 7 dias.</VazioDaSemana>}
          <ul className="flex flex-col divide-y divide-border">
            {notasDaSemana?.map((n, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="text-body-sm text-text-primary">{n.avaliacaoTitulo}</p>
                  <p className="text-label text-text-muted">
                    {n.moduloNome} · {formatarDiaSemanaData(n.lancadaEm)}
                  </p>
                </div>
                <span className="font-mono text-klass-md font-semibold tabular-nums text-text-primary">
                  {formatarNota(n.valor)}
                </span>
              </li>
            ))}
          </ul>
          {notasDaSemana && notasDaSemana.length > 0 && (
            <Link to="/aluno/boletim" className="mt-2 inline-block text-body-sm font-medium text-primary hover:underline">
              Ver no boletim
            </Link>
          )}
        </BlocoDaSemana>
      </CartaoEstaSemana>

      {!erro && passo === null && situacao !== "tudo_concluido" && (
        <div className="mt-4 flex items-center gap-2 text-label text-text-muted">
          <Award className="h-4 w-4" aria-hidden />
          Certificados aparecem aqui assim que você concluir um módulo ou trilha.
        </div>
      )}
    </PaginaAutenticada>
  );
}
