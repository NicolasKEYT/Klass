import { useParams } from "react-router-dom";
import { useAuth } from "@/auth";
import { Badge } from "@/components/Badge";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Card } from "@/components/Card";
import { Esqueleto, EsqueletoCards, RegiaoCarregando } from "@/components/Esqueleto";
import { ErroConsulta } from "@/components/ErroConsulta";
import { IconeCatalogo } from "@/components/IconeCatalogo";
import { LinkComPrefetch } from "@/components/LinkComPrefetch";
import { PaginaAutenticada } from "@/components/PaginaAutenticada";
import { Titulo } from "@/components/Titulo";
import {
  useModulosDaTrilha,
  usePreRequisitosDaTrilha,
  useTrilhaPorSlug,
} from "@/lib/consultas/catalogo";
import type { NivelModulo } from "@klass/types";

const NIVEL_LABEL: Record<NivelModulo, string> = {
  iniciante: "Iniciante",
  intermediario: "Intermediário",
  avancado: "Avançado",
};

// D4 (klass-uikit.pdf) — a visão geral da trilha agora só lista os
// módulos (nome, nível, carga, pré-requisitos). Turmas, pré-requisitos
// com status individual e inscrição moraram para a tela dedicada
// "Detalhe de módulo/inscrição" (DetalheModulo.tsx), alcançada ao clicar
// num módulo — antes tudo isso ficava inline aqui, junto com um modal de
// pré-requisito não cumprido que a nova tela torna desnecessário (o
// motivo já aparece junto do botão desabilitado).
export function DetalheTrilha() {
  const { slug } = useParams<{ slug: string }>();
  const { profile } = useAuth();
  // O cabeçalho vem da listagem do catálogo, se já estiver em cache.
  const consultaTrilha = useTrilhaPorSlug(slug);
  const trilha = consultaTrilha.data;
  const consultaModulos = useModulosDaTrilha(trilha?.id);
  const consultaPreRequisitos = usePreRequisitosDaTrilha(trilha?.id);
  const preRequisitos = consultaPreRequisitos.data;
  const erro = consultaTrilha.error ?? consultaModulos.error ?? consultaPreRequisitos.error;

  return (
    <PaginaAutenticada>
      {/* Destino fixo, não navigate(-1): vindo de um módulo, o histórico
          devolvia ao módulo, que por sua vez volta para cá (loop). */}
      <BotaoVoltar para="/catalogo" rotulo="Catálogo" />
      {erro && (
        <ErroConsulta
          className="mb-4"
          erro={erro}
          padrao="Não foi possível carregar a trilha."
          tentarDeNovo={() => {
            if (consultaTrilha.isError) void consultaTrilha.refetch();
            if (consultaModulos.isError) void consultaModulos.refetch();
            if (consultaPreRequisitos.isError) void consultaPreRequisitos.refetch();
          }}
        />
      )}
      {trilha === null && <p className="text-body-sm text-text-secondary">Trilha não encontrada.</p>}
      {consultaTrilha.isPending && !erro && (
        <RegiaoCarregando className="flex flex-col gap-3">
          <Esqueleto className="h-8 w-64" />
          <Esqueleto className="h-4 w-full max-w-xl" />
          <Esqueleto className="h-3 w-40" />
        </RegiaoCarregando>
      )}

      {trilha && (
        <>
          <div className="flex items-center gap-2">
            <IconeCatalogo nome={trilha.icone} className="h-6 w-6 text-primary" />
            <Titulo>{trilha.nome}</Titulo>
          </div>
          <p className="mt-2 text-body-sm text-text-secondary">{trilha.descricao}</p>
          <p className="mt-2 text-label text-text-muted">
            Carga horária total: {trilha.carga_horaria_total}h
          </p>

          {(consultaModulos.isPending || consultaPreRequisitos.isPending) && !erro && (
            <EsqueletoCards className="mt-6" altura="h-32" />
          )}
          {consultaModulos.data && preRequisitos && (
            <div className="mt-6 flex flex-col gap-3">
              {consultaModulos.data.map((modulo) => (
                <LinkComPrefetch key={modulo.id} to={`/catalogo/${trilha.slug}/modulos/${modulo.id}`}>
                  <Card className="flex flex-col gap-2 transition hover:border-text-primary/40">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <IconeCatalogo nome={modulo.icone} className="h-5 w-5 text-text-secondary" />
                        <Titulo nivel="item" as="h2">
                          {modulo.ordem}. {modulo.nome}
                        </Titulo>
                      </div>
                      <Badge variant="neutral">{NIVEL_LABEL[modulo.nivel]}</Badge>
                    </div>
                    <p className="text-body-sm text-text-secondary">{modulo.descricao}</p>
                    <p className="text-label text-text-muted">{modulo.carga_horaria_horas}h</p>
                    {(preRequisitos.get(modulo.id)?.length ?? 0) > 0 && (
                      <p className="text-label text-text-muted">
                        Requer: {preRequisitos.get(modulo.id)!.join(", ")}
                      </p>
                    )}
                    {/* A inscrição continua dentro do módulo; o card só
                        precisa deixar claro que é por ali que ela acontece. */}
                    <p className="text-label font-medium text-primary">
                      {profile?.papel === "aluno"
                        ? "Ver turmas, condições e inscrição →"
                        : "Ver turmas e condições →"}
                    </p>
                  </Card>
                </LinkComPrefetch>
              ))}
            </div>
          )}
        </>
      )}
    </PaginaAutenticada>
  );
}
