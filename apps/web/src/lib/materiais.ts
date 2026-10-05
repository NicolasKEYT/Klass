import { supabase } from "@/lib/supabase";
import { mensagemDeErroBanco } from "@/lib/mensagensDeErroBanco";
import { buscarNomesCompletos } from "@/lib/selecao";
import type { Material } from "@klass/types";

// MS4 — materiais da turma. O arquivo vai para o bucket PRIVADO
// "materiais" (Supabase Storage), em <turma_id>/<id>-<nome>; a linha em
// diario.materiais é o registro (título, quem enviou, quando). As políticas
// do bucket e a RLS da tabela decidem quem envia/apaga (professor da turma
// e coordenação) e quem lê (esses e o aluno com matrícula na turma). Os
// limites abaixo repetem os do banco só para avisar antes do upload — a
// garantia é do bucket e da tabela.

const BUCKET = "materiais";
export const TAMANHO_MAXIMO_MATERIAL = 20 * 1024 * 1024;

// Tipo → rótulo curto. A mesma lista de diario.tipos_material_permitidos().
export const TIPOS_MATERIAL: Record<string, string> = {
  "application/pdf": "PDF",
  "image/png": "Imagem",
  "image/jpeg": "Imagem",
  "image/webp": "Imagem",
  "application/msword": "Documento",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Documento",
  "application/vnd.oasis.opendocument.text": "Documento",
  "application/vnd.ms-excel": "Planilha",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Planilha",
  "application/vnd.oasis.opendocument.spreadsheet": "Planilha",
  "application/vnd.ms-powerpoint": "Apresentação",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "Apresentação",
  "application/vnd.oasis.opendocument.presentation": "Apresentação",
  "application/zip": "ZIP",
  "application/x-zip-compressed": "ZIP",
};

/** Extensões aceitas no seletor de arquivo (atributo accept). */
export const ACEITOS_MATERIAL =
  ".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.odt,.xls,.xlsx,.ods,.ppt,.pptx,.odp,.zip";

/** Motivo de recusa antes do envio, ou null se o arquivo pode ir. */
export function validarArquivoMaterial(arquivo: File): string | null {
  if (!TIPOS_MATERIAL[arquivo.type]) {
    return "Tipo de arquivo não aceito. Envie PDF, imagem (PNG, JPG, WEBP), documento, planilha, apresentação ou ZIP.";
  }
  if (arquivo.size > TAMANHO_MAXIMO_MATERIAL) return "O arquivo passa de 20 MB.";
  if (arquivo.size === 0) return "O arquivo está vazio.";
  return null;
}

/** PDF e imagem abrem no navegador; o resto é baixado. */
export function abreNoNavegador(tipoMime: string): boolean {
  return tipoMime === "application/pdf" || tipoMime.startsWith("image/");
}

export function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

function cliente() {
  if (!supabase) throw new Error("Supabase não configurado.");
  return supabase;
}

export interface MaterialListado extends Material {
  enviadoPorNome: string | null;
}

export async function listarMateriaisDaTurma(turmaId: string): Promise<MaterialListado[]> {
  const { data, error } = await cliente()
    .schema("diario")
    .from("materiais")
    .select("*")
    .eq("turma_id", turmaId)
    .order("enviado_em", { ascending: false });
  if (error) throw new Error(mensagemDeErroBanco(error));
  const nomes = await buscarNomesCompletos([...new Set(data.map((m) => m.enviado_por))]);
  return data.map((m) => ({ ...m, enviadoPorNome: nomes.get(m.enviado_por) ?? null }));
}

// Nome do arquivo no Storage: só caracteres seguros (o nome original fica
// em nome_arquivo, para o download).
function nomeSeguro(nome: string): string {
  const limpo = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(-80);
  return limpo || "arquivo";
}

/**
 * Envia o arquivo com progresso (XHR direto na API do Storage — o SDK não
 * expõe progresso de upload) e registra o material. Se o registro falhar,
 * o arquivo enviado é apagado para não sobrar órfão.
 */
export async function enviarMaterial(input: {
  turmaId: string;
  titulo: string;
  arquivo: File;
  aoProgresso?: (fracao: number) => void;
}): Promise<void> {
  const sb = cliente();
  const motivo = validarArquivoMaterial(input.arquivo);
  if (motivo) throw new Error(motivo);
  const { data: sessao } = await sb.auth.getSession();
  const token = sessao.session?.access_token;
  if (!token) throw new Error("Sessão expirada. Entre de novo.");

  const caminho = `${input.turmaId}/${crypto.randomUUID()}-${nomeSeguro(input.arquivo.name)}`;
  const url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/${BUCKET}/${caminho.split("/").map(encodeURIComponent).join("/")}`;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("Content-Type", input.arquivo.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) input.aoProgresso?.(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let mensagem = "Não foi possível enviar o arquivo.";
      try {
        const corpo = JSON.parse(xhr.responseText) as { message?: string; error?: string };
        const texto = `${corpo.message ?? ""} ${corpo.error ?? ""}`.toLowerCase();
        if (texto.includes("mime") || texto.includes("type")) mensagem = "Tipo de arquivo não aceito pelo armazenamento.";
        else if (texto.includes("size") || texto.includes("large") || xhr.status === 413) mensagem = "O arquivo passa de 20 MB.";
        else if (xhr.status === 403 || texto.includes("row-level security")) mensagem = "Você não pode enviar materiais para esta turma.";
      } catch {
        // resposta sem JSON: fica a mensagem genérica
      }
      reject(new Error(mensagem));
    };
    xhr.onerror = () => reject(new Error("Falha de rede ao enviar o arquivo."));
    xhr.send(input.arquivo);
  });

  const { error } = await sb
    .schema("diario")
    .from("materiais")
    .insert({
      turma_id: input.turmaId,
      titulo: input.titulo.trim() || input.arquivo.name,
      caminho,
      nome_arquivo: input.arquivo.name,
      // Tamanho e tipo são reescritos pelo banco a partir do objeto gravado.
      tipo_mime: input.arquivo.type,
      tamanho_bytes: input.arquivo.size,
    });
  if (error) {
    await sb.storage.from(BUCKET).remove([caminho]);
    throw new Error(mensagemDeErroBanco(error));
  }
}

export async function renomearMaterial(id: string, titulo: string): Promise<void> {
  const { error } = await cliente().schema("diario").from("materiais").update({ titulo: titulo.trim() }).eq("id", id);
  if (error) throw new Error(mensagemDeErroBanco(error));
}

// O Storage responde "Object not found" (404 / NoSuchKey) para arquivo
// que já não existe no bucket.
function arquivoNaoExiste(erro: { message?: string; statusCode?: string; code?: string }): boolean {
  return erro.statusCode === "404" || erro.code === "NoSuchKey" || /not found/i.test(erro.message ?? "");
}

/**
 * Apaga o arquivo e só depois o registro: na ordem inversa, uma falha no
 * Storage deixava um arquivo órfão que ninguém mais via nem apagava. Se o
 * arquivo já não existe, o remove não acusa erro e o registro sai assim mesmo.
 */
export async function apagarMaterial(material: Pick<Material, "id" | "caminho">): Promise<void> {
  const sb = cliente();
  const { error: erroArquivo } = await sb.storage.from(BUCKET).remove([material.caminho]);
  if (erroArquivo && !arquivoNaoExiste(erroArquivo)) {
    throw new Error("Não foi possível apagar o arquivo do material. Nada foi apagado; tente de novo.");
  }
  const { error } = await sb.schema("diario").from("materiais").delete().eq("id", material.id);
  if (error) throw new Error(`O arquivo foi apagado, mas o registro não: ${mensagemDeErroBanco(error)}`);
}

/**
 * URL assinada de curta duração (2 min). Para abrir no navegador (PDF e
 * imagem) ou para baixar com o nome original do arquivo.
 */
export async function urlDoMaterial(material: Pick<Material, "caminho" | "nome_arquivo">, baixar: boolean): Promise<string> {
  const { data, error } = await cliente()
    .storage.from(BUCKET)
    .createSignedUrl(material.caminho, 120, baixar ? { download: material.nome_arquivo } : undefined);
  if (error && arquivoNaoExiste(error)) {
    throw new Error("O arquivo deste material não está mais disponível. Peça ao professor que o envie de novo.");
  }
  if (error || !data) throw new Error("Não foi possível abrir o material. Tente de novo.");
  return data.signedUrl;
}
