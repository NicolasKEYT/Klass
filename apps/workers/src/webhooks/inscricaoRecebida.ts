import type { Context } from "hono";
import { destaque, escaparHtml, montarEmail, paragrafo } from "../email/layout";
import { enviarEmail } from "../email/resend";
import type { Env } from "../shared/env";
import { createSupabaseAdmin } from "../shared/supabaseAdmin";
import { autorizarWebhook, lerCorpoJson } from "../shared/webhook";
import { carregarDadosDaMatricula, type DadosDaMatricula } from "./dadosDaMatricula";

// Payload do INSERT em selecao.matriculas, montado pelo trigger
// `matriculas_notifica_inscricao` (pg_net).
interface PayloadWebhookInscricao {
  type: string;
  table: string;
  schema?: string;
  record: {
    id: string;
    aluno_id: string;
    turma_id: string;
    status: string;
  };
}

function montarEmailInscricaoRecebida(
  dados: DadosDaMatricula,
  // Origem do frontend (ALLOWED_ORIGIN); sem ela não há como montar o link.
  linkInicio: string | null,
): string {
  return montarEmail({
    preheader: `Recebemos sua inscrição em ${dados.nomeModulo}.`,
    titulo: "Inscrição recebida",
    corpoHtml:
      paragrafo(`Olá, ${escaparHtml(dados.nomeAluno)}!`) +
      paragrafo(
        `Recebemos sua inscrição em ${destaque(escaparHtml(dados.nomeModulo))} ` +
          `(${escaparHtml(dados.nomeTrilha)}, turma ${escaparHtml(dados.codigoTurma)}).`,
      ) +
      // Só a aprovação tem e-mail; a rejeição não. Por isso o texto não promete
      // aviso das duas decisões, e manda olhar a situação no sistema.
      paragrafo(
        "A coordenação vai analisar o pedido. Avisaremos por e-mail quando ele for " +
          "aprovado, e você pode acompanhar a situação no Klass a qualquer momento.",
      ),
    botao: linkInicio ? { texto: "Abrir o Klass", url: linkInicio } : undefined,
  });
}

/**
 * POST /webhooks/inscricao-recebida — chamado pelo trigger
 * `matriculas_notifica_inscricao` (pg_net) a cada INSERT em selecao.matriculas
 * com status `inscrita`.
 */
export async function receberInscricaoRecebida(c: Context<{ Bindings: Env }>) {
  // Mesmo segredo dos outros webhooks: sem ele, quem descobrisse a URL
  // dispararia e-mails em nome do Klass.
  if (!autorizarWebhook(c)) {
    return c.json({ error: "não autorizado" }, 401);
  }

  const payload = await lerCorpoJson<PayloadWebhookInscricao>(c);
  if (!payload) {
    return c.json({ error: "corpo JSON inválido" }, 400);
  }

  // O trigger já só dispara nesse caso; defensivo para o caso de ele mudar.
  if (
    payload.type !== "INSERT" ||
    payload.table !== "matriculas" ||
    payload.schema !== "selecao" ||
    payload.record?.status !== "inscrita"
  ) {
    return c.json({ ignorado: true }, 200);
  }

  const admin = createSupabaseAdmin(c.env);
  const carregado = await carregarDadosDaMatricula(admin, payload.record, "inscricao-recebida");
  if ("erro" in carregado) {
    return c.json({ error: carregado.erro }, 500);
  }
  const { dados } = carregado;

  try {
    await enviarEmail(c.env, {
      para: dados.emailAluno,
      assunto: `Inscrição recebida — ${dados.nomeModulo}`,
      html: montarEmailInscricaoRecebida(
        dados,
        c.env.ALLOWED_ORIGIN ? `${c.env.ALLOWED_ORIGIN}/` : null,
      ),
    });
  } catch (erro) {
    // Sem reenvio (pg_net não tenta de novo): o 500 só deixa a falha no log.
    console.error("inscricao-recebida: falha ao enviar e-mail", erro);
    return c.json({ error: "falha ao enviar e-mail" }, 500);
  }

  return c.json({ enviado: true }, 200);
}
