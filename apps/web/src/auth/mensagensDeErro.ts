import { AuthError } from "@supabase/supabase-js";
import { SENHA_MINIMA } from "./senha";

// Nunca expõe a mensagem crua do Supabase (em inglês, às vezes técnica
// demais) — traduz pelos códigos estáveis da API; qualquer código não
// mapeado cai numa mensagem genérica.
const MENSAGENS: Record<string, string> = {
  invalid_credentials: "E-mail ou senha incorretos.",
  email_not_confirmed:
    "Confirme seu e-mail antes de entrar — verifique sua caixa de entrada.",
  user_already_exists: "Já existe uma conta com este e-mail.",
  email_exists: "Já existe uma conta com este e-mail.",
  // O Supabase recusa domínios claramente inválidos/de teste (ex.:
  // example.com) — sem isto o cadastro caía na mensagem genérica.
  email_address_invalid: "Esse e-mail não parece válido. Use um endereço de e-mail real.",
  weak_password: `Senha muito fraca. Use pelo menos ${SENHA_MINIMA} caracteres.`,
  validation_failed: "Confira o e-mail e a senha informados.",
  over_request_rate_limit: "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
  // Limite de envio de e-mail do Supabase (confirmação de cadastro e
  // redefinição de senha): orienta a aguardar em vez de sugerir retry
  // imediato, que falharia de novo.
  over_email_send_rate_limit:
    "Muitos e-mails em pouco tempo. Aguarde alguns minutos e tente de novo.",
  // Troca e redefinição de senha.
  same_password: "A nova senha precisa ser diferente da atual.",
  // Link de redefinição vencido ou já usado: a sessão dele não existe mais.
  session_not_found: "O link expirou. Peça um novo link para redefinir a senha.",
  reauthentication_needed: "Por segurança, entre de novo e repita a troca de senha.",
};

const MENSAGEM_PADRAO = "Não foi possível completar a operação. Tente novamente.";

export function mensagemDeErroAuth(error: unknown): string {
  if (error instanceof AuthError && MENSAGENS[error.code ?? ""]) {
    return MENSAGENS[error.code ?? ""];
  }
  return MENSAGEM_PADRAO;
}
