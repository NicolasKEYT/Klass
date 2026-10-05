import { useState } from "react";
import { useAuth } from "@/auth";
import { Aviso } from "@/components/Aviso";
import { Button } from "@/components/Button";
import { useGravacao } from "@/lib/consultas/gravacao";
import { invalidar } from "@/lib/consultas/invalidar";
import { cancelarInscricao } from "@/lib/selecao";

// "Cancelar inscrição" para inscrição ainda em análise (Boletim e detalhe
// do módulo). O banco (selecao.cancelar_inscricao) só aceita cancelar a
// própria inscrição com status "inscrita"; aqui há confirmação e o botão
// fica travado durante a gravação, para um segundo clique não repetir.
export function CancelarInscricao({ matriculaId, turmaCodigo }: { matriculaId: string; turmaCodigo: string }) {
  const { usuario } = useAuth();
  const gravar = useGravacao();
  const [confirmando, setConfirmando] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar() {
    if (!usuario) return;
    setErro(null);
    setCancelando(true);
    try {
      await gravar(() => cancelarInscricao(matriculaId), (qc) => invalidar.inscricao(qc, usuario.id));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível cancelar a inscrição.");
      setCancelando(false);
    }
  }

  if (!confirmando) {
    return (
      <Button variant="secondary" className="self-start" onClick={() => setConfirmando(true)}>
        Cancelar inscrição
      </Button>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-body-sm text-text-secondary">
        Cancelar a inscrição na turma {turmaCodigo}? Ela sai da análise da coordenação; para voltar,
        será preciso se inscrever de novo.
      </p>
      {erro && <Aviso variant="danger">{erro}</Aviso>}
      <div className="flex gap-2">
        <Button disabled={cancelando} onClick={() => void confirmar()}>
          {cancelando ? "Cancelando..." : "Confirmar cancelamento"}
        </Button>
        <Button variant="secondary" disabled={cancelando} onClick={() => setConfirmando(false)}>
          Voltar
        </Button>
      </div>
    </div>
  );
}
