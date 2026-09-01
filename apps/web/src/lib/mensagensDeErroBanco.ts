import { PostgrestError } from "@supabase/supabase-js";

const MENSAGEM_PADRAO = "Não foi possível salvar. Confira os dados e tente novamente.";

// Mapeado pelo nome da constraint, que o Postgres inclui na mensagem de
// erro — mais estável do que tentar casar o texto inteiro.
const REGRAS: Array<{ contem: string; mensagem: string }> = [
  { contem: "trilhas_slug_key", mensagem: "Já existe uma trilha com esse slug." },
  {
    contem: "trilhas_slug_formato",
    mensagem: "O slug só pode ter letras minúsculas, números e hífen.",
  },
  { contem: "trilhas_nome_minimo", mensagem: "O nome precisa ter pelo menos 3 caracteres." },
  {
    contem: "trilhas_descricao_minima",
    mensagem: "A descrição precisa ter pelo menos 10 caracteres.",
  },
  {
    contem: "trilhas_descricao_curta_tamanho",
    mensagem: "A descrição curta pode ter no máximo 200 caracteres.",
  },
  {
    contem: "modulos_trilha_ordem_unica",
    mensagem: "Já existe um módulo nessa posição nesta trilha.",
  },
  { contem: "modulos_ordem_positiva", mensagem: "A ordem precisa ser maior que zero." },
  {
    contem: "modulos_carga_horaria_positiva",
    mensagem: "A carga horária precisa ser maior que zero.",
  },
  {
    contem: "modulos_nome_minimo",
    mensagem: "O nome do módulo precisa ter pelo menos 3 caracteres.",
  },
  {
    contem: "pre_requisitos_nao_autorreferencia",
    mensagem: "Um módulo não pode ser pré-requisito de si mesmo.",
  },
];

export function mensagemDeErroBanco(error: unknown): string {
  if (!(error instanceof PostgrestError)) return MENSAGEM_PADRAO;

  // P0001 são as nossas próprias exceções (triggers) — o texto já foi
  // escrito para o usuário final, não é jargão de banco.
  if (error.code === "P0001") return error.message || MENSAGEM_PADRAO;

  const regra = REGRAS.find((r) => error.message.includes(r.contem));
  return regra?.mensagem ?? MENSAGEM_PADRAO;
}
