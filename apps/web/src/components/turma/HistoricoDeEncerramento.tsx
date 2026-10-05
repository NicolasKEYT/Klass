import type { RegistroDeEncerramento } from "@/lib/diario";
import { formatarDataHora, formatarMedia, formatarPercentual } from "@/lib/formato";
import { plural } from "@/lib/plural";
import { textoDoStatusMatricula } from "@/components/StatusBadge";

// Quem encerrou, desfez ou reativou, quando e por quê — a trilha de
// auditoria que o banco grava em diario.historico_encerramentos. Fica
// recolhido: a linha do aluno continua curta e o histórico abre sob demanda.
export function HistoricoDeEncerramento({ registros }: { registros: RegistroDeEncerramento[] }) {
  if (registros.length === 0) return null;
  return (
    <details className="text-label text-text-secondary">
      <summary className="cursor-pointer font-medium text-text-secondary hover:text-text-primary">
        Histórico de encerramento ({registros.length})
      </summary>
      <ol className="mt-2 flex flex-col gap-2 border-l border-border pl-3">
        {registros.map((r) => (
          <li key={r.id} className="flex flex-col gap-0.5">
            <span className="text-text-primary">
              {tituloDaAcao(r)} · {formatarDataHora(r.realizado_em)}
              {r.realizadoPorNome ? ` · por ${r.realizadoPorNome}` : ""}
            </span>
            {(r.media !== null || r.frequencia !== null) && (
              <span>
                {r.acao === "encerrar" ? "Média" : "Antes: média"}{" "}
                {r.media !== null ? formatarMedia(r.media) : "—"} · frequência{" "}
                {r.frequencia !== null ? formatarPercentual(r.frequencia) : "—"}
              </span>
            )}
            {r.motivo && <span>{r.acao === "encerrar" ? r.motivo : `Motivo: ${r.motivo}`}</span>}
            {r.certificados_revogados > 0 && (
              <span className="text-danger">
                {plural(r.certificados_revogados, "certificado revogado", "certificados revogados")}
              </span>
            )}
          </li>
        ))}
      </ol>
    </details>
  );
}

function tituloDaAcao(r: RegistroDeEncerramento): string {
  if (r.acao === "encerrar") return `Encerrada: ${textoDoStatusMatricula(r.status_novo)}`;
  const de = textoDoStatusMatricula(r.status_anterior);
  return r.acao === "desfazer"
    ? `Encerramento desfeito (era ${de})`
    : `Turma reativada (era ${de})`;
}
