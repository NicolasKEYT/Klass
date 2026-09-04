import type { Context } from "hono";
import { enviarEmail } from "../email/resend";
import type { Env } from "../shared/env";
import { createSupabaseAdmin } from "../shared/supabaseAdmin";

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

function montarEmailMatriculaAprovada(dados: {
  nomeAluno: string;
  nomeTrilha: string;
  codigoTurma: string;
  periodoInicio: string;
}): string {
  const dataFormatada = new Date(dados.periodoInicio).toLocaleDateString("pt-BR", {
    timeZone: "UTC",
  });
  return (
    `<p>Olá, ${dados.nomeAluno}!</p>` +
    `<p>Sua matrícula na trilha <strong>${dados.nomeTrilha}</strong> ` +
    `(turma ${dados.codigoTurma}) foi aprovada.</p>` +
    `<p>As aulas começam em ${dataFormatada}. Seja bem-vindo(a)!</p>`
  );
}

/**
 * POST /webhooks/matricula-deferida — chamado pelo Database Webhook do
 * Supabase a cada UPDATE em selecao.matriculas. Primeiro caso real de
 * Worker sendo acionado por webhook (vira o padrão para MS4/MS5).
 */
export async function receberMatriculaDeferida(c: Context<{ Bindings: Env }>) {
  // Sem isso, qualquer um na internet que descobrisse a URL poderia
  // chamar essa rota — o Database Webhook manda esse header com o
  // mesmo valor configurado no painel do Supabase.
  const autorizacao = c.req.header("Authorization");
  if (autorizacao !== `Bearer ${c.env.WEBHOOK_SECRET}`) {
    return c.json({ error: "não autorizado" }, 401);
  }

  const payload = await c.req.json<PayloadWebhookMatricula>();

  const eraInscrita = payload.old_record?.status === "inscrita";
  const agoraMatriculada = payload.record?.status === "matriculada";

  // O webhook já deveria estar configurado para só disparar nesse caso,
  // mas ser defensivo aqui evita mandar e-mail numa transição errada se
  // a configuração do painel mudar.
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

  const { data: turma, error: erroTurma } = await admin
    .schema("selecao")
    .from("turmas")
    .select("codigo, periodo_inicio, trilha_id")
    .eq("id", payload.record.turma_id)
    .single();
  if (erroTurma || !turma) {
    console.error("matricula-deferida: turma não encontrada", erroTurma);
    return c.json({ error: "turma não encontrada" }, 500);
  }

  const { data: trilha, error: erroTrilha } = await admin
    .schema("catalogo")
    .from("trilhas")
    .select("nome")
    .eq("id", turma.trilha_id)
    .single();
  if (erroTrilha || !trilha) {
    console.error("matricula-deferida: trilha não encontrada", erroTrilha);
    return c.json({ error: "trilha não encontrada" }, 500);
  }

  const { data: perfil, error: erroPerfil } = await admin
    .schema("identidade")
    .from("profiles")
    .select("nome_completo")
    .eq("id", payload.record.aluno_id)
    .single();
  if (erroPerfil || !perfil) {
    console.error("matricula-deferida: profile do aluno não encontrado", erroPerfil);
    return c.json({ error: "aluno não encontrado" }, 500);
  }

  // E-mail não fica em identidade.profiles — só em auth.users, que só a
  // Admin API (service role) enxerga, não o PostgREST.
  const { data: usuarioAuth, error: erroAuth } = await admin.auth.admin.getUserById(
    payload.record.aluno_id,
  );
  if (erroAuth || !usuarioAuth?.user?.email) {
    console.error("matricula-deferida: e-mail do aluno não encontrado", erroAuth);
    return c.json({ error: "e-mail do aluno não encontrado" }, 500);
  }

  try {
    await enviarEmail(c.env, {
      para: usuarioAuth.user.email,
      assunto: `Matrícula aprovada — ${trilha.nome}`,
      html: montarEmailMatriculaAprovada({
        nomeAluno: perfil.nome_completo,
        nomeTrilha: trilha.nome,
        codigoTurma: turma.codigo,
        periodoInicio: turma.periodo_inicio,
      }),
    });
  } catch (erro) {
    // 500 de propósito: o Database Webhook do Supabase tem retry, então
    // uma falha transitória do Resend não perde o e-mail.
    console.error("matricula-deferida: falha ao enviar e-mail", erro);
    return c.json({ error: "falha ao enviar e-mail" }, 500);
  }

  return c.json({ enviado: true }, 200);
}
