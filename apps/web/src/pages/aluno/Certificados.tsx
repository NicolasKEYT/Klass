import { Link } from "react-router-dom";
import { useAuth } from "@/auth";
import { Badge } from "@/components/Badge";
import { BotaoBaixarCertificado } from "@/components/BotaoBaixarCertificado";
import { Card } from "@/components/Card";
import { EsqueletoCards } from "@/components/Esqueleto";
import { LinkVerificar } from "@/components/LinkVerificar";
import { ErroConsulta } from "@/components/ErroConsulta";
import { PaginaAutenticada } from "@/components/PaginaAutenticada";
import { Titulo } from "@/components/Titulo";
import { Ban } from "lucide-react";
import { certificadoRevogado } from "@/lib/certificacao";
import { useCertificadosDoAluno } from "@/lib/consultas/certificacao";
import { formatarData } from "@/lib/formato";

export function Certificados() {
  const { usuario } = useAuth();
  const consulta = useCertificadosDoAluno(usuario?.id);
  // Válidos primeiro; os revogados (encerramento desfeito pela coordenação)
  // continuam listados, no fim e marcados, sem o download.
  const certificados = consulta.data
    ? [...consulta.data].sort((a, b) => Number(certificadoRevogado(a)) - Number(certificadoRevogado(b)))
    : undefined;

  return (
    <PaginaAutenticada titulo="Meus certificados">

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
              Você ainda não tem certificados. Continue estudando — conforme a trilha, o certificado
              é emitido automaticamente a cada módulo concluído, ao concluir todos os módulos, ou
              nos dois momentos. Explore o{" "}
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
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="contorno">
                    {certificado.modulo_id !== null ? "Módulo" : "Trilha"}
                  </Badge>
                  {certificadoRevogado(certificado) && (
                    <Badge variant="alerta">
                      <Ban className="h-3.5 w-3.5" aria-hidden />
                      Revogado
                    </Badge>
                  )}
                  <Titulo nivel="item" as="h2">
                    {certificado.modulo_id !== null
                      ? certificado.modulo_nome
                      : certificado.trilha_nome}
                  </Titulo>
                </div>
                {certificado.modulo_id !== null ? (
                  <p className="text-label text-text-muted">
                    Certificado de módulo · trilha {certificado.trilha_nome}
                    {certificado.turma_codigo ? ` · turma ${certificado.turma_codigo}` : ""} ·{" "}
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
                {certificado.revogado_em && (
                  <p className="text-label text-text-secondary">
                    Revogado em {formatarData(certificado.revogado_em)}: o encerramento deste módulo
                    foi desfeito pela coordenação. Ao concluir de novo, você recebe um certificado
                    novo.
                  </p>
                )}
                <p className="text-label text-text-muted">
                  Código de verificação:{" "}
                  <span className="font-mono text-text-secondary">{certificado.hash_publico}</span>
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                <LinkVerificar hash={certificado.hash_publico} />
                {!certificadoRevogado(certificado) && <BotaoBaixarCertificado certificado={certificado} />}
              </div>
            </Card>
          ))}
        </div>
    </PaginaAutenticada>
  );
}
