import { supabase } from "@/lib/supabase";
import { mensagemDeErroBanco } from "@/lib/mensagensDeErroBanco";
import type {
  AvaliacaoModelo,
  Modulo,
  NivelModulo,
  PreRequisitoDetalhado,
  TipoCertificacao,
  Trilha,
} from "@klass/types";

// Ponto único de acesso a catalogo.* — cada chamada já traduz erro do
// Postgres para mensagem em português (ver mensagensDeErroBanco).
function catalogo() {
  if (!supabase) throw new Error("Supabase não configurado.");
  return supabase.schema("catalogo");
}

export function gerarSlug(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos (NFD separa a letra do acento)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// ---------------------------------------------------------------------
// Avaliações padrão do módulo (modelo). A coordenação escreve (RLS); toda
// turma nova do módulo nasce com elas (trigger no diário). Turmas já
// criadas não mudam.
// ---------------------------------------------------------------------

export async function listarAvaliacoesModelo(moduloId: string): Promise<AvaliacaoModelo[]> {
  const { data, error } = await catalogo()
    .from("avaliacoes_modelo")
    .select("*")
    .eq("modulo_id", moduloId)
    .order("ordem");
  if (error) throw new Error(mensagemDeErroBanco(error));
  return data;
}

export async function criarAvaliacaoModelo(input: { moduloId: string; titulo: string; peso: number; ordem: number }): Promise<void> {
  const { error } = await catalogo()
    .from("avaliacoes_modelo")
    .insert({ modulo_id: input.moduloId, titulo: input.titulo.trim(), peso: input.peso, ordem: input.ordem });
  if (error) throw new Error(mensagemDeErroBanco(error));
}

export async function atualizarAvaliacaoModelo(id: string, patch: { titulo: string; peso: number }): Promise<void> {
  const { error } = await catalogo()
    .from("avaliacoes_modelo")
    .update({ titulo: patch.titulo.trim(), peso: patch.peso })
    .eq("id", id);
  if (error) throw new Error(mensagemDeErroBanco(error));
}

export async function apagarAvaliacaoModelo(id: string): Promise<void> {
  const { error } = await catalogo().from("avaliacoes_modelo").delete().eq("id", id);
  if (error) throw new Error(mensagemDeErroBanco(error));
}

/** Nova ordem (ids na ordem desejada) — catalogo.reordenar_avaliacoes_modelo. */
export async function reordenarAvaliacoesModelo(ids: string[]): Promise<void> {
  const { error } = await catalogo().rpc("reordenar_avaliacoes_modelo", { p_ids: ids });
  if (error) throw new Error(mensagemDeErroBanco(error));
}

export async function listarTrilhas(): Promise<Trilha[]> {
  const { data, error } = await catalogo().from("trilhas").select("*").order("nome");
  if (error) throw new Error(mensagemDeErroBanco(error));
  return data;
}

/** Trilhas + contagem de módulos, usado tanto no catálogo público quanto na gestão. */
export async function listarTrilhasComContagem(): Promise<
  Array<Trilha & { totalModulos: number }>
> {
  const [trilhas, { data: modulos, error }] = await Promise.all([
    listarTrilhas(),
    catalogo().from("modulos").select("trilha_id"),
  ]);
  if (error) throw new Error(mensagemDeErroBanco(error));

  const contagem = new Map<string, number>();
  for (const m of modulos ?? []) {
    contagem.set(m.trilha_id, (contagem.get(m.trilha_id) ?? 0) + 1);
  }
  return trilhas.map((t) => ({ ...t, totalModulos: contagem.get(t.id) ?? 0 }));
}

export async function buscarTrilhaPorSlug(slug: string): Promise<Trilha | null> {
  const { data, error } = await catalogo().from("trilhas").select("*").eq("slug", slug).maybeSingle();
  if (error) throw new Error(mensagemDeErroBanco(error));
  return data;
}

// Usado onde já se tem o id (não o slug) à mão — ex.: boletim do aluno,
// que agrupa matrículas por trilha_id.
export async function buscarTrilhaPorId(id: string): Promise<Trilha | null> {
  const { data, error } = await catalogo().from("trilhas").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(mensagemDeErroBanco(error));
  return data;
}

export async function criarTrilha(input: {
  nome: string;
  slug: string;
  descricao: string;
  descricaoCurta: string;
  icone: string | null;
  tipoCertificacao: TipoCertificacao;
  mediaMinima: number;
  frequenciaMinima: number;
}): Promise<Trilha> {
  const { data, error } = await catalogo()
    .from("trilhas")
    .insert({
      nome: input.nome,
      slug: input.slug,
      descricao: input.descricao,
      descricao_curta: input.descricaoCurta || null,
      icone: input.icone,
      tipo_certificacao: input.tipoCertificacao,
      media_minima: input.mediaMinima,
      frequencia_minima_percentual: input.frequenciaMinima,
    })
    .select("*")
    .single();
  if (error) throw new Error(mensagemDeErroBanco(error));
  return data;
}

export async function atualizarTrilha(
  id: string,
  patch: Partial<
    Pick<
      Trilha,
      | "nome"
      | "slug"
      | "descricao"
      | "descricao_curta"
      | "icone"
      | "tipo_certificacao"
      | "media_minima"
      | "frequencia_minima_percentual"
    >
  >,
): Promise<Trilha> {
  const { data, error } = await catalogo().from("trilhas").update(patch).eq("id", id).select("*").single();
  if (error) throw new Error(mensagemDeErroBanco(error));
  return data;
}

export async function definirPublicacaoTrilha(id: string, publicada: boolean): Promise<void> {
  const { error } = await catalogo().from("trilhas").update({ publicada }).eq("id", id);
  if (error) throw new Error(mensagemDeErroBanco(error));
}

export async function apagarTrilha(id: string): Promise<void> {
  const { error } = await catalogo().from("trilhas").delete().eq("id", id);
  if (error) throw new Error(mensagemDeErroBanco(error));
}

export interface DependenteEmOutraTrilha {
  moduloId: string;
  moduloExigidoId: string;
  trilhaNome: string;
  moduloNome: string;
  moduloExigidoNome: string;
}

/**
 * Módulos de OUTRAS trilhas que exigem um módulo desta trilha (ou deste
 * módulo). Despublicar ou apagar desfaz esses vínculos no banco; a tela
 * mostra a lista antes, para a coordenação confirmar.
 */
export async function listarDependentesEmOutrasTrilhas(
  alvo: { trilhaId: string } | { moduloId: string },
): Promise<DependenteEmOutraTrilha[]> {
  const { data, error } = await catalogo().rpc(
    "dependentes_em_outras_trilhas",
    "trilhaId" in alvo ? { p_trilha_id: alvo.trilhaId } : { p_modulo_id: alvo.moduloId },
  );
  if (error) throw new Error(mensagemDeErroBanco(error));
  return (data ?? []).map((d) => ({
    moduloId: d.modulo_dependente_id,
    moduloExigidoId: d.modulo_exigido_id,
    trilhaNome: d.trilha_dependente_nome,
    moduloNome: d.modulo_dependente_nome,
    moduloExigidoNome: d.modulo_exigido_nome,
  }));
}

export async function listarModulosDaTrilha(trilhaId: string): Promise<Modulo[]> {
  const { data, error } = await catalogo()
    .from("modulos")
    .select("*")
    .eq("trilha_id", trilhaId)
    .order("ordem");
  if (error) throw new Error(mensagemDeErroBanco(error));
  return data;
}

export async function proximaOrdemDisponivel(trilhaId: string): Promise<number> {
  const modulos = await listarModulosDaTrilha(trilhaId);
  return modulos.length > 0 ? Math.max(...modulos.map((m) => m.ordem)) + 1 : 1;
}

export async function criarModulo(input: {
  trilhaId: string;
  ordem: number;
  nome: string;
  descricao: string;
  nivel: NivelModulo;
  cargaHorariaHoras: number;
  icone: string | null;
}): Promise<Modulo> {
  const { data, error } = await catalogo()
    .from("modulos")
    .insert({
      trilha_id: input.trilhaId,
      ordem: input.ordem,
      nome: input.nome,
      descricao: input.descricao,
      nivel: input.nivel,
      carga_horaria_horas: input.cargaHorariaHoras,
      icone: input.icone,
    })
    .select("*")
    .single();
  if (error) throw new Error(mensagemDeErroBanco(error));
  return data;
}

export async function atualizarModulo(
  id: string,
  patch: Partial<{
    nome: string;
    descricao: string;
    nivel: NivelModulo;
    carga_horaria_horas: number;
    icone: string | null;
  }>,
): Promise<Modulo> {
  const { data, error } = await catalogo().from("modulos").update(patch).eq("id", id).select("*").single();
  if (error) throw new Error(mensagemDeErroBanco(error));
  return data;
}

export async function apagarModulo(id: string): Promise<void> {
  const { error } = await catalogo().from("modulos").delete().eq("id", id);
  if (error) throw new Error(mensagemDeErroBanco(error));
}

export async function trocarOrdemModulos(moduloA: string, moduloB: string): Promise<void> {
  const { error } = await catalogo().rpc("trocar_ordem_modulos", {
    p_modulo_a: moduloA,
    p_modulo_b: moduloB,
  });
  if (error) throw new Error(mensagemDeErroBanco(error));
}

// Reordena todos os módulos de uma vez (usado pelo drag-and-drop): os ids
// na ordem desejada viram ordem 1..n no banco.
export async function reordenarModulos(idsNaOrdem: string[]): Promise<void> {
  const { error } = await catalogo().rpc("reordenar_modulos", { p_ids: idsNaOrdem });
  if (error) throw new Error(mensagemDeErroBanco(error));
}

// Nome, trilha e slug de cada pré-requisito, que pode ser de outra trilha
// (A15). A função do banco devolve o nome mesmo se a trilha do módulo
// exigido não estiver visível ao aluno — nunca mais "—".
async function listarPreRequisitosDetalhados(moduloIds: string[]): Promise<PreRequisitoDetalhado[]> {
  if (moduloIds.length === 0) return [];
  const { data, error } = await catalogo().rpc("pre_requisitos_detalhados", { p_modulo_ids: moduloIds });
  if (error) throw new Error(mensagemDeErroBanco(error));
  return data ?? [];
}

/** "Módulo" se for da trilha em questão; "Trilha · Módulo" se vier de outra. */
export function rotuloPreRequisito(p: PreRequisitoDetalhado, trilhaId: string | undefined): string {
  return p.trilha_id === trilhaId ? p.nome : `${p.trilha_nome} · ${p.nome}`;
}

export function rotaDoPreRequisito(p: PreRequisitoDetalhado): string {
  return `/catalogo/${p.trilha_slug}/modulos/${p.pre_requisito_id}`;
}

export async function listarPreRequisitosDoModulo(moduloId: string): Promise<PreRequisitoDetalhado[]> {
  return listarPreRequisitosDetalhados([moduloId]);
}

export interface ModuloDeOutraTrilha {
  id: string;
  nome: string;
  trilhaId: string;
  trilhaNome: string;
}

/**
 * Módulos que podem ser pré-requisito vindo de outra trilha: os de trilhas
 * publicadas (o banco recusa os de rascunho), em ordem de trilha e módulo.
 */
export async function listarModulosDeTrilhasPublicadas(): Promise<ModuloDeOutraTrilha[]> {
  const { data, error } = await catalogo()
    .from("modulos")
    .select("id, nome, ordem, trilha_id, trilhas!inner(nome, publicada)")
    .eq("trilhas.publicada", true)
    .order("ordem");
  if (error) throw new Error(mensagemDeErroBanco(error));
  return (data ?? [])
    .map((m) => ({ id: m.id, nome: m.nome, trilhaId: m.trilha_id, trilhaNome: m.trilhas.nome }))
    .sort((a, b) => a.trilhaNome.localeCompare(b.trilhaNome, "pt-BR"));
}

export async function definirPreRequisito(
  moduloId: string,
  preRequisitoId: string,
  ativo: boolean,
): Promise<void> {
  if (ativo) {
    const { error } = await catalogo()
      .from("pre_requisitos_modulo")
      .insert({ modulo_id: moduloId, pre_requisito_id: preRequisitoId });
    if (error) throw new Error(mensagemDeErroBanco(error));
    return;
  }
  const { error } = await catalogo()
    .from("pre_requisitos_modulo")
    .delete()
    .eq("modulo_id", moduloId)
    .eq("pre_requisito_id", preRequisitoId);
  if (error) throw new Error(mensagemDeErroBanco(error));
}

/**
 * modulo_id -> pré-requisitos dele (com nome e trilha), para exibição.
 * `modulos` opcional: quem já tem a lista em cache passa adiante e evita
 * buscá-la de novo antes dos pré-requisitos (uma ida ao banco a menos).
 */
export async function listarPreRequisitosDaTrilha(
  trilhaId: string,
  modulosConhecidos?: Modulo[],
): Promise<Map<string, PreRequisitoDetalhado[]>> {
  const modulos = modulosConhecidos ?? (await listarModulosDaTrilha(trilhaId));
  const resultado = new Map<string, PreRequisitoDetalhado[]>();
  for (const p of await listarPreRequisitosDetalhados(modulos.map((m) => m.id))) {
    const lista = resultado.get(p.modulo_id) ?? [];
    lista.push(p);
    resultado.set(p.modulo_id, lista);
  }
  return resultado;
}

/** modulo_id -> ids dos módulos que são pré-requisito dele — para marcar checkboxes na edição. */
export async function listarPreRequisitosIdsDaTrilha(
  trilhaId: string,
  modulosConhecidos?: Modulo[],
): Promise<Map<string, Set<string>>> {
  const modulos = modulosConhecidos ?? (await listarModulosDaTrilha(trilhaId));
  const moduloIds = modulos.map((m) => m.id);
  if (moduloIds.length === 0) return new Map();

  const { data, error } = await catalogo()
    .from("pre_requisitos_modulo")
    .select("modulo_id, pre_requisito_id")
    .in("modulo_id", moduloIds);
  if (error) throw new Error(mensagemDeErroBanco(error));

  const resultado = new Map<string, Set<string>>();
  for (const linha of data ?? []) {
    const conjunto = resultado.get(linha.modulo_id) ?? new Set<string>();
    conjunto.add(linha.pre_requisito_id);
    resultado.set(linha.modulo_id, conjunto);
  }
  return resultado;
}
