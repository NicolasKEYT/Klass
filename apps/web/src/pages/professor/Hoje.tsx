import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/auth";
import { Aviso } from "@/components/Aviso";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { StatusBadge } from "@/components/StatusBadge";
import { Titulo } from "@/components/Titulo";
import {
  listarAlunosQuePedemAtencaoDoProfessor,
  listarAulasDeHojeDoProfessor,
  listarPendenciasDoProfessor,
  type AlunoQuePedeAtencao,
  type AulaDeHoje,
  type PendenciaProfessor,
} from "@/lib/diario";

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
  const { usuario } = useAuth();
  const [aulas, setAulas] = useState<AulaDeHoje[] | null>(null);
  const [pendencias, setPendencias] = useState<PendenciaProfessor[] | null>(null);
  const [alunosAtencao, setAlunosAtencao] = useState<AlunoQuePedeAtencao[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!usuario) return;
    Promise.all([
      listarAulasDeHojeDoProfessor(usuario.id),
      listarPendenciasDoProfessor(usuario.id),
      listarAlunosQuePedemAtencaoDoProfessor(usuario.id),
    ])
      .then(([a, p, al]) => {
        setAulas(a);
        setPendencias(p);
        setAlunosAtencao(al);
      })
      .catch((e) => setErro(e instanceof Error ? e.message : "Não foi possível carregar o painel."));
  }, [usuario]);

  return (
    <>
      <p className="text-body-sm text-text-secondary">{dataPorExtenso()}</p>
      <Titulo className="mb-6">Hoje</Titulo>

      {erro && (
        <Aviso variant="danger" className="mb-4">
          {erro}
        </Aviso>
      )}

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
          {aulas === null && !erro && (
            <p className="text-body-sm text-text-secondary">Carregando...</p>
          )}
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
                    <p className="text-label text-text-muted">{aula.totalAlunos} aluno(s)</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge
                    tipo="aula"
                    status={aula.chamadaFeita ? "chamada_feita" : "chamada_pendente"}
                  />
                  <Link to={`/professor/turmas/${aula.turmaId}/aulas/${aula.id}/chamada`}>
                    <Button variant={aula.chamadaFeita ? "secondary" : "primary"}>
                      {aula.chamadaFeita ? "Ver" : "Fazer chamada"}
                    </Button>
                  </Link>
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
            {pendencias === null && !erro && (
              <p className="text-body-sm text-text-secondary">Carregando...</p>
            )}
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
                  <Link
                    to={
                      p.tipo === "chamada_atrasada"
                        ? `/professor/turmas/${p.turmaId}/aulas/${p.aulaId}/chamada`
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
                  </Link>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <p className="mb-1 text-klass-md font-medium text-text-primary">Alunos que pedem atenção</p>
            <p className="mb-3 text-label text-text-muted">
              Frequência abaixo de 75% (LDB, art. 24) ou média abaixo da mínima da trilha.
            </p>
            {alunosAtencao === null && !erro && (
              <p className="text-body-sm text-text-secondary">Carregando...</p>
            )}
            {alunosAtencao?.length === 0 && (
              <p className="text-body-sm text-text-secondary">Nenhum aluno nessa situação.</p>
            )}
            <div className="flex flex-col divide-y divide-border">
              {alunosAtencao?.map((a, i) => (
                <Link
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
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
