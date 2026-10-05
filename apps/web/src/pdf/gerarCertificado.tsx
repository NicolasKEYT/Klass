import type { Certificado } from "@klass/types";

// O @react-pdf/renderer (e o layout do certificado, que depende dele) pesa
// ~1,3 MB e só serve na hora de baixar/abrir o PDF: é importado sob demanda
// aqui, fora do pacote principal. Antes, o PDFDownloadLink também gerava o
// PDF de cada certificado da lista assim que a tela abria.
export async function gerarPdfDoCertificado(certificado: Certificado): Promise<Blob> {
  const [{ pdf }, { CertificadoPDF }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("./CertificadoPDF"),
  ]);
  return pdf(<CertificadoPDF certificado={certificado} />).toBlob();
}

export function nomeDoArquivo(certificado: Certificado): string {
  return `certificado-${certificado.hash_publico}.pdf`;
}
