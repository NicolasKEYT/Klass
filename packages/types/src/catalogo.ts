// MS2 — Catálogo Curricular (schema `catalogo`)
// Trilhas, módulos e pré-requisitos entre módulos.

import type { Database } from "./database";

export type Trilha = Database["catalogo"]["Tables"]["trilhas"]["Row"];
export type Modulo = Database["catalogo"]["Tables"]["modulos"]["Row"];
export type NivelModulo = Database["catalogo"]["Enums"]["nivel_modulo"];
// modulo = um certificado por módulo concluído; trilha = um só ao concluir tudo.
export type TipoCertificacao = Database["catalogo"]["Enums"]["tipo_certificacao"];
export type PreRequisitoModulo =
  Database["catalogo"]["Tables"]["pre_requisitos_modulo"]["Row"];
