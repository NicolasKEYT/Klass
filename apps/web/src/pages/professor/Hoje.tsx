import { useAuth } from "@/auth";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EsqueletoLinhas } from "@/components/Esqueleto";
import { ErroConsulta } from "@/components/ErroConsulta";
import { LinkComPrefetch } from "@/components/LinkComPrefetch";
import { StatusBadge } from "@/components/StatusBadge";
import { Titulo } from "@/components/Titulo";
import {
  useAlunosQuePedemAtencao,
  useAulasDeHoje,
  usePendenciasDoProfessor,
} from "@/lib/consultas/diario";
import { plural } from "@/lib/plural";

function dataPorExtenso(): string {
  const texto = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

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
  const aulas = consultaAulas.data;
  const pendencias = consultaPendencias.data;
  const alunosAtencao = consultaAtencao.data;

  return (
    <>
      <p className="text-body-sm text-text-secondary">{dataPorExtenso()}</p>
      <Titulo className="mb-6">Hoje</Titulo>

      {/* Duas colunas — esquerda mais larga (aulas do dia), direita mais
          estreita (pendências, depois alunos que pedem atenção), medido
          por proporção na tela de referência. */}
      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-klass-md font-medium text-text-primary">
              Aulas de hoje {aulas && `(${aulas.length})`}
            </p>
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
              <div key={aula.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-klass-md tabular-nums text-text-primary">
                    {aula.horario ?? "—"}
                  </span>
                  <div>
                    <p className="text-body-sm font-medium text-text-primary">
                      {aula.turmaCodigo} · {aula.moduloNome}
                    </p>
                    <p className="text-label text-text-muted">{plural(aula.totalAlunos, "aluno", "alunos")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge
                    tipo="aula"
                    status={aula.chamadaFeita ? "chamada_feita" : "chamada_pendente"}
                  />
                  <LinkComPrefetch to={`/professor/turmas/${aula.turmaId}/aulas/${aula.id}/chamada`}>
                    <Button variant={aula.chamadaFeita ? "secondary" : "primary"}>
                      {aula.chamadaFeita ? "Ver" : "Fazer chamada"}
                    </Button>
                  </LinkComPrefetch>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <p className="mb-3 text-klass-md font-medium text-text-primary">
              Pendências {pendencias && `(${pendencias.length})`}
            </p>
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
                  <div>
                    <p className="text-body-sm font-medium text-text-primary">{p.titulo}</p>
                    <p className="text-label text-text-muted">{p.detalhe}</p>
                  </div>
                  <LinkComPrefetch
                    to={
                      p.tipo === "chamada_atrasada"
                        ? `/professor/turmas/${p.turmaId}/aulas/${p.aulaId}/chamada`
                        : p.tipo === "turma_terminando"
                          ? // "Encerrar turma" fica na aba Alunos.
                            `/professor/turmas/${p.turmaId}?aba=alunos`
                          : `/professor/turmas/${p.turmaId}`
                    }
                  >
                    <Button variant="secondary">
                      {p.tipo === "avaliacao_sem_nota"
                        ? "Lançar notas"
                        : p.tipo === "chamada_atrasada"
                          ? "Fazer chamada"
                          : "Revisar"}
                    </Button>
                  </LinkComPrefetch>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <p className="mb-1 text-klass-md font-medium text-text-primary">Alunos que pedem atenção</p>
            <p className="mb-3 text-label text-text-muted">
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
                  <div>
                    <p className="text-body-sm font-medium text-text-primary">{a.alunoNome}</p>
                    <p className="text-label text-text-muted">
                      {a.turmaCodigo} · {a.motivo}
                    </p>
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
    </>
  );
}
