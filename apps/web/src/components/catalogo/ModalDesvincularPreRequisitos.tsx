import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import type { DependenteEmOutraTrilha } from "@/lib/catalogo";

// Aviso antes de despublicar ou apagar algo que é pré-requisito de módulos
// de OUTRAS trilhas: o banco desfaz esses vínculos sozinho, então a
// coordenação precisa ver a lista antes de confirmar. Cancelar não grava nada.
interface Props {
  aberto: boolean;
  /** Ex.: "Voltar para rascunho", "Apagar trilha", "Apagar módulo". */
  acao: string;
  dependentes: DependenteEmOutraTrilha[];
  processando: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}

export function ModalDesvincularPreRequisitos({
  aberto,
  acao,
  dependentes,
  processando,
  onConfirmar,
  onCancelar,
}: Props) {
  return (
    <Modal
      aberto={aberto}
      titulo="Pré-requisito de outras trilhas"
      onFechar={onCancelar}
      rodape={
        <>
          <Button variant="secondary" onClick={onCancelar}>
            Cancelar
          </Button>
          <Button disabled={processando} onClick={onConfirmar}>
            {acao} e desvincular
          </Button>
        </>
      }
    >
      <p className="text-body-sm text-text-secondary">
        Estes módulos de outras trilhas vão perder o pré-requisito. O vínculo será desfeito
        automaticamente:
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {dependentes.map((d) => (
          <li key={`${d.moduloId}-${d.moduloExigidoId}`} className="text-body-sm text-text-primary">
            <span className="font-medium">
              {d.trilhaNome} · {d.moduloNome}
            </span>
            <span className="text-text-muted"> → deixa de exigir {d.moduloExigidoNome}</span>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
