import { Input } from "@/components/Input";

// Turno da turma (UI Kit, págs. 3, 6 e 11: "AM-2026-2 · Noite"). Opcional e
// livre: não existe cadastro de turnos; o banco só limita o tamanho.
export function CampoTurno({ valor, aoMudar }: { valor: string; aoMudar: (valor: string) => void }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-label font-medium text-text-secondary">Turno (opcional)</span>
      <Input maxLength={30} placeholder="Ex.: Noite, Sábado" value={valor} onChange={(e) => aoMudar(e.target.value)} />
      <span className="text-label text-text-muted">Aparece ao lado do código da turma.</span>
    </label>
  );
}
