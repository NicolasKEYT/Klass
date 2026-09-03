import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Badge } from "@/components/Badge";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Cabecalho } from "@/components/Cabecalho";
import { Card } from "@/components/Card";
import {
  buscarTrilhaPorSlug,
  listarModulosDaTrilha,
  listarPreRequisitosDaTrilha,
} from "@/lib/catalogo";
import type { Modulo, NivelModulo, Trilha } from "@klass/types";

const NIVEL_LABEL: Record<NivelModulo, string> = {
  iniciante: "Iniciante",
  intermediario: "Intermediário",
  avancado: "Avançado",
};

export function DetalheTrilha() {
  const { slug } = useParams<{ slug: string }>();
  const [trilha, setTrilha] = useState<Trilha | null | undefined>(undefined);
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [preRequisitos, setPreRequisitos] = useState<Map<string, string[]>>(new Map());
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    buscarTrilhaPorSlug(slug)
      .then(async (encontrada) => {
        setTrilha(encontrada);
        if (!encontrada) return;
        const [listaModulos, mapaPreRequisitos] = await Promise.all([
          listarModulosDaTrilha(encontrada.id),
          listarPreRequisitosDaTrilha(encontrada.id),
        ]);
        setModulos(listaModulos);
        setPreRequisitos(mapaPreRequisitos);
      })
      .catch((e) =>
        setErro(e instanceof Error ? e.message : "Não foi possível carregar a trilha."),
      );
  }, [slug]);

  return (
    <div className="min-h-screen bg-background">
      <Cabecalho />
      <div className="mx-auto max-w-3xl p-6">
        <BotaoVoltar />
        {erro && <p className="text-body-sm text-danger">{erro}</p>}
        {trilha === null && (
          <p className="text-body-sm text-text-secondary">Trilha não encontrada.</p>
        )}
        {trilha === undefined && !erro && (
          <p className="text-body-sm text-text-secondary">Carregando...</p>
        )}

        {trilha && (
          <>
            <h1 className="font-serif text-klass-xl text-text-primary">{trilha.nome}</h1>
            <p className="mt-2 text-body-sm text-text-secondary">{trilha.descricao}</p>
            <p className="mt-2 text-label text-text-muted">
              Carga horária total: {trilha.carga_horaria_total}h
            </p>

            <div className="mt-6 flex flex-col gap-4">
              {modulos.map((modulo) => (
                <Card key={modulo.id} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <h2 className="text-klass-md text-text-primary">
                      {modulo.ordem}. {modulo.nome}
                    </h2>
                    <Badge variant="neutral">{NIVEL_LABEL[modulo.nivel]}</Badge>
                  </div>
                  <p className="text-body-sm text-text-secondary">{modulo.descricao}</p>
                  <p className="text-label text-text-muted">{modulo.carga_horaria_horas}h</p>
                  {(preRequisitos.get(modulo.id)?.length ?? 0) > 0 && (
                    <p className="text-label text-text-muted">
                      Requer: {preRequisitos.get(modulo.id)!.join(", ")}
                    </p>
                  )}
                </Card>
              ))}
            </div>

            <Card className="mt-6 text-center text-body-sm text-text-secondary">
              A inscrição nesta trilha chega na próxima fase.
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
