import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { useAuth } from "@/auth";
import { Aviso } from "@/components/Aviso";
import { Badge } from "@/components/Badge";
import { Card } from "@/components/Card";
import { PaginaAutenticada } from "@/components/PaginaAutenticada";
import { Titulo } from "@/components/Titulo";
import { listarCertificadosDoAluno } from "@/lib/certificacao";
import { CertificadoPDF } from "@/pdf/CertificadoPDF";
import type { Certificado } from "@klass/types";

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export function Certificados() {
  const { usuario } = useAuth();
  const [certificados, setCertificados] = useState<Certificado[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!usuario) return;
    listarCertificadosDoAluno(usuario.id)
      .then(setCertificados)
      .catch((e) =>
        setErro(e instanceof Error ? e.message : "Não foi possível carregar seus certificados."),
      );
  }, [usuario?.id]);

  return (
    <PaginaAutenticada>
        <Titulo className="mb-6">Meus certificados</Titulo>

        {erro && (
          <Aviso variant="danger" className="mb-4">
            {erro}
          </Aviso>
        )}

        {!erro && certificados === null && (
          <p className="text-body-sm text-text-secondary">Carregando...</p>
        )}

        {certificados?.length === 0 && (
          <Card>
            <p className="text-body-sm text-text-secondary">
              Você ainda não concluiu nenhuma trilha completa. Continue estudando — o certificado é
              emitido automaticamente quando você conclui todos os módulos de uma trilha. Explore o{" "}
              <Link to="/catalogo" className="font-medium text-primary hover:underline">
                catálogo
              </Link>
              .
            </p>
          </Card>
        )}

        <div className="flex flex-col gap-3">
          {certificados?.map((certificado) => (
            <Card
              key={certificado.id}
              className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Badge variant="neutral">
                    {certificado.modulo_id !== null ? "Módulo" : "Trilha"}
                  </Badge>
                  <Titulo nivel="item" as="h2">
                    {certificado.modulo_id !== null
                      ? certificado.modulo_nome
                      : certificado.trilha_nome}
                  </Titulo>
                </div>
                {certificado.modulo_id !== null ? (
                  <p className="text-label text-text-muted">
                    Certificado de módulo · trilha {certificado.trilha_nome} ·{" "}
                    {certificado.modulo_carga_horaria} horas
                  </p>
                ) : (
                  <p className="text-label text-text-muted">
                    Certificado de trilha · {certificado.trilha_carga_horaria_total} horas
                  </p>
                )}
                <p className="text-label text-text-muted">
                  Emitido em {formatarData(certificado.emitido_em)}
                </p>
                <p className="font-mono text-label text-text-muted">{certificado.hash_publico}</p>
              </div>

              <PDFDownloadLink
                document={<CertificadoPDF certificado={certificado} />}
                fileName={`certificado-${certificado.hash_publico}.pdf`}
                className="inline-flex h-[38px] items-center justify-center rounded-klass-control bg-primary px-4 text-klass-md font-medium text-white hover:bg-primary/90"
              >
                {({ loading }) => (loading ? "Gerando..." : "Baixar PDF")}
              </PDFDownloadLink>
            </Card>
          ))}
        </div>
    </PaginaAutenticada>
  );
}
