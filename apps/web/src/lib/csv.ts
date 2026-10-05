import { formatarDecimal, paraIsoLocal } from "@/lib/formato";

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
export function nomeDoArquivoCsv(partes: string[], data = new Date()): string {
  const slug = partes
    .join(" ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug}-${paraIsoLocal(data)}.csv`;
}

export function baixarCsv<T>(nomeArquivo: string, colunas: ColunaCsv<T>[], linhas: T[]): void {
  const blob = new Blob([gerarCsv(colunas, linhas)], { type: "text/csv;charset=utf-8" });
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
