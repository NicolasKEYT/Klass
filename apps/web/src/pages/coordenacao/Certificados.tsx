import { useMemo, useState } from "react";
import { Card } from "@/components/Card";
import { EsqueletoTabela } from "@/components/Esqueleto";
import { ErroConsulta } from "@/components/ErroConsulta";
import { Input } from "@/components/Input";
import { PaginaAutenticada } from "@/components/PaginaAutenticada";
import { Titulo } from "@/components/Titulo";
import { useTodosCertificados } from "@/lib/consultas/certificacao";
import { gerarPdfDoCertificado } from "@/pdf/gerarCertificado";
import type { Certificado } from "@klass/types";

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export function Certificados() {
  const consulta = useTodosCertificados();
  const certificados = consulta.data;
  const [filtroTrilha, setFiltroTrilha] = useState("");
  const [filtroAluno, setFiltroAluno] = useState("");

  const trilhas = useMemo(
    () => [...new Set((certificados ?? []).map((c) => c.trilha_nome))].sort(),
    [certificados],
  );

  const filtrados = useMemo(() => {
    return (certificados ?? []).filter((c) => {
      const casaTrilha = !filtroTrilha || c.trilha_nome === filtroTrilha;
      const casaAluno =
        !filtroAluno || c.aluno_nome.toLowerCase().includes(filtroAluno.toLowerCase());
      return casaTrilha && casaAluno;
    });
  }, [certificados, filtroTrilha, filtroAluno]);

  // Gera o PDF na hora e abre em nova aba (a coordenação confere sem
  // baixar). O código do react-pdf só é carregado neste clique.
  async function abrirPdf(certificado: Certificado) {
    const blob = await gerarPdfDoCertificado(certificado);
    window.open(URL.createObjectURL(blob), "_blank");
  }

  return (
    <PaginaAutenticada largura="ampla">
        <Titulo className="mb-6">Certificados</Titulo>

        {consulta.isError && !certificados && (
          <ErroConsulta
            className="mb-4"
            erro={consulta.error}
            padrao="Não foi possível carregar os certificados."
            tentarDeNovo={() => void consulta.refetch()}
          />
        )}

        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-label font-medium text-text-secondary">Trilha</span>
            <select
              value={filtroTrilha}
              onChange={(e) => setFiltroTrilha(e.target.value)}
              className="h-12 sm:h-10 rounded-klass-control border border-controle bg-surface px-3 text-klass-md text-text-primary"
            >
              <option value="">Todas</option>
              {trilhas.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-label font-medium text-text-secondary">Aluno</span>
            <Input
              type="search"
              placeholder="Buscar por nome"
              value={filtroAluno}
              onChange={(e) => setFiltroAluno(e.target.value)}
            />
          </label>
        </div>

        {consulta.isPending && <EsqueletoTabela linhas={4} colunas={5} />}
        {certificados?.length === 0 && (
          <p className="text-body-sm text-text-secondary">Nenhum certificado emitido ainda.</p>
        )}
        {certificados && certificados.length > 0 && filtrados.length === 0 && (
          <p className="text-body-sm text-text-secondary">
            Nenhum certificado corresponde aos filtros.
          </p>
        )}

        {filtrados.length > 0 && (
          <Card className="overflow-hidden !px-0 !py-0">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border text-label text-text-muted">
                  <th className="px-4 py-3 font-medium">Aluno</th>
                  <th className="px-4 py-3 font-medium">Trilha</th>
                  <th className="px-4 py-3 font-medium">Emitido em</th>
                  <th className="px-4 py-3 font-medium">Código</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {filtrados.map((certificado) => (
                  <tr key={certificado.id} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-3 text-body-sm text-text-primary">
                      {certificado.aluno_nome}
                    </td>
                    <td className="px-4 py-3 text-body-sm text-text-secondary">
                      {certificado.trilha_nome}
                      {certificado.modulo_id !== null && (
                        <span className="block text-label text-text-muted">
                          Módulo: {certificado.modulo_nome}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-body-sm text-text-secondary">
                      {formatarData(certificado.emitido_em)}
                    </td>
                    <td className="px-4 py-3 font-mono text-label text-text-muted">
                      {certificado.hash_publico}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void abrirPdf(certificado)}
                        className="text-body-sm font-medium text-primary hover:underline"
                      >
                        Ver PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
    </PaginaAutenticada>
  );
}
