import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueries, type QueryKey, type UseQueryOptions } from "@tanstack/react-query";
import { Award, ChevronDown, ChevronUp, Lock, Unlock } from "lucide-react";
import { useAuth } from "@/auth";
import { CancelarInscricao } from "@/components/aluno/CancelarInscricao";
import { Badge } from "@/components/Badge";
import { MateriaisDaTurma } from "@/components/diario/MateriaisDaTurma";
import { BotaoBaixarCertificado } from "@/components/BotaoBaixarCertificado";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Esqueleto, EsqueletoCards, RegiaoCarregando } from "@/components/Esqueleto";
import { ErroConsulta } from "@/components/ErroConsulta";
import { LinkComPrefetch } from "@/components/LinkComPrefetch";
import { PaginaAutenticada } from "@/components/PaginaAutenticada";
import { StatusBadge } from "@/components/StatusBadge";
import { Titulo } from "@/components/Titulo";
import { opcoesCatalogo } from "@/lib/consultas/catalogo";
import { useCertificadosDoAluno } from "@/lib/consultas/certificacao";
import { opcoesDiario, useProgressos } from "@/lib/consultas/diario";
import { useMatriculasDoAluno } from "@/lib/consultas/selecao";
import { formatarDecimal, formatarMedia, formatarNota, formatarPercentual } from "@/lib/formato";
import type { AvaliacaoComNota, ProgressoMatricula } from "@/lib/diario";
import type { MatriculaDoAluno } from "@/lib/selecao";
import type { Certificado, Modulo, Trilha } from "@klass/types";
import { certificadoRevogado } from "@/lib/certificacao";
import { rotuloPreRequisito } from "@/lib/catalogo";

// D8 (klass-uikit.pdf) — "Boletim" (era "Minhas matrículas"): em vez de
// listar matrículas soltas, agrupa por trilha e mostra cada módulo como
// card, com o módulo em andamento expandido inline (avaliações, critério
// de aprovação com os valores reais da trilha). Substitui a navegação
// para uma página de detalhe por matrícula — tudo fica na mesma tela.
//
// Leitura pelo cache: matrículas e certificados primeiro; depois, tudo em
// paralelo — trilha, módulos e pré-requisitos de cada trilha, progresso e
// notas de cada matrícula (antes era uma cascata trilha → módulos →
// matrícula). O Realtime (notas, chamada, matrícula) vive no layout
// autenticado e invalida essas entradas: a tela se atualiza sozinha.
interface LinhaModulo {
  modulo: Modulo;
  matricula: MatriculaDoAluno | undefined;
  /** Nomes dos módulos pré-requisito que faltam concluir (só quando sem matrícula). */
  faltantes: string[];
  progresso: ProgressoMatricula | null;
  avaliacoes: AvaliacaoComNota[];
}

interface GrupoTrilha {
  trilha: Trilha;
  linhas: LinhaModulo[];
  certificadoTrilha: Certificado | undefined;
  certificadosModulo: Certificado[];
}

// Mesmos status que a RLS de diario.notas libera para o aluno.
const STATUS_COM_NOTAS = new Set(["matriculada", "concluida", "reprovada"]);

// Várias leituras do mesmo tipo em paralelo, indexadas por id.
function useLeiturasEmLote<T, K extends QueryKey>(consultas: UseQueryOptions<T, Error, T, K>[], chaves: string[]) {
  return useQueries({
    queries: consultas,
    combine: (resultados) => ({
      porChave: new Map(
        resultados.flatMap((r, i) => (r.data !== undefined ? [[chaves[i], r.data] as const] : [])),
      ),
      pendente: resultados.some((r) => r.isPending),
      erro: resultados.find((r) => r.isError)?.error ?? null,
      tentarDeNovo: () => resultados.forEach((r) => r.isError && void r.refetch()),
    }),
  });
}

export function Boletim() {
  const { usuario } = useAuth();
  const consultaMatriculas = useMatriculasDoAluno(usuario?.id);
  const consultaCertificados = useCertificadosDoAluno(usuario?.id);
  const matriculas = consultaMatriculas.data;

  const trilhaIds = [...new Set((matriculas ?? []).map((m) => m.trilhaId).filter(Boolean))];
  // reverse(): a lista vem da mais recente para a mais antiga, e no Map a
  // última escrita vence — assim, depois de uma reinscrição, o card
  // mostra a matrícula nova, não a rejeitada/reprovada.
  const matriculaPorModulo = new Map((matriculas ?? []).slice().reverse().map((m) => [m.moduloId, m]));
  const exibidas = [...matriculaPorModulo.values()];
  const comNotas = exibidas.filter((m) => STATUS_COM_NOTAS.has(m.status));

  const trilhas = useLeiturasEmLote(
    trilhaIds.map((id) => opcoesCatalogo.trilhaPorId(id)),
    trilhaIds,
  );
  const modulos = useLeiturasEmLote(trilhaIds.map((id) => opcoesCatalogo.modulos(id)), trilhaIds);
  // Compara pelo id do módulo exigido (dois módulos podem ter o mesmo
  // nome); o nome e a trilha vêm junto, já que pode ser de outra trilha.
  const preRequisitos = useLeiturasEmLote(
    trilhaIds.map((id) => opcoesCatalogo.preRequisitosDaTrilha(id)),
    trilhaIds,
  );
  const progressos = useProgressos(exibidas.map((m) => m.id));
  const notas = useLeiturasEmLote(
    comNotas.map((m) => opcoesDiario.notasDoAluno(m.id, m.turmaId)),
    comNotas.map((m) => m.id),
  );

  const leituras = [trilhas, modulos, preRequisitos, progressos, notas];
  const erro =
    consultaMatriculas.error ?? consultaCertificados.error ?? leituras.find((l) => l.erro)?.erro ?? null;
  const carregando =
    consultaMatriculas.isPending || consultaCertificados.isPending || leituras.some((l) => l.pendente);

  // Módulos encerrados (concluído/reprovado) começam recolhidos — o
  // aluno expande para ver a nota de cada avaliação.
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  function alternarExpandido(moduloId: string) {
    setExpandidos((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(moduloId)) proximo.delete(moduloId);
      else proximo.add(moduloId);
      return proximo;
    });
  }

  let grupos: GrupoTrilha[] | null = null;
  if (matriculas && consultaCertificados.data && !carregando) {
    const certificados = consultaCertificados.data;
    // De qualquer trilha: o pré-requisito pode ser módulo de outra (A15).
    const concluidos = new Set(matriculas.filter((m) => m.status === "concluida").map((m) => m.moduloId));
    grupos = trilhaIds.flatMap((trilhaId): GrupoTrilha[] => {
      const trilha = trilhas.porChave.get(trilhaId);
      if (!trilha) return [];
      const modulosDaTrilha = modulos.porChave.get(trilhaId) ?? [];
      const linhas = modulosDaTrilha.map((modulo): LinhaModulo => {
        const matricula = matriculaPorModulo.get(modulo.id);
        if (!matricula) {
          const faltantes = (preRequisitos.porChave.get(trilhaId)?.get(modulo.id) ?? [])
            .filter((p) => !concluidos.has(p.pre_requisito_id))
            .map((p) => rotuloPreRequisito(p, trilhaId));
          return { modulo, matricula: undefined, faltantes, progresso: null, avaliacoes: [] };
        }
        return {
          modulo,
          matricula,
          faltantes: [],
          progresso: progressos.porMatricula.get(matricula.id) ?? null,
          avaliacoes: notas.porChave.get(matricula.id) ?? [],
        };
      });
      // Revogados (encerramento desfeito) não valem mais: não liberam o
      // download aqui; continuam listados, marcados, em "Meus certificados".
      const certificadosDaTrilha = certificados.filter(
        (c) => c.trilha_id === trilhaId && !certificadoRevogado(c),
      );
      return [
        {
          trilha,
          linhas,
          certificadoTrilha: certificadosDaTrilha.find((c) => c.modulo_id === null),
          certificadosModulo: certificadosDaTrilha.filter((c) => c.modulo_id !== null),
        },
      ];
    });
  }

  // Com uma trilha só (o caso comum), o nome dela vira a sobrelinha do
  // cabeçalho, como na pág. 5; com mais de uma, cada grupo tem seu título.
  const umaTrilhaSo = grupos?.length === 1;
  // pág. 5: "Trilha · CÓDIGO" — o código da turma em curso (matrícula
  // ativa) entra depois do nome da trilha; sem turma em curso, só a trilha.
  const turmasEmCurso =
    umaTrilhaSo && grupos
      ? grupos[0].linhas.flatMap((l) => (l.matricula?.status === "matriculada" ? [l.matricula.turmaCodigo] : []))
      : [];
  const sobrelinha =
    umaTrilhaSo && grupos
      ? [grupos[0].trilha.nome, ...(turmasEmCurso.length ? [turmasEmCurso.join(", ")] : [])].join(" · ")
      : undefined;

  return (
    <PaginaAutenticada
      largura="media"
      titulo="Boletim"
      sobrelinha={sobrelinha}
    >
      {erro && !grupos && (
        <ErroConsulta
          className="mb-4"
          erro={erro}
          padrao="Não foi possível carregar o boletim."
          tentarDeNovo={() => {
            if (consultaMatriculas.isError) void consultaMatriculas.refetch();
            if (consultaCertificados.isError) void consultaCertificados.refetch();
            leituras.forEach((l) => l.tentarDeNovo());
          }}
        />
      )}
      {!erro && carregando && (
        <RegiaoCarregando className="flex flex-col gap-3">
          <Esqueleto className="h-6 w-48" />
          <EsqueletoCards quantidade={3} altura="h-28" />
        </RegiaoCarregando>
      )}
      {grupos?.length === 0 && (
        <p className="text-body-sm text-text-secondary">
          Você ainda não se inscreveu em nenhuma trilha — explore o{" "}
          <Link to="/catalogo" className="font-medium text-primary hover:underline">
            catálogo
          </Link>
          .
        </p>
      )}

      <div className="flex flex-col gap-8">
        {grupos?.map((grupo) => {
          const totalModulos = grupo.linhas.length;
          const concluidos = grupo.linhas.filter((l) => l.matricula?.status === "concluida").length;
          const trilhaConcluida = totalModulos > 0 && concluidos === totalModulos;

          return (
            <section key={grupo.trilha.id} aria-label={grupo.trilha.nome}>
              {!umaTrilhaSo && (
                <Titulo nivel="secao" className="mb-3">
                  {grupo.trilha.nome}
                </Titulo>
              )}

              {/* pág. 5 — um cartão por trilha, módulos separados por
                  divisória (antes: um cartão por módulo). */}
              <Card className="flex flex-col divide-y divide-border !py-0">
                {grupo.linhas.map(({ modulo, matricula, faltantes, progresso, avaliacoes }) => {
                  const emCurso = matricula?.status === "matriculada";
                  const encerrado = matricula?.status === "concluida" || matricula?.status === "reprovada";
                  return (
                    <div key={modulo.id} className="flex flex-col gap-2 py-4">
                      {/* flex-wrap: no celular, sem espaço, o badge desce
                          inteiro para baixo do título em vez de espremê-lo. */}
                      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                        <div className="min-w-0 flex-1 basis-40">
                          <Titulo nivel="item" as="h3" className="!text-klass-md">
                            {modulo.nome}
                          </Titulo>
                          {matricula && progresso && (
                            <p className="text-body-sm text-text-secondary">
                              {emCurso ? "Média parcial " : "Média "}
                              <span className="font-mono font-medium tabular-nums text-text-primary">
                                {progresso.media !== null ? formatarMedia(progresso.media) : "—"}
                              </span>
                              {" · Freq. "}
                              <span className="font-mono font-medium tabular-nums text-text-primary">
                                {progresso.frequencia !== null ? formatarPercentual(progresso.frequencia) : "—"}
                              </span>
                            </p>
                          )}
                          {!matricula && faltantes.length > 0 && (
                            <p className="text-body-sm text-text-secondary">
                              Libera depois de {faltantes.join(", ")}
                            </p>
                          )}
                        </div>
                        {matricula ? (
                          <StatusBadge tipo="matricula" status={matricula.status} />
                        ) : faltantes.length === 0 ? (
                          <LinkComPrefetch to={`/catalogo/${grupo.trilha.slug}/modulos/${modulo.id}`}>
                            <Badge variant="contorno">
                              <Unlock className="h-3.5 w-3.5" aria-hidden />
                              Disponível
                            </Badge>
                          </LinkComPrefetch>
                        ) : (
                          <Badge variant="tracejado">
                            <Lock className="h-3.5 w-3.5" aria-hidden />
                            Bloqueado
                          </Badge>
                        )}
                      </div>

                      {matricula?.status === "inscrita" && (
                        <CancelarInscricao matriculaId={matricula.id} turmaCodigo={matricula.turmaCodigo} />
                      )}

                      {encerrado && avaliacoes.length > 0 && (
                        <button
                          type="button"
                          onClick={() => alternarExpandido(modulo.id)}
                          aria-expanded={expandidos.has(modulo.id)}
                          aria-controls={`notas-${modulo.id}`}
                          className="flex items-center gap-1 self-start text-label font-medium text-primary hover:underline"
                        >
                          {expandidos.has(modulo.id) ? "Ocultar notas" : "Ver notas por avaliação"}
                          {expandidos.has(modulo.id) ? (
                            <ChevronUp className="h-4 w-4" aria-hidden />
                          ) : (
                            <ChevronDown className="h-4 w-4" aria-hidden />
                          )}
                        </button>
                      )}

                      {(emCurso || expandidos.has(modulo.id)) && (
                        <div id={`notas-${modulo.id}`} className="flex flex-col">
                          <div className="flex flex-col divide-y divide-border">
                            {avaliacoes.map((a) => (
                              <div key={a.id} className="flex items-center justify-between py-2.5 text-body-sm">
                                <span className="text-text-primary">
                                  {a.titulo} <span className="text-text-secondary">· peso {formatarDecimal(a.peso)}</span>
                                </span>
                                <span
                                  className={`font-mono tabular-nums ${a.nota !== null ? "font-semibold text-text-primary" : "text-text-secondary"}`}
                                >
                                  {a.nota !== null ? formatarNota(a.nota) : "—"}
                                </span>
                              </div>
                            ))}
                          </div>
                          {emCurso && (
                            <p className="mt-2 text-body-sm text-text-secondary">
                              Para ser aprovado: média {formatarMedia(matricula.trilhaMediaMinima)} e frequência de{" "}
                              {formatarPercentual(matricula.frequenciaMinimaPercentual)}.{" "}
                              {(() => {
                                const mediaOk =
                                  progresso?.media !== null &&
                                  progresso?.media !== undefined &&
                                  progresso.media >= matricula.trilhaMediaMinima;
                                const freqOk =
                                  progresso?.frequencia !== null &&
                                  progresso?.frequencia !== undefined &&
                                  progresso.frequencia >= matricula.frequenciaMinimaPercentual;
                                if (mediaOk && freqOk) return "Você já atingiu os dois.";
                                if (!mediaOk && !freqOk) return "Você ainda não atingiu nenhum dos dois.";
                                return mediaOk
                                  ? "Você já atingiu a média, falta a frequência."
                                  : "Você já atingiu a frequência, falta a média.";
                              })()}
                            </p>
                          )}
                        </div>
                      )}

                      {matricula?.motivoConclusao && (
                        <p className="text-label text-text-secondary">{matricula.motivoConclusao}</p>
                      )}

                      {matricula?.status === "concluida" &&
                        grupo.certificadosModulo.some((c) => c.modulo_id === modulo.id) && (
                          <Link
                            to="/aluno/certificados"
                            className="text-label font-medium text-primary hover:underline"
                          >
                            Ver certificado deste módulo →
                          </Link>
                        )}

                      {/* Materiais da turma (aluno cursando ou já encerrado):
                          recolhido, para a linha do módulo continuar curta;
                          a lista só é lida ao abrir. */}
                      {matricula && ["matriculada", "concluida", "reprovada"].includes(matricula.status) && (
                        <MateriaisRecolhidos turmaId={matricula.turmaId} turmaCodigo={matricula.turmaCodigo} />
                      )}
                    </div>
                  );
                })}
              </Card>

              {/* Card do certificado da trilha nos modos "trilha inteira" e
                  "módulo e trilha" (o de cada módulo já aparece nas linhas
                  acima). */}
              {grupo.trilha.tipo_certificacao !== "modulo" && (
                <Card className="mt-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Award
                      className={`h-6 w-6 shrink-0 ${trilhaConcluida ? "text-primary" : "text-text-secondary"}`}
                      aria-hidden
                    />
                    <div>
                      <h3 className="text-klass-md font-semibold text-text-primary">Certificado da trilha</h3>
                      <p className="text-body-sm text-text-secondary">
                        {trilhaConcluida
                          ? "Liberado — você concluiu todos os módulos."
                          : `Libera ao concluir os ${totalModulos} módulos (${concluidos} de ${totalModulos})`}
                      </p>
                    </div>
                  </div>
                  {trilhaConcluida && grupo.certificadoTrilha ? (
                    <BotaoBaixarCertificado certificado={grupo.certificadoTrilha} />
                  ) : (
                    // Mesmo botão "Baixar PDF" da tela de referência, no
                    // estilo tracejado/desabilitado enquanto bloqueado.
                    <Button variant="tracejado" disabled>
                      Baixar PDF
                    </Button>
                  )}
                </Card>
              )}
            </section>
          );
        })}
      </div>
    </PaginaAutenticada>
  );
}

// "Materiais da turma" recolhido: a lista (e a leitura no banco) só existe
// depois que o aluno abre.
function MateriaisRecolhidos({ turmaId, turmaCodigo }: { turmaId: string; turmaCodigo: string }) {
  const [aberto, setAberto] = useState(false);
  return (
    <details className="text-body-sm" onToggle={(e) => setAberto(e.currentTarget.open)}>
      <summary className="w-fit cursor-pointer text-label font-medium text-text-secondary hover:text-text-primary">
        Materiais da turma {turmaCodigo}
      </summary>
      <div className="mt-2">{aberto && <MateriaisDaTurma turmaId={turmaId} modo="leitura" />}</div>
    </details>
  );
}
