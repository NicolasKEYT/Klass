// MS3 — Motor de Seleção (schema `selecao`)
// Turmas (uma por módulo) e matrículas. Pré-requisito entre módulos é
// tipo de catalogo (catalogo.pre_requisitos_modulo), não daqui.

import type { Database } from "./database";

export type Turma = Database["selecao"]["Tables"]["turmas"]["Row"];
export type Matricula = Database["selecao"]["Tables"]["matriculas"]["Row"];
export type StatusMatricula = Database["selecao"]["Enums"]["status_matricula"];
