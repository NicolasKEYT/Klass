import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "@/auth";
import { Aviso } from "@/components/Aviso";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Button } from "@/components/Button";
import { Cabecalho } from "@/components/Cabecalho";
import { Card } from "@/components/Card";
import {
  buscarAula,
  buscarPresencasDaAula,
  listarAlunosMatriculados,
  salvarChamadaEmLote,
  type AlunoParaLancamento,
  type Aula,
} from "@/lib/diario";

export function FazerChamada() {
  const { aula_id: aulaId } = useParams<{ id: string; aula_id: string }>();
  const { usuario } = useAuth();
  const [aula, setAula] = useState<Aula | null | undefined>(undefined);
  const [alunos, setAlunos] = useState<AlunoParaLancamento[]>([]);
  const [presencas, setPresencas] = useState<Record<string, boolean>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aulaId) return;
    Promise.all([buscarAula(aulaId), buscarPresencasDaAula(aulaId)])
      .then(async ([dadosAula, presencasExistentes]) => {
        setAula(dadosAula);
        if (!dadosAula) return;
        const listaAlunos = await listarAlunosMatriculados(dadosAula.turma_id);
        setAlunos(listaAlunos);
        const iniciais: Record<string, boolean> = {};
        for (const aluno of listaAlunos) {
          // Sem registro ainda = assume presente; o professor desmarca quem faltou.
          iniciais[aluno.matriculaId] = presencasExistentes.get(aluno.matriculaId) ?? true;
        }
        setPresencas(iniciais);
      })
      .catch((e) => setErro(e instanceof Error ? e.message : "Não foi possível carregar a aula."));
  }, [aulaId]);

  async function aoSalvar() {
    if (!aulaId || !usuario) return;
    setErro(null);
    setMensagem(null);
    setSalvando(true);
    try {
      const lancamentos = alunos.map((aluno) => ({
        matriculaId: aluno.matriculaId,
        presente: presencas[aluno.matriculaId] ?? true,
      }));
      await salvarChamadaEmLote(aulaId, usuario.id, lancamentos);
      setMensagem("Chamada salva.");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar a chamada.");
    } finally {
      setSalvando(false);
    }
  }

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
        {mensagem && (
          <Aviso variant="success" className="mb-4">
            {mensagem}
          </Aviso>
        )}

        {aula === undefined && !erro && (
          <p className="text-body-sm text-text-secondary">Carregando...</p>
        )}
        {aula === null && <p className="text-body-sm text-text-secondary">Aula não encontrada.</p>}

        {aula && (
          <>
            <h1 className="mb-1 font-serif text-klass-xl text-text-primary">
              Chamada — {aula.data}
              {aula.horario ? ` · ${aula.horario}` : ""}
            </h1>
            {aula.descricao && (
              <p className="mb-6 text-body-sm text-text-secondary">{aula.descricao}</p>
            )}

            <Card>
              <div className="flex flex-col gap-3">
                {alunos.length === 0 && (
                  <p className="text-body-sm text-text-secondary">
                    Nenhum aluno matriculado nesta turma ainda.
                  </p>
                )}
                {alunos.map((aluno) => {
                  const presente = presencas[aluno.matriculaId] ?? true;
                  return (
                    <div key={aluno.matriculaId} className="flex items-center justify-between gap-4">
                      <span className="text-body-sm text-text-primary">{aluno.alunoNome}</span>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant={presente ? "primary" : "secondary"}
                          onClick={() =>
                            setPresencas((atual) => ({ ...atual, [aluno.matriculaId]: true }))
                          }
                        >
                          Presente
                        </Button>
                        <Button
                          type="button"
                          variant={!presente ? "primary" : "secondary"}
                          onClick={() =>
                            setPresencas((atual) => ({ ...atual, [aluno.matriculaId]: false }))
                          }
                        >
                          Ausente
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {alunos.length > 0 && (
                <Button className="mt-4" disabled={salvando} onClick={() => void aoSalvar()}>
                  {salvando ? "Salvando..." : "Salvar chamada"}
                </Button>
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
