import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Ban, Check, X } from "lucide-react";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { caminhoDeVerificacao, normalizarCodigo } from "@/lib/certificacao";
import { useVerificacaoDeCertificado } from "@/lib/consultas/certificacao";
import type { CertificadoVerificado } from "@klass/types";
import { formatarDataLonga } from "@/lib/formato";

// verificar_por_hash devolve o tipo (módulo/trilha), o módulo, a turma
// congelada na emissão e se o certificado foi revogado (encerramento
// desfeito). Revogado continua "encontrado": a pessoa precisa saber que o
// documento existiu e não vale mais — não é o mesmo que código inválido.
type Estado =
  | { fase: "digitar" }
  | { fase: "carregando" }
  | { fase: "valido"; certificado: CertificadoVerificado }
  | { fase: "nao-encontrado" }
  | { fase: "erro"; mensagem: string };

// Rotas públicas /verificar e /verificar/:hash — sem <Autenticado>,
// acessíveis a qualquer pessoa da internet (é o destino do QR do PDF).
// Layout standalone, sem o cabeçalho autenticado do app.
export function VerificarCertificado() {
  const { hash: hashDaUrl } = useParams<{ hash: string }>();
  const hash = hashDaUrl ? normalizarCodigo(hashDaUrl) : undefined;
  const consulta = useVerificacaoDeCertificado(hash);
  const estado: Estado = !hash
    ? { fase: "digitar" }
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
        <p className="text-klass-lg font-semibold text-text-primary">Klass</p>
        <p className="text-label font-medium uppercase tracking-wide text-text-muted">
          Verificação de Certificado
        </p>
      </header>

      <div className="flex w-full max-w-md flex-col gap-4">
        {estado.fase !== "digitar" && (
          <Card className="flex flex-col gap-4">
            {estado.fase === "carregando" && (
              <p className="text-body-sm text-text-secondary" role="status">
                Verificando...
              </p>
            )}

            {estado.fase === "valido" && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h1 className="text-klass-lg font-semibold text-text-primary">
                    {estado.certificado.revogado ? "Certificado revogado" : "Certificado válido"}
                  </h1>
                  {estado.certificado.revogado ? (
                    <Badge variant="alerta">
                      <Ban className="h-3.5 w-3.5" aria-hidden />
                      Revogado
                    </Badge>
                  ) : (
                    <Badge variant="preenchido">
                      <Check className="h-3.5 w-3.5" aria-hidden />
                      Autêntico
                    </Badge>
                  )}
                </div>
                {estado.certificado.revogado && (
                  <p className="text-body-sm text-text-secondary">
                    Este certificado foi emitido pelo Klass, mas foi revogado
                    {estado.certificado.revogado_em
                      ? ` em ${formatarDataLonga(estado.certificado.revogado_em)}`
                      : ""}{" "}
                    e não tem mais validade. Se o aluno concluiu o módulo de novo, há um certificado
                    novo, com outro código.
                  </p>
                )}
                <dl className="flex flex-col gap-3">
                  <CodigoVerificado codigo={hash ?? ""} />
                  <div>
                    <dt className="text-label text-text-muted">Tipo</dt>
                    <dd className="text-body-sm text-text-secondary">
                      {estado.certificado.tipo === "modulo"
                        ? "Certificado de conclusão de módulo"
                        : "Certificado de conclusão de trilha"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-label text-text-muted">Aluno</dt>
                    <dd className="text-klass-md text-text-primary">
                      {estado.certificado.aluno_nome}
                    </dd>
                  </div>
                  {estado.certificado.modulo_nome && (
                    <div>
                      <dt className="text-label text-text-muted">Módulo</dt>
                      <dd className="text-klass-md text-text-primary">
                        {estado.certificado.modulo_nome}
                      </dd>
                    </div>
                  )}
                  {estado.certificado.turma_codigo && (
                    <div>
                      <dt className="text-label text-text-muted">Turma</dt>
                      <dd className="font-mono text-body-sm text-text-secondary">
                        {estado.certificado.turma_codigo}
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-label text-text-muted">Trilha</dt>
                    <dd className="text-klass-md text-text-primary">
                      {estado.certificado.trilha_nome}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-label text-text-muted">Emitido em</dt>
                    <dd className="text-body-sm text-text-secondary">
                      {formatarDataLonga(estado.certificado.emitido_em)}
                    </dd>
                  </div>
                </dl>
              </>
            )}

            {estado.fase === "nao-encontrado" && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h1 className="text-klass-lg font-semibold text-text-primary">
                    Código não encontrado
                  </h1>
                  <Badge variant="contorno">
                    <X className="h-3.5 w-3.5" aria-hidden />
                    Inválido
                  </Badge>
                </div>
                <dl>
                  <CodigoVerificado codigo={hash ?? ""} />
                </dl>
                <p className="text-body-sm text-text-secondary">
                  Nenhum certificado emitido pelo Klass corresponde a este código. Confira se ele
                  foi digitado exatamente como aparece no certificado.
                </p>
              </>
            )}

            {estado.fase === "erro" && (
              <p className="text-body-sm text-danger" role="alert">
                {estado.mensagem}
              </p>
            )}
          </Card>
        )}

        <FormularioDeCodigo
          // Remonta ao trocar de código, para o campo voltar vazio.
          key={hash ?? ""}
          titulo={estado.fase === "digitar" ? "Verificar um certificado" : "Verificar outro código"}
          principal={estado.fase === "digitar"}
        />
      </div>
    </div>
  );
}

function CodigoVerificado({ codigo }: { codigo: string }) {
  return (
    <div>
      <dt className="text-label text-text-muted">Código de verificação</dt>
      <dd className="break-all font-mono text-body-sm text-text-secondary">{codigo}</dd>
    </div>
  );
}

// Campo para conferir outro código sem depender do QR (quem recebeu o
// certificado impresso digita o código que está no rodapé).
function FormularioDeCodigo({ titulo, principal }: { titulo: string; principal: boolean }) {
  const navigate = useNavigate();
  const [codigo, setCodigo] = useState("");
  const [vazio, setVazio] = useState(false);

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    const normalizado = normalizarCodigo(codigo);
    if (!normalizado) {
      setVazio(true);
      return;
    }
    navigate(caminhoDeVerificacao(normalizado));
  }

  const Titulo = principal ? "h1" : "h2";
  return (
    <Card>
      <form onSubmit={enviar} className="flex flex-col gap-3" noValidate>
        <Titulo className="text-klass-md font-semibold text-text-primary">{titulo}</Titulo>
        <label className="flex flex-col gap-1.5">
          <span className="text-label font-medium text-text-secondary">Código de verificação</span>
          <Input
            value={codigo}
            onChange={(e) => {
              setCodigo(e.target.value);
              setVazio(false);
            }}
            placeholder="KLASS-2026-XXXXXXXX"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={vazio || undefined}
            aria-describedby={vazio ? "codigo-vazio" : "codigo-dica"}
            className="font-mono uppercase"
          />
        </label>
        {vazio ? (
          <p id="codigo-vazio" className="text-label text-danger" role="alert">
            Digite o código que aparece no certificado.
          </p>
        ) : (
          <p id="codigo-dica" className="text-label text-text-muted">
            O código fica no rodapé do certificado, ao lado do QR code.
          </p>
        )}
        <Button type="submit" className="self-start">
          Verificar
        </Button>
      </form>
    </Card>
  );
}
