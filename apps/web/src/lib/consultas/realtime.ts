import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { AvaliacaoComNota } from "@/lib/diario";
import { supabase } from "@/lib/supabase";
import { chaves } from "./chaves";
import { useMatriculasDoAluno } from "./selecao";

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
  const idsMatriculas = (matriculas ?? []).map((m) => m.id).join(",");

  useEffect(() => {
    if (!alunoId || !supabase) return;
    const invalidar = (queryKey: readonly unknown[]) => void qc.invalidateQueries({ queryKey });

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

    let canal = supabase.channel(`aluno:${alunoId}`).on(
      "postgres_changes",
      { event: "*", schema: "selecao", table: "matriculas", filter: `aluno_id=eq.${alunoId}` },
      () => {
        invalidar(chaves.selecao.matriculasDoAluno(alunoId));
        invalidar(chaves.selecao.listas());
        invalidar(chaves.certificacao.doAluno(alunoId));
        invalidar(chaves.diario.progressos());
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
          aoMudarDiario((payload.new as { matricula_id?: string }).matricula_id),
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
        });
    }

    canal.subscribe();
    return () => {
      void supabase?.removeChannel(canal);
    };
  }, [alunoId, idsMatriculas, qc]);
}
