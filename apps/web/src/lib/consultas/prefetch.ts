import { useCallback } from "react";
import { matchPath } from "react-router-dom";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { Papel } from "@klass/types";
import { useAuth } from "@/auth";
import { opcoesCatalogo } from "./catalogo";
import { opcoesCertificacao } from "./certificacao";
import { opcoesDiario } from "./diario";
import { opcoesIdentidade } from "./identidade";
import { opcoesPainelCoordenacao } from "./painelCoordenacao";
import { opcoesSelecao } from "./selecao";

// Pré-carregamento: ao passar o mouse, focar ou tocar num link, as
// consultas principais da tela de destino já começam — quando o clique
// chega, o dado está no cache (ou a caminho). prefetchQuery respeita o
// staleTime: dado fresco não é buscado de novo.

interface Quem {
  usuarioId: string;
  papel: Papel | undefined;
}

// Prefetch nunca mostra erro: se falhar, a tela de destino tenta de novo
// e aí sim mostra o aviso.
const ignorar = () => undefined;

// Telas pesadas carregadas sob demanda (lazy): o hover também baixa o código.
export const carregarEditarTrilha = () => import("@/pages/coordenacao/EditarTrilha");

function prefetchDiarioDaTurma(qc: QueryClient, turmaId: string) {
  void qc.prefetchQuery(opcoesSelecao.turma(turmaId));
  void qc.prefetchQuery(opcoesDiario.aulas(turmaId));
  void qc
    .fetchQuery(opcoesDiario.avaliacoes(turmaId))
    .then((avaliacoes) =>
      qc.prefetchQuery(opcoesDiario.notas(turmaId, avaliacoes.map((a) => a.id))),
    )
    .catch(ignorar);
  // Alunos e progresso da turma inteira (uma RPC em lote, não três por
  // aluno) e as chamadas pendentes: o que a aba Resumo, padrão, mostra.
  void qc.prefetchQuery(opcoesSelecao.matriculasDaTurma(turmaId));
  void qc.prefetchQuery(opcoesDiario.progressoDaTurma(turmaId));
  void qc.prefetchQuery(opcoesDiario.chamadasPendentesDaTurma(turmaId));
}

function prefetchBoletim(qc: QueryClient, alunoId: string) {
  void qc.prefetchQuery(opcoesCertificacao.doAluno(alunoId));
  void qc
    .fetchQuery(opcoesSelecao.matriculasDoAluno(alunoId))
    .then((matriculas) => {
      for (const trilhaId of new Set(matriculas.map((m) => m.trilhaId).filter(Boolean))) {
        void qc.prefetchQuery(opcoesCatalogo.trilhaPorId(trilhaId));
        void qc.prefetchQuery(opcoesCatalogo.preRequisitosDaTrilha(trilhaId));
      }
      for (const m of matriculas) {
        void qc.prefetchQuery(opcoesDiario.progresso(m.id));
        if (m.status === "matriculada" || m.status === "concluida" || m.status === "reprovada") {
          void qc.prefetchQuery(opcoesDiario.notasDoAluno(m.id, m.turmaId));
        }
      }
    })
    .catch(ignorar);
}

function prefetchInicio(qc: QueryClient, { usuarioId, papel }: Quem) {
  if (papel === "professor") {
    void qc.prefetchQuery(opcoesDiario.aulasDeHoje(usuarioId));
    void qc.prefetchQuery(opcoesDiario.pendenciasDoProfessor(usuarioId));
    void qc.prefetchQuery(opcoesDiario.alunosQuePedemAtencao(usuarioId));
    void qc.prefetchQuery(opcoesDiario.aulasDaSemana(usuarioId));
  } else if (papel === "coordenacao") {
    void qc.prefetchQuery(opcoesPainelCoordenacao.frequencias());
    void qc.prefetchQuery(opcoesPainelCoordenacao.indicadoresDasViews());
    void qc.prefetchQuery(opcoesPainelCoordenacao.pendencias());
    void qc.prefetchQuery(opcoesPainelCoordenacao.inscricoesRecentes());
    void qc.prefetchQuery(opcoesSelecao.turmasDaCoordenacao());
    void qc.prefetchQuery(opcoesCatalogo.trilhas());
  } else {
    void qc.prefetchQuery(opcoesDiario.novidades(usuarioId));
    void qc.prefetchQuery(opcoesDiario.notasDaSemana(usuarioId));
    prefetchBoletim(qc, usuarioId);
  }
}

function prefetchTrilha(qc: QueryClient, slug: string) {
  void qc
    .fetchQuery(opcoesCatalogo.trilhaPorSlug(slug))
    .then((trilha) => {
      if (!trilha) return;
      void qc.prefetchQuery(opcoesCatalogo.preRequisitosDaTrilha(trilha.id));
    })
    .catch(ignorar);
}

/** Dispara as consultas principais da tela em `caminho` (sem esperar). */
export function prefetchCaminho(qc: QueryClient, caminho: string, quem: Quem) {
  const rota = caminho.split("?")[0];
  const { usuarioId } = quem;
  let p;
  if (rota === "/") return prefetchInicio(qc, quem);
  if (rota === "/catalogo") return void qc.prefetchQuery(opcoesCatalogo.trilhasComContagem());
  if ((p = matchPath("/catalogo/:slug/modulos/:moduloId", rota))) {
    const { slug, moduloId } = p.params as { slug: string; moduloId: string };
    void qc.prefetchQuery(opcoesCatalogo.preRequisitosDoModulo(moduloId));
    void qc.prefetchQuery(opcoesSelecao.matriculasDoAluno(usuarioId));
    void qc
      .fetchQuery(opcoesCatalogo.trilhaPorSlug(slug))
      .then((trilha) =>
        trilha ? qc.prefetchQuery(opcoesSelecao.turmasDaTrilha(trilha.id, usuarioId)) : undefined,
      )
      .catch(ignorar);
    return;
  }
  if ((p = matchPath("/catalogo/:slug", rota))) return prefetchTrilha(qc, p.params.slug!);
  if (rota === "/aluno/boletim") return prefetchBoletim(qc, usuarioId);
  if (rota === "/aluno/certificados") return void qc.prefetchQuery(opcoesCertificacao.doAluno(usuarioId));
  if (rota === "/professor/turmas") return void qc.prefetchQuery(opcoesSelecao.turmasDoProfessor(usuarioId));
  if ((p = matchPath("/professor/turmas/:id/aulas/:aulaId/chamada", rota))) {
    void qc.prefetchQuery(opcoesDiario.aula(p.params.aulaId!));
    void qc.prefetchQuery(opcoesDiario.presencas(p.params.aulaId!));
    void qc.prefetchQuery(opcoesSelecao.matriculasDaTurma(p.params.id!));
    return;
  }
  if ((p = matchPath("/professor/turmas/:id", rota))) return prefetchDiarioDaTurma(qc, p.params.id!);
  if (rota === "/coordenacao/turmas") return void qc.prefetchQuery(opcoesSelecao.turmasDaCoordenacao());
  if (rota === "/coordenacao/turmas/nova") {
    void qc.prefetchQuery(opcoesCatalogo.trilhas());
    void qc.prefetchQuery(opcoesIdentidade.professores());
    return;
  }
  if ((p = matchPath("/coordenacao/turmas/:id/editar", rota))) {
    void qc.prefetchQuery(opcoesSelecao.turma(p.params.id!));
    void qc.prefetchQuery(opcoesIdentidade.professores());
    return;
  }
  if ((p = matchPath("/coordenacao/turmas/:id", rota))) return prefetchDiarioDaTurma(qc, p.params.id!);
  if (rota === "/coordenacao/trilhas") return void qc.prefetchQuery(opcoesCatalogo.trilhasComContagem());
  if ((p = matchPath("/coordenacao/trilhas/:slug/editar", rota))) {
    void carregarEditarTrilha().catch(ignorar);
    void qc
      .fetchQuery(opcoesCatalogo.trilhaPorSlug(p.params.slug!))
      .then((trilha) => {
        if (!trilha) return;
        void qc.prefetchQuery(opcoesCatalogo.preRequisitosIdsDaTrilha(trilha.id));
        void qc.prefetchQuery(opcoesCertificacao.trilhaTemCertificados(trilha.id));
      })
      .catch(ignorar);
    return;
  }
  if (rota === "/coordenacao/certificados") return void qc.prefetchQuery(opcoesCertificacao.todos());
  if (rota === "/coordenacao/pessoas") return void qc.prefetchQuery(opcoesIdentidade.pessoas());
  if (rota === "/coordenacao/acompanhamento") {
    void qc.prefetchQuery(opcoesPainelCoordenacao.linhasDasViews());
    void qc.prefetchQuery(opcoesPainelCoordenacao.frequencias());
    void qc.prefetchQuery(opcoesSelecao.turmasDaCoordenacao());
    return;
  }
}

/** Para os links: devolve a função que pré-carrega um caminho. */
export function usePrefetch() {
  const qc = useQueryClient();
  const { usuario, profile } = useAuth();
  const usuarioId = usuario?.id;
  const papel = profile?.papel;
  return useCallback(
    (caminho: string) => {
      if (!usuarioId) return;
      prefetchCaminho(qc, caminho, { usuarioId, papel });
    },
    [qc, usuarioId, papel],
  );
}
