const MENSAGEM_PADRAO = "Não foi possível salvar. Confira os dados e tente novamente.";

// O módulo de auth do supabase-js lança classes de erro de verdade
// (AuthApiError extends AuthError), então "instanceof AuthError" funciona
// (ver mensagensDeErro.ts). O PostgREST NÃO: `{ data, error }` de uma
// query devolve `error` como objeto plano — mesmo formato de
// PostgrestError (message/code/details/hint), mas com
// `error.constructor.name === "Object"`, não a classe. Um
// "instanceof PostgrestError" aqui nunca bate, e a função caía sempre no
// fallback genérico — confirmado com uma query real contra o banco.
// Por isso o shape é checado por duck typing, não pela classe.
function pareceErroDoPostgrest(
  error: unknown,
): error is { message: string; code?: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  );
}

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
  { contem: "turmas_codigo_key", mensagem: "Já existe uma turma com esse código." },
  {
    contem: "turmas_codigo_formato",
    mensagem: "O código precisa seguir o padrão SIGLA-ANO-SEQUÊNCIA, ex.: CDA-2026-1.",
  },
  { contem: "turmas_periodo_valido", mensagem: "O período final precisa vir depois do início." },
  { contem: "turmas_vagas_positivas", mensagem: "O número de vagas precisa ser maior que zero." },
  {
    contem: "matriculas_aluno_turma_unica",
    mensagem: "Você já tem uma inscrição para esta turma.",
  },
  {
    contem: "matriculas_motivo_rejeicao_obrigatorio",
    mensagem: "Informe o motivo da rejeição.",
  },
  {
    contem: "pre_requisitos_trilha_nao_autorreferencia",
    mensagem: "Uma trilha não pode ser pré-requisito de si mesma.",
  },
];

export function mensagemDeErroBanco(error: unknown): string {
  if (!pareceErroDoPostgrest(error)) return MENSAGEM_PADRAO;

  // P0001 são as nossas próprias exceções (triggers) — o texto já foi
  // escrito para o usuário final, não é jargão de banco.
  if (error.code === "P0001") return error.message || MENSAGEM_PADRAO;

  const regra = REGRAS.find((r) => error.message.includes(r.contem));
  return regra?.mensagem ?? MENSAGEM_PADRAO;
}
