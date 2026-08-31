import type { Env } from "../shared/env";

interface EnviarEmailInput {
  para: string | string[];
  assunto: string;
  html: string;
  remetente?: string;
}

const RESEND_API_URL = "https://api.resend.com/emails";
const REMETENTE_PADRAO = "Klass <no-reply@klass.edu>";

/**
 * Envio genérico via Resend. Os e-mails específicos do domínio (ex.:
 * confirmação de matrícula) entram na fase de cada módulo — esta função
 * ainda não é chamada de lugar nenhum.
 */
export async function enviarEmail(env: Env, input: EnviarEmailInput) {
  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: input.remetente ?? REMETENTE_PADRAO,
      to: input.para,
      subject: input.assunto,
      html: input.html,
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend respondeu ${response.status}: ${await response.text()}`);
  }

  return response.json();
}
