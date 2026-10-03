import { Link } from "react-router-dom";
import { Award, Bell, CheckCheck, FileText } from "lucide-react";
import { useAuth } from "@/auth";
import { BarraDeMeta } from "@/components/BarraDeMeta";
import { LinkBotao } from "@/components/LinkBotao";
import { Card } from "@/components/Card";
import { EsqueletoLinhas, RegiaoCarregando } from "@/components/Esqueleto";
import { ErroConsulta } from "@/components/ErroConsulta";
import { Titulo } from "@/components/Titulo";
import { useModulosDaTrilha, useTrilhaPorId } from "@/lib/consultas/catalogo";
import { plural } from "@/lib/plural";
import { useNovidadesDoAluno, useProgresso } from "@/lib/consultas/diario";
import { useMatriculasDoAluno } from "@/lib/consultas/selecao";
import { escolherMatriculaEmAndamento, montarProximoPasso, type ProximoPassoAluno } from "@/lib/diario";
import type { MatriculaDoAluno } from "@/lib/selecao";

// Quando não há módulo em curso (passo = null), o motivo muda a mensagem:
// a mesma frase de "explore o catálogo" aparecia para quem só esperava a
// análise da inscrição ou já tinha concluído tudo.
type SituacaoSemCurso = "sem_matricula" | "em_analise" | "tudo_concluido";

function situacaoSemCurso(matriculas: MatriculaDoAluno[]): SituacaoSemCurso {
  if (matriculas.some((m) => m.status === "inscrita")) return "em_analise";
  if (matriculas.some((m) => m.status === "concluida")) return "tudo_concluido";
  return "sem_matricula";
}

function tempoRelativo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutos = Math.round(diffMs / 60_000);
  if (minutos < 1) return "agora";
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `há ${horas}h`;
  const dias = Math.round(horas / 24);
  return `há ${plural(dias, "dia", "dias")}`;
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
  // undefined = ainda carregando; [] = carregou e não há nada — sem essa
  // distinção, "Nada novo por enquanto." aparecia durante a carga.
  const consultaNovidades = useNovidadesDoAluno(usuario?.id);
  const novidades = consultaNovidades.data;

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
    <>
      <Titulo>Olá, {profile?.nome_completo?.split(" ")[0] ?? "..."}</Titulo>

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
          <Card className="mt-4">
            <p className="mb-2 text-label font-medium text-text-muted">Seu próximo passo</p>
            <p className="mb-3 text-klass-lg font-semibold text-text-primary">
              {passo.totalModulos - passo.modulosConcluidos === 1
                ? "Falta 1 módulo para o seu certificado"
                : `Faltam ${passo.totalModulos - passo.modulosConcluidos} módulos para o seu certificado`}
            </p>
            {/* Barra segmentada — módulos concluídos vs. total. */}
            <div className="flex gap-1">
              {Array.from({ length: passo.totalModulos }).map((_, i) => (
                <div
                  key={i}
                  className={`h-2 flex-1 rounded-full ${
                    i < passo.modulosConcluidos ? "bg-text-primary" : "bg-neutral-subtle"
                  }`}
                />
              ))}
            </div>
            <p className="mt-2 text-label text-text-muted">
              {passo.trilhaNome} · {passo.modulosConcluidos} de {passo.totalModulos} módulos ·
              cursando {passo.moduloAtualNome}
            </p>
            <LinkBotao to="/aluno/boletim" className="mt-3 w-full">
              Ver boletim
            </LinkBotao>
          </Card>

          <Card className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-label font-medium text-text-muted">Frequência no módulo</p>
            </div>
            <p className="mb-2 font-mono text-klass-xl font-semibold tabular-nums text-text-primary">
              {passo.frequenciaAtual !== null ? `${passo.frequenciaAtual.toFixed(0)}%` : "—"}{" "}
              <span className="text-klass-md font-normal text-text-muted">
                mínimo {passo.frequenciaMinima}%
              </span>
            </p>
            <BarraDeMeta
              valor={passo.frequenciaAtual ?? 0}
              meta={passo.frequenciaMinima}
              rotulo="Frequência no módulo atual"
            />
          </Card>
        </>
      )}

      <Card className="mt-4">
        <p className="mb-3 flex items-center gap-2 text-label font-medium text-text-muted">
          <Bell className="h-4 w-4" aria-hidden />
          Novidades
        </p>
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
        <div className="flex flex-col gap-3">
          {novidades?.map((n, i) => (
            <div key={i} className="flex items-start gap-2.5">
              {n.texto.startsWith("Nota") ? (
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" aria-hidden />
              ) : (
                <CheckCheck className="mt-0.5 h-4 w-4 shrink-0 text-text-primary" aria-hidden />
              )}
              <div>
                <p className="text-body-sm text-text-primary">{n.texto}</p>
                <p className="text-label text-text-muted">
                  {n.detalhe} · {tempoRelativo(n.quando)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {!erro && passo === null && situacao !== "tudo_concluido" && (
        <div className="mt-4 flex items-center gap-2 text-label text-text-muted">
          <Award className="h-4 w-4" aria-hidden />
          Certificados aparecem aqui assim que você concluir um módulo ou trilha.
        </div>
      )}
    </>
  );
}
