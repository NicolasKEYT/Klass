import type { Context } from "hono";
import { caixaDeCodigo, destaque, escaparHtml, montarEmail, paragrafo } from "../email/layout";
import { enviarEmail } from "../email/resend";
import type { Env } from "../shared/env";
import { createSupabaseAdmin } from "../shared/supabaseAdmin";
import { autorizarWebhook, lerCorpoJson } from "../shared/webhook";

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
    // Preenchidos só no certificado de módulo (null no de trilha).
    modulo_id: string | null;
    modulo_nome: string | null;
  };
}

function montarEmailCertificadoEmitido(dados: {
  nomeAluno: string;
  // O "que" foi concluído: a trilha inteira ou um módulo específico. Já é
  // HTML, com os nomes escapados por quem chama.
  oQueConcluiuHtml: string;
  hashPublico: string;
  // Dependem da origem do frontend (ALLOWED_ORIGIN); sem ela, ficam de fora.
  linkCertificados: string | null;
  linkVerificacao: string | null;
}): string {
  return montarEmail({
    preheader: "Seu certificado já está disponível para download.",
    titulo: "Seu certificado está pronto",
    corpoHtml:
      paragrafo(`Parabéns, ${escaparHtml(dados.nomeAluno)}!`) +
      paragrafo(`Você concluiu ${dados.oQueConcluiuHtml} e seu certificado já está disponível.`) +
      paragrafo("Código de verificação:") +
      caixaDeCodigo(escaparHtml(dados.hashPublico)) +
      (dados.linkVerificacao
        ? paragrafo(
            `Qualquer pessoa pode conferir a autenticidade, sem login, em ` +
              `<a href="${escaparHtml(dados.linkVerificacao)}" style="color:#61635C;">${escaparHtml(dados.linkVerificacao)}</a>.`,
          )
        : ""),
    botao: dados.linkCertificados
      ? { texto: "Ver meus certificados", url: dados.linkCertificados }
      : undefined,
  });
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
  if (!autorizarWebhook(c)) {
    return c.json({ error: "não autorizado" }, 401);
  }

  const payload = await lerCorpoJson<PayloadWebhookCertificado>(c);
  if (!payload) {
    return c.json({ error: "corpo JSON inválido" }, 400);
  }

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
  const linkCertificados = base ? `${base}/aluno/certificados` : null;
  const linkVerificacao = base ? `${base}/verificar/${payload.record.hash_publico}` : null;

  // Certificado de módulo vs. de trilha muda o texto e o assunto.
  const ehModulo = payload.record.modulo_id !== null;
  const oQueConcluiuHtml = ehModulo
    ? `o módulo ${destaque(escaparHtml(payload.record.modulo_nome ?? ""))} da trilha ` +
      destaque(escaparHtml(payload.record.trilha_nome))
    : `a trilha ${destaque(escaparHtml(payload.record.trilha_nome))}`;
  const assunto = ehModulo
    ? `Parabéns! Seu certificado do módulo ${payload.record.modulo_nome} está pronto`
    : `Parabéns! Seu certificado de ${payload.record.trilha_nome} está pronto`;

  try {
    await enviarEmail(c.env, {
      para: usuarioAuth.user.email,
      assunto,
      html: montarEmailCertificadoEmitido({
        nomeAluno: payload.record.aluno_nome,
        oQueConcluiuHtml,
        hashPublico: payload.record.hash_publico,
        linkCertificados,
        linkVerificacao,
      }),
    });
  } catch (erro) {
    // 500 para a falha ficar visível no log do Worker. Não há reenvio: a
    // chamada vem do pg_net, que é assíncrono e não tenta de novo (ver
    // CLAUDE.md, "Comunicação entre contextos"), então o e-mail se perde.
    console.error("certificado-emitido: falha ao enviar e-mail", erro);
    return c.json({ error: "falha ao enviar e-mail" }, 500);
  }

  return c.json({ enviado: true }, 200);
}
