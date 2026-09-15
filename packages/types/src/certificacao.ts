// MS5 — Certificação (schema `certificacao`)
// Certificado de conclusão de trilha, com dados congelados na emissão.

import type { Database } from "./database";

export type Certificado = Database["certificacao"]["Tables"]["certificados"]["Row"];

// Dados mínimos devolvidos pela verificação pública (função
// certificacao.verificar_por_hash, exposta ao role anon).
export type CertificadoVerificado =
  Database["certificacao"]["Functions"]["verificar_por_hash"]["Returns"][number];

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
  }>;
}
