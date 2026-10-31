import type { Sheet } from "write-excel-file/browser";
import { formatarData, formatarDecimal, paraDataLocal, paraIsoLocal } from "@/lib/formato";

// D12 (klass-uikit.pdf) — "toda tabela exporta para CSV ou XLSX". CSV no
// formato que o Excel em português abre certo com um duplo clique:
//  - UTF-8 com BOM: sem ele, o Excel lê o arquivo como Windows-1252 e os
//    acentos viram "Ã§";
//  - separador ";": no Brasil a vírgula é o separador decimal, e o Excel
//    pt-BR espera ponto e vírgula entre colunas;
//  - números com vírgula decimal e datas DD/MM/AAAA, vindos das mesmas
//    funções de lib/formato que a tela usa — o arquivo diz o que a tela diz.
// Gerado no navegador a partir do que já está em cache: nenhuma ida extra
// ao banco, nenhum Worker.

/** Célula: texto vai como está; número sai com vírgula; null/undefined vira vazio. */
export type CelulaCsv = string | number | null | undefined;

export interface ColunaCsv<T> {
  titulo: string;
  valor: (linha: T) => CelulaCsv;
}

const SEPARADOR = ";";
const BOM = "﻿";

function escapar(celula: CelulaCsv): string {
  if (celula === null || celula === undefined) return "";
  const texto = typeof celula === "number" ? formatarDecimal(celula, 2) : celula;
  // Aspas só quando precisa (separador, aspas, quebra de linha). Texto que
  // começa com =, +, - ou @ ganharia vida de fórmula no Excel: um nome
  // digitado como "=HIPERLINK(...)" viraria link. O apóstrofo neutraliza.
  const seguro = /^[=+\-@]/.test(texto) && typeof celula === "string" ? `'${texto}` : texto;
  return /[";\r\n]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

export function gerarCsv<T>(colunas: ColunaCsv<T>[], linhas: T[]): string {
  const cabecalho = colunas.map((c) => escapar(c.titulo)).join(SEPARADOR);
  const corpo = linhas.map((l) => colunas.map((c) => escapar(c.valor(l))).join(SEPARADOR));
  // CRLF: o fim de linha que o Excel no Windows espera.
  return BOM + [cabecalho, ...corpo].join("\r\n") + "\r\n";
}

/**
 * "Notas CDA-2026/1" → "notas-cda-2026-1-2026-10-03.csv". A data vai em
 * AAAA-MM-DD no nome (ordena certo na pasta); dentro do arquivo, DD/MM/AAAA.
 */
export function nomeDoArquivo(partes: string[], extensao: "csv" | "xlsx", data = new Date()): string {
  const slug = partes
    .join(" ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug}-${paraIsoLocal(data)}.${extensao}`;
}

export function nomeDoArquivoCsv(partes: string[], data = new Date()): string {
  return nomeDoArquivo(partes, "csv", data);
}

function baixarBlob(nomeArquivo: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoga depois: alguns navegadores ainda leem o blob após o clique.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function baixarCsv<T>(nomeArquivo: string, colunas: ColunaCsv<T>[], linhas: T[]): void {
  baixarBlob(nomeArquivo, new Blob([gerarCsv(colunas, linhas)], { type: "text/csv;charset=utf-8" }));
}

// --- Colunas tipadas, para o mesmo conjunto sair em CSV e em XLSX ----------

/** "data" recebe "AAAA-MM-DD" ou instante ISO; no XLSX vira data de verdade, no CSV DD/MM/AAAA. */
export type TipoColuna = "texto" | "inteiro" | "decimal" | "data";

export interface ColunaTipada<T> {
  titulo: string;
  tipo: TipoColuna;
  valor: (linha: T) => string | number | null;
}

export function colunasParaCsv<T>(colunas: ColunaTipada<T>[]): ColunaCsv<T>[] {
  return colunas.map((c) => ({
    titulo: c.titulo,
    valor: (linha) => {
      const v = c.valor(linha);
      return c.tipo === "data" && typeof v === "string" ? formatarData(v) : v;
    },
  }));
}

export interface AbaXlsx<T> {
  nome: string;
  colunas: ColunaTipada<T>[];
  linhas: T[];
}

const LARGURA_MAXIMA = 40;

function celulaXlsx(tipo: TipoColuna, v: string | number | null) {
  if (v === null || v === undefined || v === "") return null;
  if (tipo === "data") {
    // Excel não guarda fuso: grava o dia local como se fosse UTC, e o formato
    // da célula mostra esse mesmo dia, sem deslocar para o dia anterior.
    const d = paraDataLocal(String(v));
    return { value: new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())), type: Date, format: "dd/mm/yyyy" };
  }
  if (tipo === "texto") return { value: String(v), type: String };
  return { value: Number(v), type: Number, format: tipo === "inteiro" ? "0" : "0.00" };
}

function montarAba<T>({ nome, colunas, linhas }: AbaXlsx<T>): Sheet<Blob> {
  const cabecalho = colunas.map((c) => ({ value: c.titulo, type: String, fontWeight: "bold" as const }));
  const corpo = linhas.map((l) => colunas.map((c) => celulaXlsx(c.tipo, c.valor(l))));
  const larguras = colunas.map((c, i) => {
    const maior = Math.max(c.titulo.length, ...corpo.map((r) => String(r[i]?.value instanceof Date ? "00/00/0000" : (r[i]?.value ?? "")).length));
    return { width: Math.min(maior + 2, LARGURA_MAXIMA) };
  });
  return { sheet: nome, data: [cabecalho, ...corpo], columns: larguras, stickyRowsCount: 1 } as Sheet<Blob>;
}

/**
 * Uma aba por conjunto. A biblioteca só é baixada no primeiro clique: ela não
 * pesa no carregamento inicial da tela.
 */
export async function gerarXlsx(abas: AbaXlsx<never>[]): Promise<Blob> {
  const { default: escrever } = await import("write-excel-file/browser");
  return escrever(abas.map(montarAba)).toBlob();
}

export async function baixarXlsx(nomeArquivo: string, abas: AbaXlsx<never>[]): Promise<void> {
  baixarBlob(nomeArquivo, await gerarXlsx(abas));
}
