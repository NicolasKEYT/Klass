import { codigoComTurno } from "@/lib/selecao";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { Check, CircleAlert, X } from "lucide-react";
import { useAuth } from "@/auth";
import { Aviso } from "@/components/Aviso";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Esqueleto, EsqueletoCards, RegiaoCarregando } from "@/components/Esqueleto";
import { ErroConsulta } from "@/components/ErroConsulta";
import { PaginaAutenticada } from "@/components/PaginaAutenticada";
import { SituacaoDaChamada, professorPodeFazerChamada } from "@/components/diario/SituacaoDaChamada";
import { chaves } from "@/lib/consultas/chaves";
import { useAula, useAulasDaTurma, usePresencasDaAula } from "@/lib/consultas/diario";
import { useGravacao } from "@/lib/consultas/gravacao";
import { invalidar } from "@/lib/consultas/invalidar";
import { useMatriculasDaTurma, useTurma } from "@/lib/consultas/selecao";
import { formatarData, formatarDiaSemanaData, formatarHora } from "@/lib/formato";
import { filtrarAlunosMatriculados, salvarChamadaEmLote } from "@/lib/diario";

// D5 (klass-uikit.pdf) — chamada pensada primeiro para celular. Todos
// começam "presente" por padrão (74% dos professores usam celular em
// sala, e o padrão observado no mercado é "marca falta", não "marca
// presença" — menos toques no caso comum). O alvo de toque do botão
// (48px, D2) fica afastado do nome para evitar toque errado.
export function FazerChamada() {
  const { id: turmaId, aula_id: aulaId } = useParams<{ id: string; aula_id: string }>();
  const { usuario } = useAuth();
  const gravar = useGravacao();
  // Aula, presenças e alunos saem juntos: a turma vem do endereço (e é
  // conferida com a da aula assim que ela chega).
  const consultaAula = useAula(aulaId);
  const aula = consultaAula.data;
  const consultaPresencas = usePresencasDaAula(aulaId);
  const consultaMatriculas = useMatriculasDaTurma(aula?.turma_id ?? turmaId);
  const alunos = consultaMatriculas.data ? filtrarAlunosMatriculados(consultaMatriculas.data) : undefined;
  // Só para o cabeçalho (pág. 8): número da aula na turma e código da turma.
  // As duas leituras já estão em cache quando se vem da turma.
  const consultaAulas = useAulasDaTurma(aula?.turma_id ?? turmaId);
  const consultaTurma = useTurma(aula?.turma_id ?? turmaId);
  // Só o que o professor mexeu e ainda não salvou; o resto vem do banco.
  const [marcadas, setMarcadas] = useState<Record<string, boolean>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Sem registro ainda = assume presente; o professor toca em quem faltou.
  const presencaSalva = (matriculaId: string) => consultaPresencas.data?.get(matriculaId) ?? true;
  const estaPresente = (matriculaId: string) => marcadas[matriculaId] ?? presencaSalva(matriculaId);
  const alteracoesNaoSalvas = Object.entries(marcadas).some(([m, v]) => v !== presencaSalva(m));
  const listaAlunos = alunos ?? [];
  const totalPresentes = listaAlunos.filter((a) => estaPresente(a.matriculaId)).length;
  const totalFaltas = listaAlunos.length - totalPresentes;
  const consultas = [consultaAula, consultaPresencas, consultaMatriculas];
  const erroDeLeitura = consultas.find((c) => c.isError)?.error ?? null;
  const carregandoLista = !alunos || consultaPresencas.isPending;
  // Prazo da chamada (decidido pelo banco, que também recusa a gravação):
  // fora do prazo ou em aula futura, a tela vira só consulta.
  const podeEditar = !!aula && professorPodeFazerChamada(aula);
  // Só consulta e nenhuma presença registrada: a chamada não foi feita. Não
  // mostrar contadores nem lista (o "todos presentes" vale só para quem
  // está fazendo a chamada).
  const chamadaNaoFeita = !podeEditar && consultaPresencas.data?.size === 0;

  async function aoSalvar() {
    if (!aulaId || !usuario) return;
    setErro(null);
    setSalvando(true);
    try {
      const lancamentos = listaAlunos.map((aluno) => ({
        matriculaId: aluno.matriculaId,
        presente: estaPresente(aluno.matriculaId),
      }));
      await gravar(
        () => salvarChamadaEmLote(aulaId, usuario.id, lancamentos),
        async (qc) => {
          qc.setQueryData(
            chaves.diario.presencas(aulaId),
            new Map(lancamentos.map((l) => [l.matriculaId, l.presente])),
          );
          setMarcadas({});
          await invalidar.chamada(qc, aulaId);
        },
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar a chamada.");
    } finally {
      setSalvando(false);
    }
  }

  // "Aula N" = posição da aula na ordem de data/horário da turma.
  const numeroDaAula = aula && consultaAulas.data ? consultaAulas.data.findIndex((a) => a.id === aula.id) + 1 : 0;

  return (
    <PaginaAutenticada
      largura="media"
      className="pb-44 md:pb-8"
      voltar={{ seSemHistorico: `/professor/turmas/${turmaId}?aba=aulas` }}
      titulo={aula ? (numeroDaAula > 0 ? `Chamada · Aula ${numeroDaAula}` : "Chamada") : "Chamada"}
      subtitulo={
        aula
          ? [
              consultaTurma.data ? codigoComTurno(consultaTurma.data.codigo, consultaTurma.data.turno) : null,
              formatarDiaSemanaData(aula.data),
              aula.horario ? formatarHora(aula.horario) : null,
              // pág. 8: "Aula 12 · Sala 3".
              aula.sala,
            ]
              .filter(Boolean)
              .join(" · ")
          : undefined
      }
    >

      {erro && (
        <Aviso variant="danger" className="mb-4">
          {erro}
        </Aviso>
      )}

      {erroDeLeitura && (
        <ErroConsulta
          className="mb-4"
          erro={erroDeLeitura}
          padrao="Não foi possível carregar a aula."
          tentarDeNovo={() => consultas.forEach((c) => c.isError && void c.refetch())}
        />
      )}
      {consultaAula.isPending && !erroDeLeitura && (
        <RegiaoCarregando className="mb-4 flex flex-col gap-3">
          <Esqueleto className="h-8 w-64" />
          <div className="grid grid-cols-2 gap-3">
            <Esqueleto className="h-20 rounded-klass-card" />
            <Esqueleto className="h-20 rounded-klass-card" />
          </div>
        </RegiaoCarregando>
      )}
      {aula === null && <p className="text-body-sm text-text-secondary">Aula não encontrada.</p>}

      {aula && (
        <>
          {aula.descricao && (
            <p className="mb-4 text-body-sm text-text-secondary">{aula.descricao}</p>
          )}

          <div className="mb-4 flex flex-col gap-2">
            <div>
              <SituacaoDaChamada aula={aula} />
            </div>
            {aula.situacao_chamada === "futura" && (
              <p className="text-body-sm text-text-secondary">
                A chamada desta aula abre no dia da aula ({formatarData(aula.data)}).
              </p>
            )}
            {aula.situacao_chamada === "encerrada" && (
              <p className="text-body-sm text-text-secondary">
                O prazo para fazer ou alterar esta chamada terminou em{" "}
                {formatarData(aula.chamada_aberta_ate)} (7 dias após a aula). A chamada fica só para
                consulta; para alterá-la, peça à coordenação para liberar a chamada desta aula.
              </p>
            )}
          </div>

          {/* Contagem no topo (D5) — fundo neutro sutil, não card branco
              com borda (comparado por pixel com a tela "Chamada · Aula 7"). */}
          {!chamadaNaoFeita && (
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-klass-card bg-neutral-subtle px-4 py-3">
              <p className="font-mono text-klass-2xl font-semibold tabular-nums text-text-primary">
                {totalPresentes}
              </p>
              <p className="text-body-sm text-text-primary">presentes</p>
            </div>
            <div className="rounded-klass-card bg-neutral-subtle px-4 py-3">
              <p className="font-mono text-klass-2xl font-semibold tabular-nums text-text-primary">
                {totalFaltas}
              </p>
              <p className="text-body-sm text-text-primary">faltas</p>
            </div>
          </div>
          )}

          {podeEditar && (
            <p className="mb-3 text-body-sm text-text-secondary">
              Todos começam presentes. Toque em <strong>Falta</strong> para quem não veio.
            </p>
          )}

          {carregandoLista && !erroDeLeitura && <EsqueletoCards quantidade={4} altura="h-16" />}
          {/* Só consulta e nenhuma presença registrada: não mostrar todos como
              "presentes" (o padrão vale só para quem está fazendo a chamada). */}
          {chamadaNaoFeita && !carregandoLista && (
            <p className="text-body-sm text-text-secondary">A chamada desta aula não foi feita.</p>
          )}
          {!carregandoLista && !chamadaNaoFeita && (
          <div className="flex flex-col divide-y divide-border rounded-klass-card border border-border bg-surface">
            {listaAlunos.length === 0 && (
              <p className="px-4 py-4 text-body-sm text-text-secondary">
                Nenhum aluno matriculado nesta turma ainda.
              </p>
            )}
            {listaAlunos.map((aluno) => {
              const presente = estaPresente(aluno.matriculaId);
              return (
                // D2 — linha de lista no celular: 64px de altura mínima.
                // Avatar + nome à esquerda, controle à direita, largura
                // total do card (comparado por pixel com a tela "Chamada").
                <div
                  key={aluno.matriculaId}
                  // pág. 8: quem está com "Falta" ganha fundo levemente
                  // destacado — reforço, não o único sinal (o controle
                  // segmentado já mostra o estado em texto e ícone).
                  className={`flex min-h-16 items-center justify-between gap-3 px-4 py-3 ${presente ? "" : "bg-neutral-subtle"}`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar nome={aluno.alunoNome} />
                    {/* Sem truncar (pág. 8): nome longo quebra em duas linhas. */}
                    <span className="break-words text-body-sm font-medium text-text-primary">
                      {aluno.alunoNome}
                    </span>
                  </div>
                  {/* D5 — controle segmentado único (não dois botões soltos):
                      as duas opções coladas, sem espaço entre elas. Preto
                      sólido só na opção ativa, seja qual for — a cor não
                      distingue presença de falta, só o texto/ícone. */}
                  <div className="flex shrink-0 overflow-hidden rounded-klass-control border border-border">
                    <button
                      type="button"
                      disabled={!podeEditar}
                      aria-pressed={presente}
                      onClick={() =>
                        setMarcadas((atual) => ({ ...atual, [aluno.matriculaId]: true }))
                      }
                      className={`flex h-12 items-center gap-1.5 px-4 text-klass-md font-medium transition ${
                        presente ? "bg-text-primary text-primary-contraste" : "bg-surface text-text-muted"
                      }`}
                    >
                      <Check className="h-4 w-4" aria-hidden />P
                    </button>
                    <button
                      type="button"
                      disabled={!podeEditar}
                      aria-pressed={!presente}
                      onClick={() =>
                        setMarcadas((atual) => ({ ...atual, [aluno.matriculaId]: false }))
                      }
                      className={`flex h-12 items-center gap-1.5 border-l border-border px-4 text-klass-md font-medium transition ${
                        !presente ? "bg-text-primary text-primary-contraste" : "bg-surface text-text-muted"
                      }`}
                    >
                      <X className="h-4 w-4" aria-hidden />
                      Falta
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          )}

          {podeEditar && !carregandoLista && listaAlunos.length > 0 && (
            // bottom-16 no celular: sem isso, o botão fixo ficava atrás da
            // barra inferior de navegação (também fixed, com z-index maior)
            // — ambas na mesma faixa de 64px, então o botão sumia visualmente
            // por trás da barra. No desktop não há barra inferior, então
            // md:bottom-0 (e md:sticky, sem barra nenhuma sobrepondo).
            <div className="fixed inset-x-0 bottom-16 z-20 border-t border-border bg-surface p-4 md:sticky md:bottom-0">
              {/* pág. 8: aviso de alterações acima do botão, que ocupa a largura toda. */}
              <div className="mx-auto flex max-w-3xl flex-col gap-2">
                {alteracoesNaoSalvas && (
                  <span className="flex items-center gap-2 text-body-sm font-medium text-text-primary" role="status">
                    <CircleAlert className="h-4 w-4" aria-hidden />
                    Alterações ainda não salvas
                  </span>
                )}
                <Button className="w-full" disabled={salvando} onClick={() => void aoSalvar()}>
                  {salvando ? "Salvando..." : "Salvar chamada"}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </PaginaAutenticada>
  );
}
