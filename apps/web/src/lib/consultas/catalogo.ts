import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";
import {
  buscarTrilhaPorId,
  buscarTrilhaPorSlug,
  listarModulosDaTrilha,
  listarPreRequisitosDaTrilha,
  listarPreRequisitosDoModulo,
  listarPreRequisitosIdsDaTrilha,
  listarTrilhas,
  listarTrilhasComContagem,
} from "@/lib/catalogo";
import type { Trilha } from "@klass/types";
import { chaves } from "./chaves";
import { queryClient } from "./cliente";

// MS2 — Catálogo Curricular. Cada opção embrulha uma função de
// lib/catalogo.ts (única camada que fala com o Supabase) numa chave do
// cache; os hooks são o que as telas usam para ler.

// A listagem (catálogo público ou gestão) já trouxe a linha inteira de
// cada trilha: a tela de detalhe abre com ela na hora, sem esperar outra
// ida ao banco só para o cabeçalho.
function trilhaDaListagem(filtro: (t: Trilha) => boolean): Trilha | undefined {
  return queryClient
    .getQueryData<Trilha[]>(chaves.catalogo.trilhasComContagem())
    ?.find(filtro);
}
function quandoAListagemFoiBuscada(): number | undefined {
  return queryClient.getQueryState(chaves.catalogo.trilhasComContagem())?.dataUpdatedAt;
}

export const opcoesCatalogo = {
  trilhas: () => queryOptions({ queryKey: chaves.catalogo.trilhas(), queryFn: listarTrilhas }),
  trilhasComContagem: () =>
    queryOptions({ queryKey: chaves.catalogo.trilhasComContagem(), queryFn: listarTrilhasComContagem }),
  trilhaPorSlug: (slug: string) =>
    queryOptions({
      queryKey: chaves.catalogo.trilhaPorSlug(slug),
      queryFn: () => buscarTrilhaPorSlug(slug),
      initialData: () => trilhaDaListagem((t) => t.slug === slug),
      initialDataUpdatedAt: quandoAListagemFoiBuscada,
    }),
  trilhaPorId: (id: string) =>
    queryOptions({
      queryKey: chaves.catalogo.trilhaPorId(id),
      queryFn: () => buscarTrilhaPorId(id),
      initialData: () => trilhaDaListagem((t) => t.id === id),
      initialDataUpdatedAt: quandoAListagemFoiBuscada,
    }),
  modulos: (trilhaId: string) =>
    queryOptions({
      queryKey: chaves.catalogo.modulos(trilhaId),
      queryFn: () => listarModulosDaTrilha(trilhaId),
      placeholderData: keepPreviousData,
    }),
  // Reaproveita a lista de módulos do cache (mesma chave de `modulos`)
  // em vez de buscá-la de novo antes dos pré-requisitos.
  preRequisitosDaTrilha: (trilhaId: string) =>
    queryOptions({
      queryKey: chaves.catalogo.preRequisitosDaTrilha(trilhaId),
      queryFn: async () =>
        listarPreRequisitosDaTrilha(
          trilhaId,
          await queryClient.fetchQuery(opcoesCatalogo.modulos(trilhaId)),
        ),
    }),
  preRequisitosIdsDaTrilha: (trilhaId: string) =>
    queryOptions({
      queryKey: chaves.catalogo.preRequisitosIdsDaTrilha(trilhaId),
      queryFn: async () =>
        listarPreRequisitosIdsDaTrilha(
          trilhaId,
          await queryClient.fetchQuery(opcoesCatalogo.modulos(trilhaId)),
        ),
    }),
  preRequisitosDoModulo: (moduloId: string) =>
    queryOptions({
      queryKey: chaves.catalogo.preRequisitosDoModulo(moduloId),
      queryFn: () => listarPreRequisitosDoModulo(moduloId),
    }),
};

export function useTrilhas() {
  return useQuery(opcoesCatalogo.trilhas());
}

export function useTrilhasComContagem() {
  return useQuery(opcoesCatalogo.trilhasComContagem());
}

export function useTrilhaPorSlug(slug: string | undefined) {
  return useQuery({ ...opcoesCatalogo.trilhaPorSlug(slug ?? ""), enabled: !!slug });
}

export function useTrilhaPorId(id: string | undefined) {
  return useQuery({ ...opcoesCatalogo.trilhaPorId(id ?? ""), enabled: !!id });
}

export function useModulosDaTrilha(trilhaId: string | undefined) {
  return useQuery({ ...opcoesCatalogo.modulos(trilhaId ?? ""), enabled: !!trilhaId });
}

export function usePreRequisitosDaTrilha(trilhaId: string | undefined) {
  return useQuery({ ...opcoesCatalogo.preRequisitosDaTrilha(trilhaId ?? ""), enabled: !!trilhaId });
}

export function usePreRequisitosIdsDaTrilha(trilhaId: string | undefined) {
  return useQuery({
    ...opcoesCatalogo.preRequisitosIdsDaTrilha(trilhaId ?? ""),
    enabled: !!trilhaId,
  });
}

export function usePreRequisitosDoModulo(moduloId: string | undefined) {
  return useQuery({ ...opcoesCatalogo.preRequisitosDoModulo(moduloId ?? ""), enabled: !!moduloId });
}
