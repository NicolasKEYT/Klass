import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "@/auth";
import { Aviso } from "@/components/Aviso";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { PaginaAutenticada } from "@/components/PaginaAutenticada";
import { Titulo } from "@/components/Titulo";
import {
  buscarAvaliacao,
  buscarNotasDaAvaliacao,
  listarAlunosMatriculados,
  salvarNotasEmLote,
  type AlunoParaLancamento,
  type Avaliacao,
} from "@/lib/diario";

export function LancarNotas() {
  const { avaliacao_id: avaliacaoId } = useParams<{ id: string; avaliacao_id: string }>();
  const { usuario } = useAuth();
  const [avaliacao, setAvaliacao] = useState<Avaliacao | null | undefined>(undefined);
  const [alunos, setAlunos] = useState<AlunoParaLancamento[]>([]);
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!avaliacaoId) return;
    Promise.all([
      buscarAvaliacao(avaliacaoId),
      buscarNotasDaAvaliacao(avaliacaoId),
    ])
      .then(async ([dadosAvaliacao, notasExistentes]) => {
        setAvaliacao(dadosAvaliacao);
        if (!dadosAvaliacao) return;
        const listaAlunos = await listarAlunosMatriculados(dadosAvaliacao.turma_id);
        setAlunos(listaAlunos);
        const iniciais: Record<string, string> = {};
        for (const aluno of listaAlunos) {
          const valor = notasExistentes.get(aluno.matriculaId);
          if (valor !== undefined) iniciais[aluno.matriculaId] = String(valor);
        }
        setNotas(iniciais);
      })
      .catch((e) => setErro(e instanceof Error ? e.message : "Não foi possível carregar a avaliação."));
  }, [avaliacaoId]);

  async function aoSalvar() {
    if (!avaliacaoId || !usuario) return;
    setErro(null);
    setMensagem(null);
    setSalvando(true);
    try {
      const lancamentos = Object.entries(notas)
        .filter(([, valor]) => valor.trim() !== "")
        .map(([matriculaId, valor]) => ({ matriculaId, valor: Number(valor.replace(",", ".")) }));
      await salvarNotasEmLote(avaliacaoId, usuario.id, lancamentos);
      setMensagem("Notas salvas.");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar as notas.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <PaginaAutenticada largura="estreita">
        <BotaoVoltar />

        {erro && (
          <Aviso variant="danger" className="mb-4">
            {erro}
          </Aviso>
        )}
        {mensagem && (
          <Aviso variant="success" className="mb-4">
            {mensagem}
          </Aviso>
        )}

        {avaliacao === undefined && !erro && (
          <p className="text-body-sm text-text-secondary">Carregando...</p>
        )}
        {avaliacao === null && (
          <p className="text-body-sm text-text-secondary">Avaliação não encontrada.</p>
        )}

        {avaliacao && (
          <>
            <Titulo className="mb-1">{avaliacao.titulo}</Titulo>
            <p className="mb-6 text-body-sm text-text-secondary">Peso {avaliacao.peso}</p>

            <Card>
              <div className="flex flex-col gap-3">
                {alunos.length === 0 && (
                  <p className="text-body-sm text-text-secondary">
                    Nenhum aluno matriculado nesta turma ainda.
                  </p>
                )}
                {alunos.map((aluno) => (
                  <div key={aluno.matriculaId} className="flex items-center justify-between gap-4">
                    <span className="text-body-sm text-text-primary">{aluno.alunoNome}</span>
                    <Input
                      type="number"
                      min={0}
                      max={10}
                      step={0.1}
                      className="w-24"
                      placeholder="0–10"
                      value={notas[aluno.matriculaId] ?? ""}
                      onChange={(e) =>
                        setNotas((atual) => ({ ...atual, [aluno.matriculaId]: e.target.value }))
                      }
                    />
                  </div>
                ))}
              </div>

              {alunos.length > 0 && (
                <Button
                  className="mt-4"
                  disabled={salvando}
                  onClick={() => void aoSalvar()}
                >
                  {salvando ? "Salvando..." : "Salvar todas as notas"}
                </Button>
              )}
            </Card>
          </>
        )}
    </PaginaAutenticada>
  );
}
