import { supabase } from "@/lib/supabase";
import { mensagemDeErroBanco } from "@/lib/mensagensDeErroBanco";
import type { Certificado, CertificadoVerificado } from "@klass/types";

// Ponto único de acesso a certificacao.* — mesmo padrão de lib/selecao.ts
// e lib/diario.ts.
function certificacao() {
  if (!supabase) throw new Error("Supabase não configurado.");
  return supabase.schema("certificacao");
}

// Certificados do aluno logado. A RLS já restringe a tabela aos próprios
// certificados; o filtro por aluno_id é explícito por clareza (e cobre a
// coordenação, que enxergaria todos sem ele).
export async function listarCertificadosDoAluno(alunoId: string): Promise<Certificado[]> {
  const { data, error } = await certificacao()
    .from("certificados")
    .select("*")
    .eq("aluno_id", alunoId)
    .order("emitido_em", { ascending: false });
  if (error) throw new Error(mensagemDeErroBanco(error));
  return data;
}

// Todos os certificados emitidos — só a coordenação passa pela RLS de
// SELECT sem filtro de aluno. aluno_nome e trilha_nome já vêm congelados
// na linha, então a listagem não precisa de nenhum join.
export async function listarTodosCertificados(): Promise<Certificado[]> {
  const { data, error } = await certificacao()
    .from("certificados")
    .select("*")
    .order("emitido_em", { ascending: false });
  if (error) throw new Error(mensagemDeErroBanco(error));
  return data;
}

// Existe algum certificado já emitido para a trilha? Usado na edição de
// trilha para avisar que mudar o tipo de certificação não afeta os
// documentos já emitidos. A RLS deixa a coordenação ver todos.
export async function trilhaTemCertificados(trilhaId: string): Promise<boolean> {
  const { count, error } = await certificacao()
    .from("certificados")
    .select("id", { count: "exact", head: true })
    .eq("trilha_id", trilhaId);
  if (error) throw new Error(mensagemDeErroBanco(error));
  return (count ?? 0) > 0;
}

// Verificação pública: chama a função SECURITY DEFINER exposta ao role
// anon. Não lê a tabela (a RLS bloquearia o visitante sem login) — a
// função devolve só os dados mínimos, filtrados por hash exato. Retorna
// null quando não existe certificado com aquele hash.
export async function verificarPorHash(hash: string): Promise<CertificadoVerificado | null> {
  const { data, error } = await certificacao().rpc("verificar_por_hash", { p_hash: hash });
  if (error) throw new Error(mensagemDeErroBanco(error));
  return data && data.length > 0 ? data[0] : null;
}
