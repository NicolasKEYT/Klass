import { Link } from "react-router-dom";
import { useAuth } from "@/auth";
import { Badge } from "@/components/Badge";
import { BotaoBaixarCertificado } from "@/components/BotaoBaixarCertificado";
import { Card } from "@/components/Card";
import { EsqueletoCards } from "@/components/Esqueleto";
import { ErroConsulta } from "@/components/ErroConsulta";
import { PaginaAutenticada } from "@/components/PaginaAutenticada";
import { Titulo } from "@/components/Titulo";
import { useCertificadosDoAluno } from "@/lib/consultas/certificacao";

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export function Certificados() {
  const { usuario } = useAuth();
  const consulta = useCertificadosDoAluno(usuario?.id);
  const certificados = consulta.data;

  return (
    <PaginaAutenticada>
        <Titulo className="mb-6">Meus certificados</Titulo>

        {consulta.isError && !certificados && (
          <ErroConsulta
            className="mb-4"
            erro={consulta.error}
            padrao="Não foi possível carregar seus certificados."
            tentarDeNovo={() => void consulta.refetch()}
          />
        )}

        {consulta.isPending && <EsqueletoCards quantidade={2} altura="h-28" />}

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
                  <Badge variant="contorno">
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

              <BotaoBaixarCertificado certificado={certificado} />
            </Card>
          ))}
        </div>
    </PaginaAutenticada>
  );
}
