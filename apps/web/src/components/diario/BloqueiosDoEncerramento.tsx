import { useState, type ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import type { AulaComPrazo, Avaliacao } from "@klass/types";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { LinkBotao } from "@/components/LinkBotao";
import { Titulo } from "@/components/Titulo";
import { useAulasSemChamada, useChamadasPendentesDaTurma, useNotasDaTurma } from "@/lib/consultas/diario";
import { useGravacao } from "@/lib/consultas/gravacao";
import { invalidar } from "@/lib/consultas/invalidar";
import { apagarAula, avaliacoesSemNota } from "@/lib/diario";
import { formatarData, formatarDiaSemanaData, formatarHora } from "@/lib/formato";
import { plural } from "@/lib/plural";

// O que ainda impede encerrar alunos da turma (QA, achado 7: o botão
// "Encerrar aluno" ficava desabilitado sem dizer por quê). A regra é do
// banco (diario.calcular_pronto_para_encerrar): nota em todas as
// avaliações e presença em todas as aulas da turma — inclusive as futuras,
// que ainda não aceitam chamada. Por isso uma aula marcada para depois de
// hoje bloqueia o encerramento até acontecer ou ser apagada.
export function BloqueiosDoEncerramento({
  turmaId,
  aulas,
  avaliacoes,
  matriculasAtivas,
  aoVerAulas,
  aoVerNotas,
}: {
  turmaId: string;
  aulas: AulaComPrazo[];
  avaliacoes: Avaliacao[];
  matriculasAtivas: string[];
  aoVerAulas: () => void;
  aoVerNotas: () => void;
}) {
  const gravar = useGravacao();
  const consultaNotas = useNotasDaTurma(turmaId, avaliacoes.map((a) => a.id));
  const consultaChamadas = useChamadasPendentesDaTurma(turmaId);
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  const [apagando, setApagando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const futuras = aulas.filter((a) => a.situacao_chamada === "futura");
  const semChamada = consultaChamadas.data ?? [];
  // A aula de hoje ainda não entra nas chamadas pendentes (só as passadas),
  // mas sem chamada também bloqueia: confere as presenças dela.
  const hoje = new Date().toLocaleDateString("sv-SE");
  const deHoje = aulas.filter((a) => a.situacao_chamada !== "futura" && a.data === hoje);
  const idsHojeSemChamada = useAulasSemChamada(deHoje.map((a) => a.id));
  const hojeSemChamada = deHoje.filter((a) => idsHojeSemChamada.includes(a.id));
  const semNota = avaliacoesSemNota(avaliacoes, consultaNotas.data ?? [], matriculasAtivas);
  const semAulaOuAvaliacao = aulas.length === 0 || avaliacoes.length === 0;
  if (futuras.length + hojeSemChamada.length + semChamada.length + semNota.length === 0 && !semAulaOuAvaliacao) return null;

  async function confirmarApagar(aulaId: string) {
    setErro(null);
    setApagando(true);
    try {
      await gravar(() => apagarAula(aulaId), (qc) => invalidar.aulas(qc, turmaId, aulaId));
      setConfirmandoId(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível apagar a aula.");
    } finally {
      setApagando(false);
    }
  }

  return (
    <Card role="region" aria-label="O que impede encerrar" className="mb-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Titulo nivel="item" as="h3">
          O que impede encerrar
        </Titulo>
        <Button variant="secondary" onClick={aoVerAulas}>
          Ver aba Aulas
        </Button>
      </div>
      <p id="explicacao-bloqueios-encerramento" className="text-body-sm text-text-secondary">
        Para encerrar, cada aluno precisa de nota em todas as avaliações e de presença em todas as
        aulas da turma — inclusive as marcadas para depois de hoje, que só aceitam chamada no dia.
      </p>
      {semAulaOuAvaliacao && (
        <p className="text-body-sm text-text-primary">
          A turma precisa de pelo menos uma aula e uma avaliação.
        </p>
      )}
      {erro && <p className="text-body-sm text-danger">{erro}</p>}
      <ul className="flex flex-col divide-y divide-border">
        {futuras.map((aula) => (
          <li key={aula.id} className="flex flex-col gap-2 py-2 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <ItemBloqueio>
                Aula futura de {formatarDiaSemanaData(aula.data, true)}
                {aula.horario ? ` · ${formatarHora(aula.horario)}` : ""}: ainda não aceita chamada
              </ItemBloqueio>
              {confirmandoId !== aula.id && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setErro(null);
                    setConfirmandoId(aula.id);
                  }}
                >
                  Apagar aula
                </Button>
              )}
            </div>
            {confirmandoId === aula.id && (
              <div className="flex flex-col gap-2 rounded-klass-control border border-border p-3">
                <p className="text-body-sm text-text-primary">
                  Apagar a aula de <strong>{formatarData(aula.data)}</strong>
                  {aula.horario ? ` · ${formatarHora(aula.horario)}` : ""}? Ela some do calendário da
                  turma e dos alunos.
                </p>
                <div className="flex gap-2">
                  <Button disabled={apagando} onClick={() => void confirmarApagar(aula.id)}>
                    {apagando ? "Apagando..." : "Apagar aula"}
                  </Button>
                  <Button variant="secondary" disabled={apagando} onClick={() => setConfirmandoId(null)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </li>
        ))}
        {hojeSemChamada.map((aula) => (
          <li key={aula.id} className="flex flex-wrap items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
            <ItemBloqueio>
              Chamada de hoje{aula.horario ? ` (${formatarHora(aula.horario)})` : ""} ainda não feita
            </ItemBloqueio>
            <LinkBotao variant="secondary" to={`/professor/turmas/${turmaId}/aulas/${aula.id}/chamada`}>
              Fazer chamada
            </LinkBotao>
          </li>
        ))}
        {semChamada.map((c) => (
          <li key={c.aulaId} className="flex flex-wrap items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
            <ItemBloqueio>
              Chamada de {formatarData(c.data)} não feita
              {c.situacao === "encerrada" ? " (fora do prazo: peça liberação à coordenação)" : ""}
            </ItemBloqueio>
            {c.situacao !== "encerrada" && (
              <LinkBotao variant="secondary" to={`/professor/turmas/${turmaId}/aulas/${c.aulaId}/chamada`}>
                Fazer chamada
              </LinkBotao>
            )}
          </li>
        ))}
        {semNota.map(({ avaliacao, faltam }) => (
          <li key={avaliacao.id} className="flex flex-wrap items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
            <ItemBloqueio>
              {avaliacao.titulo} sem nota para {plural(faltam, "aluno", "alunos")}
            </ItemBloqueio>
            <Button variant="secondary" onClick={aoVerNotas}>
              Lançar notas
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ItemBloqueio({ children }: { children: ReactNode }) {
  return (
    <span className="flex min-w-0 items-start gap-2 text-body-sm text-text-primary">
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </span>
  );
}
