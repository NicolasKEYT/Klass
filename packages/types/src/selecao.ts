// MS3 — Motor de Seleção (schema `selecao`)
// Turmas, matrículas e pré-requisitos entre trilhas.

import type { Database } from "./database";

export type Turma = Database["selecao"]["Tables"]["turmas"]["Row"];
export type Matricula = Database["selecao"]["Tables"]["matriculas"]["Row"];
export type StatusMatricula = Database["selecao"]["Enums"]["status_matricula"];
export type PreRequisitoTrilha =
  Database["selecao"]["Tables"]["pre_requisitos_trilha"]["Row"];
