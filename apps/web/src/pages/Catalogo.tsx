import { Card } from "@/components/Card";
import { EsqueletoCards } from "@/components/Esqueleto";
import { ErroConsulta } from "@/components/ErroConsulta";
import { IconeCatalogo } from "@/components/IconeCatalogo";
import { LinkComPrefetch } from "@/components/LinkComPrefetch";
import { PaginaAutenticada } from "@/components/PaginaAutenticada";
import { Titulo } from "@/components/Titulo";
import { useTrilhasComContagem } from "@/lib/consultas/catalogo";

// Acessível a qualquer papel autenticado — todo mundo pode explorar o
// catálogo. Só mostra trilhas publicadas (a RLS já garante isso; o
// filtro aqui é só para não depender de rascunho nunca vazar por engano).
export function Catalogo() {
  const consulta = useTrilhasComContagem();
  const trilhas = consulta.data?.filter((t) => t.publicada);

  return (
    <PaginaAutenticada>
      <Titulo className="mb-6">Catálogo de trilhas</Titulo>

      {consulta.isError && !trilhas && (
        <ErroConsulta
          erro={consulta.error}
          padrao="Não foi possível carregar o catálogo."
          tentarDeNovo={() => void consulta.refetch()}
        />
      )}
      {consulta.isPending && <EsqueletoCards quantidade={4} altura="h-40" className="sm:grid sm:grid-cols-2 sm:gap-4" />}
      {trilhas?.length === 0 && (
        <p className="text-body-sm text-text-secondary">Nenhuma trilha publicada no momento.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {trilhas?.map((trilha) => (
          <Card key={trilha.id} className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <IconeCatalogo nome={trilha.icone} className="h-5 w-5 text-primary" />
              <Titulo nivel="item" as="h2">
                {trilha.nome}
              </Titulo>
            </div>
            <p className="text-body-sm text-text-secondary">
              {trilha.descricao_curta ?? trilha.descricao}
            </p>
            <p className="text-label text-text-muted">
              {trilha.totalModulos} módulos · {trilha.carga_horaria_total}h
            </p>
            <LinkComPrefetch
              to={`/catalogo/${trilha.slug}`}
              className="text-body-sm font-medium text-primary hover:underline"
            >
              Ver detalhes
            </LinkComPrefetch>
          </Card>
        ))}
      </div>
    </PaginaAutenticada>
  );
}
