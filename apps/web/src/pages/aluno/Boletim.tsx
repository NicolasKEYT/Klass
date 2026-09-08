import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Aviso } from "@/components/Aviso";
import { Badge } from "@/components/Badge";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Cabecalho } from "@/components/Cabecalho";
import { Card } from "@/components/Card";
import {
  buscarProgressoMatricula,
  listarAulasComPresencaDoAluno,
  listarAvaliacoesComNotaDoAluno,
  type AulaComPresenca,
  type AvaliacaoComNota,
} from "@/lib/diario";
import { buscarMatriculaDetalhada, type MatriculaDetalhada } from "@/lib/selecao";
import { supabase } from "@/lib/supabase";
import type { StatusMatricula } from "@klass/types";

const STATUS_LABEL: Record<StatusMatricula, string> = {
  inscrita: "Inscrição em análise",
  matriculada: "Cursando",
  rejeitada: "Rejeitada",
  cancelada: "Cancelada",
  concluida: "Aprovado(a)",
  reprovada: "Reprovado(a)",
};

export function Boletim() {
  const { id } = useParams<{ id: string }>();
  const [matricula, setMatricula] = useState<MatriculaDetalhada | null | undefined>(undefined);
  const [avaliacoes, setAvaliacoes] = useState<AvaliacaoComNota[]>([]);
  const [aulas, setAulas] = useState<AulaComPresenca[]>([]);
  const [media, setMedia] = useState<number | null>(null);
  const [frequencia, setFrequencia] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    if (!id) return;
    try {
      const dadosMatricula = await buscarMatriculaDetalhada(id);
      setMatricula(dadosMatricula);
      if (!dadosMatricula) return;
      const [listaAvaliacoes, listaAulas, progresso] = await Promise.all([
        listarAvaliacoesComNotaDoAluno(id, dadosMatricula.turmaId),
        listarAulasComPresencaDoAluno(id, dadosMatricula.turmaId),
        buscarProgressoMatricula(id),
      ]);
      setAvaliacoes(listaAvaliacoes);
      setAulas(listaAulas);
      setMedia(progresso.media);
      setFrequencia(progresso.frequencia);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar o boletim.");
    }
  }

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Realtime — quando o professor lança nota, faz chamada ou encerra o
  // módulo, esta tela atualiza sozinha, sem o aluno precisar recarregar
  // (Fluxo 3 do artigo do TCC 1).
  useEffect(() => {
    if (!id || !supabase) return;
    const canal = supabase
      .channel(`matricula:${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "diario", table: "notas", filter: `matricula_id=eq.${id}` },
        () => void carregar(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "diario", table: "presencas", filter: `matricula_id=eq.${id}` },
        () => void carregar(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "selecao", table: "matriculas", filter: `id=eq.${id}` },
        () => void carregar(),
      )
      .subscribe();

    return () => {
      void supabase?.removeChannel(canal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <div className="min-h-screen bg-background">
      <Cabecalho />
      <div className="mx-auto max-w-2xl p-6">
        <BotaoVoltar />

        {erro && (
          <Aviso variant="danger" className="mb-4">
            {erro}
          </Aviso>
        )}

        {matricula === undefined && !erro && (
          <p className="text-body-sm text-text-secondary">Carregando...</p>
        )}
        {matricula === null && (
          <p className="text-body-sm text-text-secondary">Matrícula não encontrada.</p>
        )}

        {matricula && (
          <>
            <Card className="mb-6">
              <div className="flex items-center gap-2">
                <h1 className="font-serif text-klass-xl text-text-primary">{matricula.moduloNome}</h1>
                <Badge
                  variant={
                    matricula.status === "reprovada"
                      ? "danger"
                      : matricula.status === "concluida"
                        ? "success"
                        : "neutral"
                  }
                >
                  {STATUS_LABEL[matricula.status]}
                </Badge>
              </div>
              <p className="mt-1 text-body-sm text-text-secondary">
                {matricula.trilhaNome} · {matricula.professorNome}
              </p>
              <p className="mt-2 text-label text-text-muted">
                Turma {matricula.turmaCodigo} · {matricula.periodoInicio} a {matricula.periodoFim}
              </p>
              {matricula.motivoConclusao && (
                <p className="mt-3 text-body-sm text-text-secondary">{matricula.motivoConclusao}</p>
              )}
            </Card>

            <h2 className="mb-3 font-serif text-klass-lg text-text-primary">
              Notas {media !== null && `— média parcial ${media.toFixed(1)}`}
            </h2>
            <div className="mb-6 flex flex-col gap-2">
              {avaliacoes.length === 0 && (
                <p className="text-body-sm text-text-secondary">
                  Nenhuma avaliação cadastrada ainda.
                </p>
              )}
              {avaliacoes.map((avaliacao) => (
                <Card key={avaliacao.id} className="flex items-center justify-between">
                  <span className="text-body-sm text-text-primary">{avaliacao.titulo}</span>
                  <span className="text-body-sm font-medium text-text-primary">
                    {avaliacao.nota !== null ? avaliacao.nota.toFixed(1) : "Pendente"}
                  </span>
                </Card>
              ))}
            </div>

            <h2 className="mb-3 font-serif text-klass-lg text-text-primary">
              Frequência {frequencia !== null && `— ${frequencia.toFixed(0)}%`}
            </h2>
            <div className="flex flex-col gap-2">
              {aulas.length === 0 && (
                <p className="text-body-sm text-text-secondary">Nenhuma aula cadastrada ainda.</p>
              )}
              {aulas.map((aula) => (
                <Card key={aula.id} className="flex items-center justify-between">
                  <span className="text-body-sm text-text-primary">
                    {aula.data}
                    {aula.horario ? ` · ${aula.horario}` : ""}
                  </span>
                  <Badge variant={aula.presente === null ? "neutral" : aula.presente ? "success" : "danger"}>
                    {aula.presente === null ? "Chamada não feita" : aula.presente ? "Presente" : "Ausente"}
                  </Badge>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
