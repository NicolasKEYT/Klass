import type { Context } from "hono";
import { destaque, escaparHtml, montarEmail, paragrafo } from "../email/layout";
import { enviarEmail } from "../email/resend";
import type { Env } from "../shared/env";
import { createSupabaseAdmin } from "../shared/supabaseAdmin";
import { carregarDadosDaMatricula, type DadosDaMatricula } from "./dadosDaMatricula";

// Formato do Database Webhook do Supabase — não é o Row do banco
// diretamente, é o payload que o Postgres manda pro Worker.
interface PayloadWebhookMatricula {
  type: string;
  table: string;
  schema?: string;
  record: {
    id: string;
    aluno_id: string;
    turma_id: string;
    status: string;
  };
  old_record: { status: string } | null;
}

function montarEmailMatriculaAprovada(
  dados: DadosDaMatricula,
  // Origem do frontend (ALLOWED_ORIGIN); sem ela não há como montar o link.
  linkInicio: string | null,
): string {
  const dataFormatada = new Date(dados.periodoInicio).toLocaleDateString("pt-BR", {
    timeZone: "UTC",
  });
  return montarEmail({
    preheader: `Sua matrícula em ${dados.nomeModulo} foi aprovada.`,
    titulo: "Matrícula aprovada",
    corpoHtml:
      paragrafo(`Olá, ${escaparHtml(dados.nomeAluno)}!`) +
      paragrafo(
        `Sua matrícula em ${destaque(escaparHtml(dados.nomeModulo))} ` +
          `(${escaparHtml(dados.nomeTrilha)}, turma ${escaparHtml(dados.codigoTurma)}) foi aprovada.`,
      ) +
      paragrafo(`As aulas começam em ${destaque(escaparHtml(dataFormatada))}. Seja bem-vindo(a)!`),
    botao: linkInicio ? { texto: "Abrir o Klass", url: linkInicio } : undefined,
  });
}

/**
 * POST /webhooks/matricula-deferida — chamado pelo trigger
 * `matriculas_notifica_deferimento` (pg_net) a cada UPDATE em
 * selecao.matriculas que leva `inscrita` a `matriculada`.
 */
export async function receberMatriculaDeferida(c: Context<{ Bindings: Env }>) {
  // Sem isso, qualquer um na internet que descobrisse a URL poderia
  // chamar essa rota — o trigger manda esse header com o segredo do Vault,
  // o mesmo valor do WEBHOOK_SECRET do Worker.
  const autorizacao = c.req.header("Authorization");
  if (autorizacao !== `Bearer ${c.env.WEBHOOK_SECRET}`) {
    return c.json({ error: "não autorizado" }, 401);
  }

  const payload = await c.req.json<PayloadWebhookMatricula>();

  const eraInscrita = payload.old_record?.status === "inscrita";
  const agoraMatriculada = payload.record?.status === "matriculada";

  // O trigger já só dispara nesse caso, mas ser defensivo aqui evita mandar
  // e-mail numa transição errada se o trigger mudar.
  if (
    payload.type !== "UPDATE" ||
    payload.table !== "matriculas" ||
    payload.schema !== "selecao" ||
    !eraInscrita ||
    !agoraMatriculada
  ) {
    return c.json({ ignorado: true }, 200);
  }

  const admin = createSupabaseAdmin(c.env);
  const carregado = await carregarDadosDaMatricula(admin, payload.record, "matricula-deferida");
  if ("erro" in carregado) {
    return c.json({ error: carregado.erro }, 500);
  }
  const { dados } = carregado;

  try {
    await enviarEmail(c.env, {
      para: dados.emailAluno,
      assunto: `Matrícula aprovada — ${dados.nomeModulo}`,
      html: montarEmailMatriculaAprovada(
        dados,
        c.env.ALLOWED_ORIGIN ? `${c.env.ALLOWED_ORIGIN}/` : null,
      ),
    });
  } catch (erro) {
    // 500 para a falha ficar visível no log do Worker. Não há reenvio: a
    // chamada vem do pg_net, que é assíncrono e não tenta de novo (ver
    // CLAUDE.md, "Comunicação entre contextos"), então o e-mail se perde.
    console.error("matricula-deferida: falha ao enviar e-mail", erro);
    return c.json({ error: "falha ao enviar e-mail" }, 500);
  }

  return c.json({ enviado: true }, 200);
}
