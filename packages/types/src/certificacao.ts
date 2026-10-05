// MS5 — Certificação (schema `certificacao`)
// Certificado de conclusão (de trilha ou de módulo), com dados congelados na
// emissão; pode estar revogado (revogado_em preenchido).

import type { Database } from "./database";

export type Certificado = Database["certificacao"]["Tables"]["certificados"]["Row"];

// Dados mínimos devolvidos pela verificação pública (função
// certificacao.verificar_por_hash, exposta ao role anon). O tipo gerado
// marca todas as colunas de retorno como não nulas (o gerador não enxerga
// nulidade em retorno de função); aqui fica o contrato real: módulo e
// turma só existem no certificado de módulo, e revogado_em só se revogado.
type RetornoVerificacao =
  Database["certificacao"]["Functions"]["verificar_por_hash"]["Returns"][number];
export type CertificadoVerificado = Omit<
  RetornoVerificacao,
  "tipo" | "modulo_nome" | "turma_codigo" | "revogado_em"
> & {
  tipo: "modulo" | "trilha";
  modulo_nome: string | null;
  turma_codigo: string | null;
  revogado_em: string | null;
};

// jsonb não tem esquema forte no tipo gerado (metadata: Json), então o
// formato congelado é documentado aqui como interface. Espelha o que
// certificacao.verificar_e_emitir monta na emissão.
export interface MetadataCertificado {
  modulos: Array<{
    nome: string;
    professor: string;
    carga_horaria_horas: number;
    nota_final: number | null;
    periodo_inicio: string;
    periodo_fim: string;
    // Código da turma congelado na emissão (certificados de trilha
    // emitidos a partir de 03/10/2026; os anteriores não têm).
    turma?: string | null;
  }>;
}
