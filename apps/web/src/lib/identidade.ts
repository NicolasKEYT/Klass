import { supabase } from "@/lib/supabase";
import { mensagemDeErroBanco } from "@/lib/mensagensDeErroBanco";
import type { Papel } from "@klass/types";

// MS1 — Identidade e Acesso: perfis e papéis (tela "Pessoas" da coordenação).
function identidade() {
  if (!supabase) throw new Error("Supabase não configurado.");
  return supabase.schema("identidade");
}

const ROTULO_PAPEL: Record<Papel, string> = {
  aluno: "Aluno(a)",
  professor: "Professor(a)",
  coordenacao: "Coordenação",
};

/** Papel como aparece na interface (o valor cru do banco não é texto de tela). */
export function rotuloDoPapel(papel: Papel): string {
  return ROTULO_PAPEL[papel];
}

export const PAPEIS: Papel[] = ["aluno", "professor", "coordenacao"];

export interface Pessoa {
  id: string;
  nomeCompleto: string;
  papel: Papel;
  /** Data do cadastro (vai no CSV da tela Pessoas). */
  criadoEm: string;
}

// A RLS (profiles_select) só devolve todos os perfis para a coordenação;
// para qualquer outro papel a lista viria só com o próprio perfil.
export async function listarPessoas(): Promise<Pessoa[]> {
  const { data, error } = await identidade()
    .from("profiles")
    .select("id, nome_completo, papel, criado_em")
    .order("nome_completo");
  if (error) throw new Error(mensagemDeErroBanco(error));
  return (data ?? []).map((p) => ({
    id: p.id,
    nomeCompleto: p.nome_completo,
    papel: p.papel,
    criadoEm: p.criado_em,
  }));
}

// Só a coordenação troca papel (trigger profiles_impedir_troca_de_papel).
// O select confirma que a linha mudou: sob RLS, um update sem permissão
// não dá erro, só não altera nada.
export async function alterarPapel(pessoaId: string, papel: Papel): Promise<void> {
  const { data, error } = await identidade()
    .from("profiles")
    .update({ papel })
    .eq("id", pessoaId)
    .select("id");
  if (error) throw new Error(mensagemDeErroBanco(error));
  if (!data || data.length === 0) throw new Error("O papel não foi alterado: você não tem permissão para isso.");
}
