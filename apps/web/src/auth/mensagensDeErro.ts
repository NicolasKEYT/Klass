import { AuthError } from "@supabase/supabase-js";

// Nunca expõe a mensagem crua do Supabase (em inglês, às vezes técnica
// demais) — traduz pelos códigos estáveis da API; qualquer código não
// mapeado cai numa mensagem genérica.
const MENSAGENS: Record<string, string> = {
  invalid_credentials: "E-mail ou senha incorretos.",
  email_not_confirmed:
    "Confirme seu e-mail antes de entrar — verifique sua caixa de entrada.",
  user_already_exists: "Já existe uma conta com este e-mail.",
  weak_password: "Senha muito fraca. Use pelo menos 6 caracteres.",
  validation_failed: "Confira o e-mail e a senha informados.",
  over_request_rate_limit: "Muitas tentativas. Aguarde um momento e tente de novo.",
  over_email_send_rate_limit: "Muitas tentativas. Aguarde um momento e tente de novo.",
};

const MENSAGEM_PADRAO = "Não foi possível completar a operação. Tente novamente.";

export function mensagemDeErroAuth(error: unknown): string {
  if (error instanceof AuthError && MENSAGENS[error.code ?? ""]) {
    return MENSAGENS[error.code ?? ""];
  }
  return MENSAGEM_PADRAO;
}
