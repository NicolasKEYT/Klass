import { useParams } from "react-router-dom";
import { Badge } from "@/components/Badge";
import { Card } from "@/components/Card";
import { useVerificacaoDeCertificado } from "@/lib/consultas/certificacao";
import type { CertificadoVerificado } from "@klass/types";

type Estado =
  | { fase: "carregando" }
  | { fase: "valido"; certificado: CertificadoVerificado }
  | { fase: "nao-encontrado" }
  | { fase: "erro"; mensagem: string };

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

// Rota pública /verificar/:hash — sem <Autenticado>, acessível a qualquer
// pessoa da internet. Layout standalone, sem o cabeçalho autenticado do app.
export function VerificarCertificado() {
  const { hash } = useParams<{ hash: string }>();
  const consulta = useVerificacaoDeCertificado(hash);
  const estado: Estado = !hash
    ? { fase: "nao-encontrado" }
    : consulta.isPending
      ? { fase: "carregando" }
      : consulta.isError
        ? {
            fase: "erro",
            mensagem:
              consulta.error instanceof Error
                ? consulta.error.message
                : "Não foi possível verificar o certificado.",
          }
        : consulta.data
          ? { fase: "valido", certificado: consulta.data }
          : { fase: "nao-encontrado" };

  return (
    <div className="flex min-h-screen flex-col items-center bg-background p-6">
      <header className="mb-8 mt-4 text-center">
        <p className="font-serif text-klass-lg text-text-primary">Klass</p>
        <p className="text-label font-medium uppercase tracking-wide text-text-muted">
          Verificação de Certificado
        </p>
      </header>

      <Card className="flex w-full max-w-md flex-col gap-4">
        {estado.fase === "carregando" && (
          <p className="text-body-sm text-text-secondary">Verificando...</p>
        )}

        {estado.fase === "valido" && (
          <>
            <div className="flex items-center justify-between">
              <h1 className="font-serif text-klass-lg text-text-primary">Certificado válido</h1>
              <Badge variant="success">Autêntico</Badge>
            </div>
            <dl className="flex flex-col gap-3">
              <div>
                <dt className="text-label text-text-muted">Aluno</dt>
                <dd className="text-klass-md text-text-primary">{estado.certificado.aluno_nome}</dd>
              </div>
              <div>
                <dt className="text-label text-text-muted">Trilha</dt>
                <dd className="text-klass-md text-text-primary">
                  {estado.certificado.trilha_nome}
                </dd>
              </div>
              <div>
                <dt className="text-label text-text-muted">Emitido em</dt>
                <dd className="text-body-sm text-text-secondary">
                  {formatarData(estado.certificado.emitido_em)}
                </dd>
              </div>
              <div>
                <dt className="text-label text-text-muted">Código</dt>
                <dd className="font-mono text-body-sm text-text-secondary">{hash}</dd>
              </div>
            </dl>
          </>
        )}

        {estado.fase === "nao-encontrado" && (
          <>
            <div className="flex items-center justify-between">
              <h1 className="font-serif text-klass-lg text-text-primary">
                Certificado não encontrado
              </h1>
              <Badge variant="danger">Inválido</Badge>
            </div>
            <p className="text-body-sm text-text-secondary">
              Nenhum certificado corresponde a este código. Confira se o código foi digitado
              corretamente.
            </p>
          </>
        )}

        {estado.fase === "erro" && (
          <p className="text-body-sm text-danger">{estado.mensagem}</p>
        )}
      </Card>
    </div>
  );
}
