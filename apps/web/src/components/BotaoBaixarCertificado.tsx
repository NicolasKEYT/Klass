import { useState } from "react";
import { gerarPdfDoCertificado, nomeDoArquivo } from "@/pdf/gerarCertificado";
import type { Certificado } from "@klass/types";

// "Baixar PDF": gera o certificado só no clique (código do react-pdf
// carregado sob demanda) e entrega o arquivo com o nome de sempre.
export function BotaoBaixarCertificado({
  certificado,
  className = "",
}: {
  certificado: Certificado;
  className?: string;
}) {
  const [gerando, setGerando] = useState(false);
  const [falhou, setFalhou] = useState(false);

  async function baixar() {
    setGerando(true);
    setFalhou(false);
    try {
      const url = URL.createObjectURL(await gerarPdfDoCertificado(certificado));
      const link = document.createElement("a");
      link.href = url;
      link.download = nomeDoArquivo(certificado);
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Dá tempo ao navegador de começar o download antes de soltar o blob.
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setFalhou(true);
    } finally {
      setGerando(false);
    }
  }

  return (
    <button
      type="button"
      disabled={gerando}
      onClick={() => void baixar()}
      className={`inline-flex h-12 items-center justify-center rounded-klass-control bg-primary px-4 text-klass-md font-medium text-primary-contraste hover:brightness-95 disabled:cursor-wait sm:h-10 ${className}`}
    >
      {gerando ? "Gerando..." : falhou ? "Tentar de novo" : "Baixar PDF"}
    </button>
  );
}
