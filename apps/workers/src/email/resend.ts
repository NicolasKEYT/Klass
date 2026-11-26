import type { Env } from "../shared/env";

interface EnviarEmailInput {
  para: string | string[];
  assunto: string;
  html: string;
  remetente?: string;
}

const RESEND_API_URL = "https://api.resend.com/emails";
// Remetente vem da variável EMAIL_REMETENTE do Worker (ex.:
// "Klass <no-reply@dominio-verificado>"). Sem ela, cai no remetente
// compartilhado de teste do Resend, que funciona sem domínio próprio mas
// SÓ entrega para o e-mail dono da conta Resend — por isso, em produção,
// é preciso verificar um domínio em resend.com/domains, definir
// EMAIL_REMETENTE (wrangler secret put ou [vars]) e publicar o Worker.
const REMETENTE_PADRAO = "Klass <onboarding@resend.dev>";

/**
 * Envio genérico via Resend, usado pelos três webhooks (inscrição recebida,
 * matrícula deferida e certificado emitido).
 */
export async function enviarEmail(env: Env, input: EnviarEmailInput) {
  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: input.remetente ?? (env.EMAIL_REMETENTE?.trim() || REMETENTE_PADRAO),
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
