import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Cabecalho } from "@/components/Cabecalho";
import { Card } from "@/components/Card";
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
    <div className="min-h-screen bg-background">
      <Cabecalho />
      <div className="mx-auto max-w-4xl p-6">
        <h1 className="mb-6 font-serif text-klass-xl text-text-primary">Catálogo de trilhas</h1>

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
              <h2 className="font-serif text-klass-lg text-text-primary">{trilha.nome}</h2>
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
      </div>
    </div>
  );
}
