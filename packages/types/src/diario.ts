// MS4 — Diário de Classe (schema `diario`)
// Avaliações, notas, aulas e presenças.

import type { Database } from "./database";

export type Avaliacao = Database["diario"]["Tables"]["avaliacoes"]["Row"];
export type Nota = Database["diario"]["Tables"]["notas"]["Row"];
export type Aula = Database["diario"]["Tables"]["aulas"]["Row"];
export type Presenca = Database["diario"]["Tables"]["presencas"]["Row"];

// Auditoria de encerrar / desfazer / reativar turma. Escrita só pelas
// funções do diário; lida pela coordenação e pelo professor da turma.
export type HistoricoEncerramento = Database["diario"]["Tables"]["historico_encerramentos"]["Row"];
export type AcaoEncerramento = Database["diario"]["Enums"]["acao_encerramento"];

// Situação da chamada de uma aula, decidida pelo banco (campo calculado
// diario.situacao_chamada): futura (ninguém faz chamada), aberta (até 7
// dias após a aula), liberada (a coordenação liberou por mais 7 dias) ou
// encerrada (prazo terminou; só a coordenação altera ou libera).
export type SituacaoChamada = "futura" | "aberta" | "liberada" | "encerrada";

// Aula lida com os dois campos calculados do prazo da chamada
// (select=*,situacao_chamada,chamada_aberta_ate).
export type AulaComPrazo = Aula & {
  situacao_chamada: SituacaoChamada;
  /** Último dia (AAAA-MM-DD) em que o professor ainda pode mexer na chamada. */
  chamada_aberta_ate: string;
};

// Material da turma (arquivo no bucket privado "materiais", em <turma_id>/...).
export type Material = Database["diario"]["Tables"]["materiais"]["Row"];
