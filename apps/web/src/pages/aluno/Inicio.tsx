import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Award, Bell, CheckCheck, FileText } from "lucide-react";
import { useAuth } from "@/auth";
import { BarraDeMeta } from "@/components/BarraDeMeta";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import {
  buscarProximoPassoDoAluno,
  listarNovidadesDoAluno,
  type NovidadeAluno,
  type ProximoPassoAluno,
} from "@/lib/diario";

function tempoRelativo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutos = Math.round(diffMs / 60_000);
  if (minutos < 1) return "agora";
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `há ${horas}h`;
  const dias = Math.round(horas / 24);
  return `há ${dias} dia(s)`;
}

// D4 (klass-uikit.pdf) — "Início" do aluno, mobile-first: "Seu próximo
// passo" com progresso em barra segmentada, frequência do módulo atual
// contra a meta de 75%, e um feed de novidades derivado dos mesmos dados
// do Realtime.
export function Inicio() {
  const { usuario, profile } = useAuth();
  const [passo, setPasso] = useState<ProximoPassoAluno | null | undefined>(undefined);
  const [novidades, setNovidades] = useState<NovidadeAluno[]>([]);

  useEffect(() => {
    if (!usuario) return;
    Promise.all([buscarProximoPassoDoAluno(usuario.id), listarNovidadesDoAluno(usuario.id)])
      .then(([p, n]) => {
        setPasso(p);
        setNovidades(n);
      })
      .catch(() => {
        setPasso(null);
      });
  }, [usuario]);

  return (
    <>
      <p className="text-body-sm text-text-secondary">Olá, {profile?.nome_completo?.split(" ")[0] ?? "..."}</p>

      {passo === undefined && (
        <div className="mt-4 h-40 animate-pulse rounded-klass-card border border-border bg-surface-subtle" />
      )}

      {passo === null && (
        <Card className="mt-4">
          <p className="text-body-sm text-text-secondary">
            Você ainda não está cursando nenhum módulo. Que tal explorar o{" "}
            <Link to="/catalogo" className="font-medium text-primary hover:underline">
              catálogo
            </Link>
            ?
          </p>
        </Card>
      )}

      {passo && (
        <>
          <Card className="mt-4">
            <p className="mb-2 text-label font-medium text-text-muted">Seu próximo passo</p>
            <p className="mb-3 text-klass-lg font-semibold text-text-primary">
              {passo.totalModulos - passo.modulosConcluidos === 1
                ? "Falta 1 módulo para o seu certificado"
                : `Faltam ${passo.totalModulos - passo.modulosConcluidos} módulos para o seu certificado`}
            </p>
            {/* Barra segmentada — módulos concluídos vs. total. */}
            <div className="flex gap-1">
              {Array.from({ length: passo.totalModulos }).map((_, i) => (
                <div
                  key={i}
                  className={`h-2 flex-1 rounded-full ${
                    i < passo.modulosConcluidos ? "bg-text-primary" : "bg-neutral-subtle"
                  }`}
                />
              ))}
            </div>
            <p className="mt-2 text-label text-text-muted">
              {passo.trilhaNome} · {passo.modulosConcluidos} de {passo.totalModulos} módulos ·
              cursando {passo.moduloAtualNome}
            </p>
            <Link to="/aluno/boletim">
              <Button className="mt-3 w-full">Ver boletim</Button>
            </Link>
          </Card>

          <Card className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-label font-medium text-text-muted">Frequência no módulo</p>
            </div>
            <p className="mb-2 font-mono text-klass-xl font-semibold tabular-nums text-text-primary">
              {passo.frequenciaAtual !== null ? `${passo.frequenciaAtual.toFixed(0)}%` : "—"}{" "}
              <span className="text-klass-md font-normal text-text-muted">
                mínimo {passo.frequenciaMinima}%
              </span>
            </p>
            <BarraDeMeta
              valor={passo.frequenciaAtual ?? 0}
              meta={passo.frequenciaMinima}
              rotulo="Frequência no módulo atual"
            />
          </Card>
        </>
      )}

      <Card className="mt-4">
        <p className="mb-3 flex items-center gap-2 text-label font-medium text-text-muted">
          <Bell className="h-4 w-4" aria-hidden />
          Novidades
        </p>
        {novidades.length === 0 && (
          <p className="text-body-sm text-text-secondary">Nada novo por enquanto.</p>
        )}
        <div className="flex flex-col gap-3">
          {novidades.map((n, i) => (
            <div key={i} className="flex items-start gap-2.5">
              {n.texto.startsWith("Nota") ? (
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" aria-hidden />
              ) : (
                <CheckCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
              )}
              <div>
                <p className="text-body-sm text-text-primary">{n.texto}</p>
                <p className="text-label text-text-muted">
                  {n.detalhe} · {tempoRelativo(n.quando)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {!passo && passo !== undefined && (
        <div className="mt-4 flex items-center gap-2 text-label text-text-muted">
          <Award className="h-4 w-4" aria-hidden />
          Certificados aparecem aqui assim que você concluir um módulo ou trilha.
        </div>
      )}
    </>
  );
}
