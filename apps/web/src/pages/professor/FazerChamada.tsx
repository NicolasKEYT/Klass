import { useState } from "react";
import { useParams } from "react-router-dom";
import { Check, X } from "lucide-react";
import { useAuth } from "@/auth";
import { Aviso } from "@/components/Aviso";
import { Avatar } from "@/components/Avatar";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Button } from "@/components/Button";
import { Esqueleto, EsqueletoCards, RegiaoCarregando } from "@/components/Esqueleto";
import { ErroConsulta } from "@/components/ErroConsulta";
import { PaginaAutenticada } from "@/components/PaginaAutenticada";
import { Titulo } from "@/components/Titulo";
import { chaves } from "@/lib/consultas/chaves";
import { useAula, usePresencasDaAula } from "@/lib/consultas/diario";
import { useGravacao } from "@/lib/consultas/gravacao";
import { invalidar } from "@/lib/consultas/invalidar";
import { useMatriculasDaTurma } from "@/lib/consultas/selecao";
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

  return (
    <PaginaAutenticada largura="estreita" className="pb-28">
      <BotaoVoltar seSemHistorico={`/professor/turmas/${turmaId}?aba=aulas`} />

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
          <Titulo className="mb-1">
            Chamada — {aula.data.split("-").reverse().join("/")}
            {aula.horario ? ` · ${aula.horario}` : ""}
          </Titulo>
          {aula.descricao && (
            <p className="mb-4 text-body-sm text-text-secondary">{aula.descricao}</p>
          )}

          {/* Contagem no topo (D5) — fundo neutro sutil, não card branco
              com borda (comparado por pixel com a tela "Chamada · Aula 7"). */}
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-klass-card bg-neutral-subtle py-4 text-center">
              <p className="font-mono text-klass-xl font-semibold tabular-nums text-text-primary">
                {totalPresentes}
              </p>
              <p className="text-label text-text-muted">presentes</p>
            </div>
            <div className="rounded-klass-card bg-neutral-subtle py-4 text-center">
              <p className="font-mono text-klass-xl font-semibold tabular-nums text-text-primary">
                {totalFaltas}
              </p>
              <p className="text-label text-text-muted">faltas</p>
            </div>
          </div>

          <p className="mb-3 text-label text-text-muted">
            Todos começam presentes. Toque em <strong>Falta</strong> para quem não veio.
          </p>

          {carregandoLista && !erroDeLeitura && <EsqueletoCards quantidade={4} altura="h-16" />}
          {!carregandoLista && (
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
                  className="flex min-h-16 items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar nome={aluno.alunoNome} />
                    <span className="truncate text-body-sm font-medium text-text-primary">
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
                      aria-pressed={presente}
                      onClick={() =>
                        setMarcadas((atual) => ({ ...atual, [aluno.matriculaId]: true }))
                      }
                      className={`flex h-12 items-center gap-1.5 px-4 text-klass-md font-medium transition ${
                        presente ? "bg-text-primary text-white" : "bg-surface text-text-muted"
                      }`}
                    >
                      <Check className="h-4 w-4" aria-hidden />P
                    </button>
                    <button
                      type="button"
                      aria-pressed={!presente}
                      onClick={() =>
                        setMarcadas((atual) => ({ ...atual, [aluno.matriculaId]: false }))
                      }
                      className={`flex h-12 items-center gap-1.5 border-l border-border px-4 text-klass-md font-medium transition ${
                        !presente ? "bg-text-primary text-white" : "bg-surface text-text-muted"
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

          {!carregandoLista && listaAlunos.length > 0 && (
            // bottom-16 no celular: sem isso, o botão fixo ficava atrás da
            // barra inferior de navegação (também fixed, com z-index maior)
            // — ambas na mesma faixa de 64px, então o botão sumia visualmente
            // por trás da barra. No desktop não há barra inferior, então
            // md:bottom-0 (e md:sticky, sem barra nenhuma sobrepondo).
            <div className="fixed inset-x-0 bottom-16 z-20 border-t border-border bg-surface p-4 md:sticky md:bottom-0">
              <div className="mx-auto flex max-w-2xl items-center gap-3">
                {alteracoesNaoSalvas && (
                  <span className="text-label text-text-secondary">Alterações ainda não salvas</span>
                )}
                <Button className="ml-auto flex-1 md:flex-none" disabled={salvando} onClick={() => void aoSalvar()}>
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
