// MS2 — Catálogo Curricular (schema `catalogo`)
// Trilhas, módulos e pré-requisitos entre módulos.

import type { Database } from "./database";

export type Trilha = Database["catalogo"]["Tables"]["trilhas"]["Row"];
export type Modulo = Database["catalogo"]["Tables"]["modulos"]["Row"];
export type NivelModulo = Database["catalogo"]["Enums"]["nivel_modulo"];
// modulo = um certificado por módulo concluído; trilha = um só ao concluir tudo;
// modulo_e_trilha = os dois (o da trilha sai ao concluir o último módulo).
export type TipoCertificacao = Database["catalogo"]["Enums"]["tipo_certificacao"];
export type PreRequisitoModulo =
  Database["catalogo"]["Tables"]["pre_requisitos_modulo"]["Row"];
// Pré-requisito com nome, trilha e slug (pode ser de outra trilha), para
// exibir "Trilha · Módulo" e linkar a página do módulo exigido.
export type PreRequisitoDetalhado =
  Database["catalogo"]["Functions"]["pre_requisitos_detalhados"]["Returns"][number];

// Avaliação padrão de um módulo (título, peso, ordem): copiada para cada
// turma nova do módulo pelo diário; turmas existentes não mudam.
export type AvaliacaoModelo = Database["catalogo"]["Tables"]["avaliacoes_modelo"]["Row"];
