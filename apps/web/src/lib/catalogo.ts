import { supabase } from "@/lib/supabase";
import { mensagemDeErroBanco } from "@/lib/mensagensDeErroBanco";
import type { Modulo, NivelModulo, TipoCertificacao, Trilha } from "@klass/types";

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

export async function listarPreRequisitosIds(moduloId: string): Promise<string[]> {
  const { data, error } = await catalogo()
    .from("pre_requisitos_modulo")
    .select("pre_requisito_id")
    .eq("modulo_id", moduloId);
  if (error) throw new Error(mensagemDeErroBanco(error));
  return (data ?? []).map((linha) => linha.pre_requisito_id);
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

/** modulo_id -> nomes dos módulos que são pré-requisito dele, para exibição. */
export async function listarPreRequisitosDaTrilha(
  trilhaId: string,
): Promise<Map<string, string[]>> {
  const modulos = await listarModulosDaTrilha(trilhaId);
  const idParaNome = new Map(modulos.map((m) => [m.id, m.nome]));
  const moduloIds = modulos.map((m) => m.id);
  if (moduloIds.length === 0) return new Map();

  const { data, error } = await catalogo()
    .from("pre_requisitos_modulo")
    .select("modulo_id, pre_requisito_id")
    .in("modulo_id", moduloIds);
  if (error) throw new Error(mensagemDeErroBanco(error));

  const resultado = new Map<string, string[]>();
  for (const linha of data ?? []) {
    const nome = idParaNome.get(linha.pre_requisito_id);
    if (!nome) continue;
    const lista = resultado.get(linha.modulo_id) ?? [];
    lista.push(nome);
    resultado.set(linha.modulo_id, lista);
  }
  return resultado;
}

/** modulo_id -> ids dos módulos que são pré-requisito dele — para marcar checkboxes na edição. */
export async function listarPreRequisitosIdsDaTrilha(
  trilhaId: string,
): Promise<Map<string, Set<string>>> {
  const modulos = await listarModulosDaTrilha(trilhaId);
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
