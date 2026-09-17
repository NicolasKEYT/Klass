import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/Card";
import { PaginaAutenticada } from "@/components/PaginaAutenticada";
import { Titulo } from "@/components/Titulo";
import { listarTrilhasComContagem } from "@/lib/catalogo";
import type { Trilha } from "@klass/types";

type TrilhaComContagem = Trilha & { totalModulos: number };

// Acessível a qualquer papel autenticado — todo mundo pode explorar o
// catálogo. Só mostra trilhas publicadas (a RLS já garante isso; o
// filtro aqui é só para não depender de rascunho nunca vazar por engano).
export function Catalogo() {
  const [trilhas, setTrilhas] = useState<TrilhaComContagem[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    listarTrilhasComContagem()
      .then((todas) => setTrilhas(todas.filter((t) => t.publicada)))
      .catch((e) =>
        setErro(e instanceof Error ? e.message : "Não foi possível carregar o catálogo."),
      );
  }, []);

  return (
    <PaginaAutenticada>
        <Titulo className="mb-6">Catálogo de trilhas</Titulo>

        {erro && <p className="text-body-sm text-danger">{erro}</p>}
        {!erro && trilhas === null && (
          <p className="text-body-sm text-text-secondary">Carregando...</p>
        )}
        {trilhas?.length === 0 && (
          <p className="text-body-sm text-text-secondary">Nenhuma trilha publicada no momento.</p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {trilhas?.map((trilha) => (
            <Card key={trilha.id} className="flex flex-col gap-3">
              <Titulo nivel="item" as="h2">
                {trilha.nome}
              </Titulo>
              <p className="text-body-sm text-text-secondary">
                {trilha.descricao_curta ?? trilha.descricao}
              </p>
              <p className="text-label text-text-muted">
                {trilha.totalModulos} módulos · {trilha.carga_horaria_total}h
              </p>
              <Link
                to={`/catalogo/${trilha.slug}`}
                className="text-body-sm font-medium text-primary hover:underline"
              >
                Ver detalhes
              </Link>
            </Card>
          ))}
        </div>
    </PaginaAutenticada>
  );
}
