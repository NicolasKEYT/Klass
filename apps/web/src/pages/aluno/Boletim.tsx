import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { Award, Lock, Unlock } from "lucide-react";
import { useAuth } from "@/auth";
import { Aviso } from "@/components/Aviso";
import { Badge } from "@/components/Badge";
import { Card } from "@/components/Card";
import { PaginaAutenticada } from "@/components/PaginaAutenticada";
import { StatusBadge } from "@/components/StatusBadge";
import { Titulo } from "@/components/Titulo";
import { buscarTrilhaPorId, listarModulosDaTrilha, listarPreRequisitosDaTrilha } from "@/lib/catalogo";
import { listarCertificadosDoAluno } from "@/lib/certificacao";
import {
  buscarProgressoMatricula,
  listarAvaliacoesComNotaDoAluno,
  type ProgressoMatricula,
} from "@/lib/diario";
import { listarMatriculasDoAluno, type MatriculaDoAluno } from "@/lib/selecao";
import { CertificadoPDF } from "@/pdf/CertificadoPDF";
import type { Certificado, Modulo, Trilha } from "@klass/types";

// D8 (klass-uikit.pdf) — "Boletim" (era "Minhas matrículas"): em vez de
// listar matrículas soltas, agrupa por trilha e mostra cada módulo como
// card, com o módulo em andamento expandido inline (avaliações, critério
// de aprovação com os valores reais da trilha). Substitui a navegação
// para uma página de detalhe por matrícula — tudo fica na mesma tela.
interface LinhaModulo {
  modulo: Modulo;
  matricula: MatriculaDoAluno | undefined;
  /** Nomes dos módulos pré-requisito que faltam concluir (só quando sem matrícula). */
  faltantes: string[];
  progresso: ProgressoMatricula | null;
  avaliacoes: Array<{ id: string; titulo: string; peso: number; nota: number | null }>;
}

interface GrupoTrilha {
  trilha: Trilha;
  linhas: LinhaModulo[];
  certificadoTrilha: Certificado | undefined;
  certificadosModulo: Certificado[];
}

export function Boletim() {
  const { usuario } = useAuth();
  const [grupos, setGrupos] = useState<GrupoTrilha[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!usuario) return;
    let ativo = true;

    async function carregar() {
      try {
        const [matriculas, certificados] = await Promise.all([
          listarMatriculasDoAluno(usuario!.id),
          listarCertificadosDoAluno(usuario!.id),
        ]);

        const trilhaIds = [...new Set(matriculas.map((m) => m.trilhaId).filter(Boolean))];
        const gruposCarregados = await Promise.all(
          trilhaIds.map(async (trilhaId): Promise<GrupoTrilha | null> => {
            const trilha = await buscarTrilhaPorId(trilhaId);
            if (!trilha) return null;

            const [modulos, preRequisitos] = await Promise.all([
              listarModulosDaTrilha(trilhaId),
              listarPreRequisitosDaTrilha(trilhaId),
            ]);

            const matriculaPorModulo = new Map(
              matriculas.filter((m) => m.trilhaId === trilhaId).map((m) => [m.moduloId, m]),
            );
            const concluidos = new Set(
              matriculas
                .filter((m) => m.trilhaId === trilhaId && m.status === "concluida")
                .map((m) => m.moduloNome),
            );

            const linhas = await Promise.all(
              modulos.map(async (modulo): Promise<LinhaModulo> => {
                const matricula = matriculaPorModulo.get(modulo.id);
                if (!matricula) {
                  const faltantes = (preRequisitos.get(modulo.id) ?? []).filter(
                    (nome) => !concluidos.has(nome),
                  );
                  return { modulo, matricula: undefined, faltantes, progresso: null, avaliacoes: [] };
                }
                const progresso = await buscarProgressoMatricula(matricula.id);
                const avaliacoes =
                  matricula.status === "matriculada"
                    ? await listarAvaliacoesComNotaDoAluno(matricula.id, matricula.turmaId)
                    : [];
                return { modulo, matricula, faltantes: [], progresso, avaliacoes };
              }),
            );

            const certificadosDaTrilha = certificados.filter((c) => c.trilha_id === trilhaId);
            return {
              trilha,
              linhas,
              certificadoTrilha: certificadosDaTrilha.find((c) => c.modulo_id === null),
              certificadosModulo: certificadosDaTrilha.filter((c) => c.modulo_id !== null),
            };
          }),
        );

        if (ativo) setGrupos(gruposCarregados.filter((g): g is GrupoTrilha => g !== null));
      } catch (e) {
        if (ativo) setErro(e instanceof Error ? e.message : "Não foi possível carregar o boletim.");
      }
    }

    void carregar();
    return () => {
      ativo = false;
    };
  }, [usuario]);

  return (
    <PaginaAutenticada largura="estreita">
      <Titulo className="mb-6">Boletim</Titulo>

      {erro && (
        <Aviso variant="danger" className="mb-4">
          {erro}
        </Aviso>
      )}
      {!erro && grupos === null && (
        <p className="text-body-sm text-text-secondary">Carregando...</p>
      )}
      {grupos?.length === 0 && (
        <p className="text-body-sm text-text-secondary">
          Você ainda não se inscreveu em nenhuma trilha — explore o{" "}
          <Link to="/catalogo" className="font-medium text-primary hover:underline">
            catálogo
          </Link>
          .
        </p>
      )}

      <div className="flex flex-col gap-8">
        {grupos?.map((grupo) => {
          const totalModulos = grupo.linhas.length;
          const concluidos = grupo.linhas.filter((l) => l.matricula?.status === "concluida").length;
          const trilhaConcluida = totalModulos > 0 && concluidos === totalModulos;

          return (
            <div key={grupo.trilha.id}>
              <Titulo nivel="secao" className="mb-3">
                {grupo.trilha.nome}
              </Titulo>

              <div className="flex flex-col gap-3">
                {grupo.linhas.map(({ modulo, matricula, faltantes, progresso, avaliacoes }) => (
                  <Card key={modulo.id} className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <Titulo nivel="item" as="h3">
                        {modulo.ordem}. {modulo.nome}
                      </Titulo>
                      {matricula ? (
                        <StatusBadge tipo="matricula" status={matricula.status} />
                      ) : faltantes.length === 0 ? (
                        <Link to={`/catalogo/${grupo.trilha.slug}/modulos/${modulo.id}`}>
                          <Badge variant="neutral">
                            <Unlock className="h-3.5 w-3.5" aria-hidden />
                            Disponível
                          </Badge>
                        </Link>
                      ) : (
                        <Badge variant="neutral">
                          <Lock className="h-3.5 w-3.5" aria-hidden />
                          Bloqueado
                        </Badge>
                      )}
                    </div>

                    {!matricula && faltantes.length > 0 && (
                      <p className="text-label text-text-muted">
                        Requer: {faltantes.join(", ")}
                      </p>
                    )}

                    {matricula && progresso && (
                      <p className="text-body-sm text-text-secondary">
                        Média: {progresso.media !== null ? progresso.media.toFixed(1) : "—"} ·
                        Frequência:{" "}
                        {progresso.frequencia !== null ? `${progresso.frequencia.toFixed(0)}%` : "—"}
                      </p>
                    )}

                    {matricula?.status === "matriculada" && (
                      <div className="mt-1 flex flex-col gap-1.5 border-t border-border pt-3">
                        {avaliacoes.map((a) => (
                          <div key={a.id} className="flex items-center justify-between text-body-sm">
                            <span className="text-text-secondary">
                              {a.titulo} · peso {a.peso}
                            </span>
                            <span className="font-mono font-medium tabular-nums text-text-primary">
                              {a.nota !== null ? a.nota.toFixed(1) : "—"}
                            </span>
                          </div>
                        ))}
                        <p className="mt-1 text-label text-text-muted">
                          Para ser aprovado: média {matricula.trilhaMediaMinima.toFixed(1)} e
                          frequência de {matricula.frequenciaMinimaPercentual}%.{" "}
                          {(() => {
                            const mediaOk =
                              progresso?.media !== null &&
                              progresso?.media !== undefined &&
                              progresso.media >= matricula.trilhaMediaMinima;
                            const freqOk =
                              progresso?.frequencia !== null &&
                              progresso?.frequencia !== undefined &&
                              progresso.frequencia >= matricula.frequenciaMinimaPercentual;
                            if (mediaOk && freqOk) return "Você já atingiu os dois.";
                            if (!mediaOk && !freqOk) return "Você ainda não atingiu nenhum dos dois.";
                            return mediaOk
                              ? "Você já atingiu a média, falta a frequência."
                              : "Você já atingiu a frequência, falta a média.";
                          })()}
                        </p>
                      </div>
                    )}

                    {matricula?.motivoConclusao && (
                      <p className="text-label text-text-muted">{matricula.motivoConclusao}</p>
                    )}

                    {matricula?.status === "concluida" &&
                      grupo.certificadosModulo.some((c) => c.modulo_id === modulo.id) && (
                        <Link
                          to="/aluno/certificados"
                          className="text-label font-medium text-primary hover:underline"
                        >
                          Ver certificado deste módulo →
                        </Link>
                      )}
                  </Card>
                ))}
              </div>

              {/* Card de certificado só para trilhas no modo "trilha inteira"
                  (certificado por módulo já aparece em cada card acima). */}
              {grupo.trilha.tipo_certificacao === "trilha" && (
                <Card className="mt-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Award
                      className={`h-6 w-6 ${trilhaConcluida ? "text-primary" : "text-text-muted"}`}
                      aria-hidden
                    />
                    <div>
                      <p className="text-klass-md font-medium text-text-primary">
                        Certificado da trilha
                      </p>
                      <p className="text-label text-text-muted">
                        {trilhaConcluida
                          ? "Liberado — você concluiu todos os módulos."
                          : `Libera ao concluir os ${totalModulos} módulos (${concluidos} de ${totalModulos})`}
                      </p>
                    </div>
                  </div>
                  {trilhaConcluida && grupo.certificadoTrilha ? (
                    <PDFDownloadLink
                      document={<CertificadoPDF certificado={grupo.certificadoTrilha} />}
                      fileName={`certificado-${grupo.certificadoTrilha.hash_publico}.pdf`}
                      className="inline-flex h-12 sm:h-10 items-center justify-center rounded-klass-control bg-primary px-4 text-klass-md font-medium text-white hover:bg-primary/90"
                    >
                      {({ loading }) => (loading ? "Gerando..." : "Baixar PDF")}
                    </PDFDownloadLink>
                  ) : (
                    <Badge variant="neutral">
                      <Lock className="h-3.5 w-3.5" aria-hidden />
                      Bloqueado
                    </Badge>
                  )}
                </Card>
              )}
            </div>
          );
        })}
      </div>
    </PaginaAutenticada>
  );
}
