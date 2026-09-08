// MS4 — Diário de Classe (schema `diario`)
// Avaliações, notas, aulas e presenças.

import type { Database } from "./database";

export type Avaliacao = Database["diario"]["Tables"]["avaliacoes"]["Row"];
export type Nota = Database["diario"]["Tables"]["notas"]["Row"];
export type Aula = Database["diario"]["Tables"]["aulas"]["Row"];
export type Presenca = Database["diario"]["Tables"]["presencas"]["Row"];
