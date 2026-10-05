import { useEffect, useRef } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { AulaComPresenca, AvaliacaoComNota, NotaLancada } from "@/lib/diario";
import { supabase } from "@/lib/supabase";
import { chaves } from "./chaves";
import { useIdsDePresenca } from "./diario";
import { useMatriculasDoAluno, useTurmasDoProfessor } from "./selecao";

/**
 * Assina o canal e, a cada SUBSCRIBED — a primeira assinatura e cada
 * reconexão —, invalida uma vez as consultas da tela. Cobre a janela entre
 * a carga inicial e a assinatura (e o tempo desconectado): um evento
 * nessa janela não chega por WebSocket, e sem isso a tela ficava com o
 * dado velho (o QA viu uma exclusão não chegar uma vez em quatro).
 */
function assinarComRecarga(canal: RealtimeChannel, aoAssinar: () => void) {
  canal.subscribe((status) => {
    if (status === "SUBSCRIBED") aoAssinar();
  });
}

/**
 * Realtime do aluno (Fluxo 3 do artigo): quando o professor lança nota,
 * faz chamada ou a matrícula muda, o cache é invalidado e qualquer tela
 * aberta (Boletim, Início) se atualiza sozinha, sem recarregar. Vive no
 * layout autenticado, não numa tela: assim o aviso chega mesmo com o
 * aluno em outra tela, e voltar ao Boletim não mostra dado velho do cache.
 */
export function useRealtimeDoAluno(alunoId: string | undefined) {
  const qc = useQueryClient();
  const { data: matriculas } = useMatriculasDoAluno(alunoId);
  const listaMatriculas = (matriculas ?? []).map((m) => m.id);
  const idsMatriculas = listaMatriculas.join(",");
  // turma:matrícula de cada matrícula do aluno — avaliações e aulas são da
  // turma, e o cache do boletim é por matrícula.
  const turmaMatricula = (matriculas ?? []).map((m) => `${m.turmaId}:${m.id}`).join(",");
  // Ids das presenças do aluno: o DELETE de presença chega sem filtro e só
  // com o id; é por eles que se sabe se a exclusão é deste aluno. Lidos
  // por ref para a assinatura não ser refeita a cada chamada.
  const { data: idsDePresenca } = useIdsDePresenca(alunoId, listaMatriculas);
  const idsDePresencaRef = useRef(idsDePresenca);
  idsDePresencaRef.current = idsDePresenca;

  useEffect(() => {
    if (!alunoId || !supabase) return;
    const invalidar = (queryKey: QueryKey) => void qc.invalidateQueries({ queryKey });
    const matriculaIds = idsMatriculas ? idsMatriculas.split(",") : [];
    const matriculasPorTurma = new Map<string, string[]>();
    for (const par of turmaMatricula ? turmaMatricula.split(",") : []) {
      const [turmaId, matriculaId] = par.split(":");
      matriculasPorTurma.set(turmaId, [...(matriculasPorTurma.get(turmaId) ?? []), matriculaId]);
    }
    // Avaliação ou aula criada, alterada ou apagada numa turma do aluno:
    // muda o boletim (avaliações, margem de faltas), a frequência e a média.
    function aoMudarTurma(turmaId: string | undefined) {
      for (const matriculaId of (turmaId && matriculasPorTurma.get(turmaId)) || []) {
        aoMudarDiario(matriculaId);
      }
    }

    function aoMudarDiario(matriculaId: string | undefined) {
      invalidar(chaves.diario.novidades(alunoId!));
      if (matriculaId) {
        invalidar(chaves.diario.progresso(matriculaId));
        invalidar(chaves.diario.matricula(matriculaId));
      } else {
        invalidar(chaves.diario.progressos());
        invalidar(chaves.diario.notasDosAlunos());
      }
    }

    function aoMudarPresenca(matriculaId: string | undefined) {
      aoMudarDiario(matriculaId);
      invalidar(chaves.diario.idsDePresenca(alunoId!, matriculaIds));
    }

    let canal = supabase.channel(`aluno:${alunoId}`).on(
      "postgres_changes",
      { event: "*", schema: "selecao", table: "matriculas", filter: `aluno_id=eq.${alunoId}` },
      () => {
        // Inscrição aprovada/rejeitada/encerrada: Boletim, Início
        // (próximo passo, novidades) e certificados mudam juntos.
        invalidar(chaves.selecao.matriculasDoAluno(alunoId));
        invalidar(chaves.selecao.listas());
        invalidar(["selecao", "pre-requisitos", alunoId]);
        invalidar(chaves.certificacao.doAluno(alunoId));
        invalidar(chaves.diario.progressos());
        invalidar(chaves.diario.notasDosAlunos());
        invalidar(chaves.diario.novidades(alunoId));
      },
    );

    if (idsMatriculas) {
      const filtro = `matricula_id=in.(${idsMatriculas})`;
      canal = canal
        .on("postgres_changes", { event: "*", schema: "diario", table: "notas", filter: filtro }, (payload) =>
          aoMudarDiario((payload.new as { matricula_id?: string }).matricula_id),
        )
        .on("postgres_changes", { event: "*", schema: "diario", table: "presencas", filter: filtro }, (payload) =>
          aoMudarPresenca((payload.new as { matricula_id?: string }).matricula_id),
        )
        // O Realtime não entrega DELETE em assinatura com filtro — a
        // exclusão de uma nota (ex.: professor apagou a avaliação) não
        // chegava. Esta assinatura é sem filtro e o evento traz só o id da
        // nota apagada (sem os demais campos, por causa da RLS); se for uma
        // das notas em cache deste aluno, invalida aquela matrícula.
        .on("postgres_changes", { event: "DELETE", schema: "diario", table: "notas" }, (payload) => {
          const notaId = (payload.old as { id?: string }).id;
          if (!notaId) return;
          const emCache = qc.getQueriesData<AvaliacaoComNota[]>({ queryKey: chaves.diario.notasDosAlunos() });
          for (const [chave, avaliacoes] of emCache) {
            if (avaliacoes?.some((a) => a.notaId === notaId)) aoMudarDiario(chave[2] as string);
          }
        })
        // Mesmo caso para presença (chamada refeita sem o aluno, aula
        // apagada em cascata): confere o id contra as presenças do aluno.
        .on("postgres_changes", { event: "DELETE", schema: "diario", table: "presencas" }, (payload) => {
          const presencaId = (payload.old as { id?: string }).id;
          const matriculaId = presencaId ? idsDePresencaRef.current?.get(presencaId) : undefined;
          if (matriculaId) aoMudarPresenca(matriculaId);
        });
    }

    if (matriculasPorTurma.size > 0) {
      const filtroTurma = `turma_id=in.(${[...matriculasPorTurma.keys()].join(",")})`;
      canal = canal
        // INSERT/UPDATE com filtro pelas turmas do aluno (a RLS de SELECT de
        // avaliações/aulas também só entrega as turmas em que ele cursa).
        .on("postgres_changes", { event: "INSERT", schema: "diario", table: "avaliacoes", filter: filtroTurma }, (payload) =>
          aoMudarTurma((payload.new as { turma_id?: string }).turma_id),
        )
        .on("postgres_changes", { event: "UPDATE", schema: "diario", table: "avaliacoes", filter: filtroTurma }, (payload) =>
          aoMudarTurma((payload.new as { turma_id?: string }).turma_id),
        )
        .on("postgres_changes", { event: "INSERT", schema: "diario", table: "aulas", filter: filtroTurma }, (payload) =>
          aoMudarTurma((payload.new as { turma_id?: string }).turma_id),
        )
        .on("postgres_changes", { event: "UPDATE", schema: "diario", table: "aulas", filter: filtroTurma }, (payload) =>
          aoMudarTurma((payload.new as { turma_id?: string }).turma_id),
        )
        // DELETE chega sem filtro e só com o id: confere contra as
        // avaliações/aulas que o boletim deste aluno tem em cache.
        .on("postgres_changes", { event: "DELETE", schema: "diario", table: "avaliacoes" }, (payload) => {
          const avaliacaoId = (payload.old as { id?: string }).id;
          if (!avaliacaoId) return;
          const emCache = qc.getQueriesData<AvaliacaoComNota[]>({ queryKey: chaves.diario.notasDosAlunos() });
          for (const [chave, avaliacoes] of emCache) {
            if (avaliacoes?.some((a) => a.id === avaliacaoId)) aoMudarDiario(chave[2] as string);
          }
        })
        .on("postgres_changes", { event: "DELETE", schema: "diario", table: "aulas" }, (payload) => {
          const aulaId = (payload.old as { id?: string }).id;
          if (!aulaId) return;
          const emCache = qc.getQueriesData<AulaComPresenca[]>({ queryKey: chaves.diario.notasDosAlunos() });
          for (const [chave, aulas] of emCache) {
            if (Array.isArray(aulas) && aulas.some((a) => a.id === aulaId)) aoMudarDiario(chave[2] as string);
          }
        });
    }

    assinarComRecarga(canal, () => {
      invalidar(chaves.selecao.matriculasDoAluno(alunoId));
      invalidar(chaves.certificacao.doAluno(alunoId));
      invalidar(chaves.diario.progressos());
      invalidar(chaves.diario.notasDosAlunos());
      invalidar(chaves.diario.novidades(alunoId));
      invalidar(chaves.diario.idsDePresenca(alunoId, matriculaIds));
    });
    return () => {
      void supabase?.removeChannel(canal);
    };
  }, [alunoId, idsMatriculas, turmaMatricula, qc]);
}

/**
 * Realtime da turma aberta pelo professor: notas lançadas por outra sessão
 * (a coordenação, ou o professor em outro aparelho) entram na grade sem
 * recarregar. A grade não sobrescreve a célula em edição (ver GradeNotas);
 * aqui só se invalida o cache.
 */
export function useRealtimeDaTurma(turmaId: string | undefined, avaliacaoIds: string[]) {
  const qc = useQueryClient();
  const idsAvaliacoes = avaliacaoIds.join(",");

  useEffect(() => {
    if (!turmaId || !supabase) return;
    const invalidar = (queryKey: QueryKey) => void qc.invalidateQueries({ queryKey });
    const ids = idsAvaliacoes ? idsAvaliacoes.split(",") : [];

    function aoMudarNota(matriculaId: string | undefined) {
      invalidar(chaves.diario.notas(turmaId!, ids));
      invalidar(matriculaId ? chaves.diario.progresso(matriculaId) : chaves.diario.progressos());
      invalidar(chaves.diario.progressoDaTurma(turmaId!));
      invalidar(chaves.diario.paineisDeProfessor());
    }

    let canal = supabase.channel(`turma:${turmaId}`).on(
      "postgres_changes",
      { event: "*", schema: "selecao", table: "matriculas", filter: `turma_id=eq.${turmaId}` },
      () => {
        invalidar(chaves.selecao.matriculasDaTurma(turmaId));
        invalidar(chaves.diario.progressos());
      },
    );
    if (idsAvaliacoes) {
      canal = canal
        .on(
          "postgres_changes",
          { event: "*", schema: "diario", table: "notas", filter: `avaliacao_id=in.(${idsAvaliacoes})` },
          (payload) => aoMudarNota((payload.new as { matricula_id?: string }).matricula_id),
        )
        // DELETE sem filtro (ver useRealtimeDoAluno): confere o id da nota
        // contra as notas da grade em cache.
        .on("postgres_changes", { event: "DELETE", schema: "diario", table: "notas" }, (payload) => {
          const notaId = (payload.old as { id?: string }).id;
          if (!notaId) return;
          const notas = qc.getQueryData<NotaLancada[]>(chaves.diario.notas(turmaId, ids));
          const nota = notas?.find((n) => n.id === notaId);
          if (nota) aoMudarNota(nota.matriculaId);
        });
    }

    // Avaliação ou aula criada/alterada/apagada por outra sessão (outro
    // aparelho, a coordenação): a turma inteira relê o diário.
    function aoMudarDiarioDaTurma() {
      invalidar(chaves.diario.turma(turmaId!));
      invalidar(chaves.diario.progressoDaTurma(turmaId!));
      invalidar(chaves.diario.paineisDeProfessor());
    }
    for (const tabela of ["avaliacoes", "aulas"] as const) {
      canal = canal
        .on("postgres_changes", { event: "INSERT", schema: "diario", table: tabela, filter: `turma_id=eq.${turmaId}` }, aoMudarDiarioDaTurma)
        .on("postgres_changes", { event: "UPDATE", schema: "diario", table: tabela, filter: `turma_id=eq.${turmaId}` }, aoMudarDiarioDaTurma)
        .on("postgres_changes", { event: "DELETE", schema: "diario", table: tabela }, (payload) => {
          const id = (payload.old as { id?: string }).id;
          const chave = tabela === "avaliacoes" ? chaves.diario.avaliacoes(turmaId) : chaves.diario.aulas(turmaId);
          const linhas = qc.getQueryData<Array<{ id: string }>>(chave);
          if (id && linhas?.some((l) => l.id === id)) aoMudarDiarioDaTurma();
        });
    }

    assinarComRecarga(canal, () => {
      invalidar(chaves.diario.turma(turmaId));
      invalidar(chaves.selecao.matriculasDaTurma(turmaId));
      invalidar(chaves.diario.progressos());
    });
    return () => {
      void supabase?.removeChannel(canal);
    };
  }, [turmaId, idsAvaliacoes, qc]);
}

/**
 * Realtime do "Hoje" do professor: avaliação ou aula criada, alterada ou
 * apagada em qualquer turma dele (por ele em outro aparelho ou pela
 * coordenação) atualiza aulas de hoje, semana, pendências e alunos que
 * pedem atenção sem recarregar. Vive no layout, como o do aluno.
 */
export function useRealtimeDoProfessor(professorId: string | undefined) {
  const qc = useQueryClient();
  const { data: turmas } = useTurmasDoProfessor(professorId);
  const idsTurmas = (turmas ?? []).map((t) => t.id).join(",");

  useEffect(() => {
    if (!professorId || !idsTurmas || !supabase) return;
    const ids = idsTurmas.split(",");
    const invalidarPainel = () => {
      void qc.invalidateQueries({ queryKey: chaves.diario.paineisDeProfessor() });
      void qc.invalidateQueries({ queryKey: ["diario", "progresso", "turma"] });
    };
    let canal = supabase.channel(`professor:${professorId}`);
    for (const tabela of ["avaliacoes", "aulas"] as const) {
      canal = canal
        .on("postgres_changes", { event: "INSERT", schema: "diario", table: tabela, filter: `turma_id=in.(${idsTurmas})` }, invalidarPainel)
        .on("postgres_changes", { event: "UPDATE", schema: "diario", table: tabela, filter: `turma_id=in.(${idsTurmas})` }, invalidarPainel)
        // DELETE sem filtro: só o id. Confere contra o que está em cache das
        // turmas do professor; sem cache, o painel relê de qualquer forma.
        .on("postgres_changes", { event: "DELETE", schema: "diario", table: tabela }, (payload) => {
          const id = (payload.old as { id?: string }).id;
          if (!id) return;
          const emCache = ids.flatMap(
            (turmaId) =>
              qc.getQueryData<Array<{ id: string }>>(
                tabela === "avaliacoes" ? chaves.diario.avaliacoes(turmaId) : chaves.diario.aulas(turmaId),
              ) ?? [],
          );
          if (emCache.length === 0 || emCache.some((l) => l.id === id)) invalidarPainel();
        });
    }
    assinarComRecarga(canal, invalidarPainel);
    return () => {
      void supabase?.removeChannel(canal);
    };
  }, [professorId, idsTurmas, qc]);
}
