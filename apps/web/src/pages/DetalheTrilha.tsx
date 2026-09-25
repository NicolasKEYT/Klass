import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Aviso } from "@/components/Aviso";
import { Badge } from "@/components/Badge";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Card } from "@/components/Card";
import { IconeCatalogo } from "@/components/IconeCatalogo";
import { PaginaAutenticada } from "@/components/PaginaAutenticada";
import { Titulo } from "@/components/Titulo";
import { buscarTrilhaPorSlug, listarModulosDaTrilha, listarPreRequisitosDaTrilha } from "@/lib/catalogo";
import type { Modulo, NivelModulo, Trilha } from "@klass/types";

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
  const [trilha, setTrilha] = useState<Trilha | null | undefined>(undefined);
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [preRequisitos, setPreRequisitos] = useState<Map<string, string[]>>(new Map());
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    let ativo = true;
    async function carregar() {
      try {
        const encontrada = await buscarTrilhaPorSlug(slug!);
        if (!ativo) return;
        setTrilha(encontrada);
        if (!encontrada) return;
        const [listaModulos, mapaPreRequisitos] = await Promise.all([
          listarModulosDaTrilha(encontrada.id),
          listarPreRequisitosDaTrilha(encontrada.id),
        ]);
        if (!ativo) return;
        setModulos(listaModulos);
        setPreRequisitos(mapaPreRequisitos);
      } catch (e) {
        if (ativo) setErro(e instanceof Error ? e.message : "Não foi possível carregar a trilha.");
      }
    }
    void carregar();
    return () => {
      ativo = false;
    };
  }, [slug]);

  return (
    <PaginaAutenticada>
      <BotaoVoltar />
      {erro && (
        <Aviso variant="danger" className="mb-4">
          {erro}
        </Aviso>
      )}
      {trilha === null && <p className="text-body-sm text-text-secondary">Trilha não encontrada.</p>}
      {trilha === undefined && !erro && (
        <p className="text-body-sm text-text-secondary">Carregando...</p>
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

          <div className="mt-6 flex flex-col gap-3">
            {modulos.map((modulo) => (
              <Link key={modulo.id} to={`/catalogo/${trilha.slug}/modulos/${modulo.id}`}>
                <Card className="flex flex-col gap-2 transition hover:-translate-y-0.5 hover:shadow-klass-hover">
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
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </PaginaAutenticada>
  );
}
