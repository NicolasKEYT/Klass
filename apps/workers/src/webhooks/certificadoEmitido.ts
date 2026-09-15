import type { Context } from "hono";
import { enviarEmail } from "../email/resend";
import type { Env } from "../shared/env";
import { createSupabaseAdmin } from "../shared/supabaseAdmin";

// Payload do Database Webhook do Supabase para o INSERT em
// certificacao.certificados — não é o Row do banco diretamente. Os dados
// congelados (aluno_nome, trilha_nome, hash) já vêm no record, então não
// é preciso reconsultar o banco para montar o e-mail; só o e-mail do
// aluno, que mora em auth.users.
interface PayloadWebhookCertificado {
  type: string;
  table: string;
  schema?: string;
  record: {
    id: string;
    aluno_id: string;
    trilha_id: string;
    hash_publico: string;
    aluno_nome: string;
    trilha_nome: string;
  };
}

function montarEmailCertificadoEmitido(dados: {
  nomeAluno: string;
  nomeTrilha: string;
  hashPublico: string;
  linkCertificados: string;
}): string {
  return (
    `<p>Parabéns, ${dados.nomeAluno}!</p>` +
    `<p>Você concluiu a trilha <strong>${dados.nomeTrilha}</strong> e seu ` +
    `certificado já está disponível.</p>` +
    `<p>Código de verificação: <strong>${dados.hashPublico}</strong></p>` +
    `<p><a href="${dados.linkCertificados}">Acesse seus certificados</a> para ` +
    `baixar o PDF quando quiser.</p>`
  );
}

/**
 * POST /webhooks/certificado-emitido — chamado pelo Database Webhook do
 * Supabase a cada INSERT em certificacao.certificados (emissão automática
 * do MS5). Mesmo padrão do matricula-deferida: valida o header, busca o
 * e-mail do aluno via service role e dispara o Resend.
 */
export async function receberCertificadoEmitido(c: Context<{ Bindings: Env }>) {
  // Mesmo secret do webhook de matrícula — sem isso qualquer um que
  // descobrisse a URL poderia disparar e-mails de certificado.
  const autorizacao = c.req.header("Authorization");
  if (autorizacao !== `Bearer ${c.env.WEBHOOK_SECRET}`) {
    return c.json({ error: "não autorizado" }, 401);
  }

  const payload = await c.req.json<PayloadWebhookCertificado>();

  // Ser defensivo aqui evita mandar e-mail numa configuração errada de
  // painel, mesmo o webhook já devendo disparar só nesse caso.
  if (
    payload.type !== "INSERT" ||
    payload.table !== "certificados" ||
    payload.schema !== "certificacao"
  ) {
    return c.json({ ignorado: true }, 200);
  }

  const admin = createSupabaseAdmin(c.env);

  // E-mail não fica em identidade.profiles — só em auth.users, que só a
  // Admin API (service role) enxerga, não o PostgREST.
  const { data: usuarioAuth, error: erroAuth } = await admin.auth.admin.getUserById(
    payload.record.aluno_id,
  );
  if (erroAuth || !usuarioAuth?.user?.email) {
    console.error("certificado-emitido: e-mail do aluno não encontrado", erroAuth);
    return c.json({ error: "e-mail do aluno não encontrado" }, 500);
  }

  // Link para a tela de certificados do aluno, montado a partir da origem
  // do frontend já configurada no CORS (ALLOWED_ORIGIN = URL do Pages).
  const base = c.env.ALLOWED_ORIGIN ?? "";
  const linkCertificados = `${base}/aluno/certificados`;

  try {
    await enviarEmail(c.env, {
      para: usuarioAuth.user.email,
      assunto: `Parabéns! Seu certificado de ${payload.record.trilha_nome} está pronto`,
      html: montarEmailCertificadoEmitido({
        nomeAluno: payload.record.aluno_nome,
        nomeTrilha: payload.record.trilha_nome,
        hashPublico: payload.record.hash_publico,
        linkCertificados,
      }),
    });
  } catch (erro) {
    // 500 de propósito: o Database Webhook do Supabase tem retry, então
    // uma falha transitória do Resend não perde o e-mail.
    console.error("certificado-emitido: falha ao enviar e-mail", erro);
    return c.json({ error: "falha ao enviar e-mail" }, 500);
  }

  return c.json({ enviado: true }, 200);
}
