import type { createSupabaseAdmin } from "../shared/supabaseAdmin";

type ClienteAdmin = ReturnType<typeof createSupabaseAdmin>;

export interface DadosDaMatricula {
  nomeAluno: string;
  emailAluno: string;
  codigoTurma: string;
  periodoInicio: string;
  nomeModulo: string;
  nomeTrilha: string;
}

/**
 * Junta o que os e-mails de matrícula precisam: turma, módulo, trilha, nome e
 * e-mail do aluno. Os dados vêm de vários contextos (selecao, catalogo,
 * identidade) e o e-mail mora em auth.users, que só a Admin API (service role)
 * enxerga, então a busca é aqui e não no banco.
 *
 * Devolve `erro` com a mesma mensagem que o handler responde, em vez de
 * lançar: o handler decide o status HTTP.
 */
export async function carregarDadosDaMatricula(
  admin: ClienteAdmin,
  matricula: { aluno_id: string; turma_id: string },
  origem: string,
): Promise<{ dados: DadosDaMatricula } | { erro: string }> {
  const { data: turma, error: erroTurma } = await admin
    .schema("selecao")
    .from("turmas")
    .select("codigo, periodo_inicio, modulo_id")
    .eq("id", matricula.turma_id)
    .single();
  if (erroTurma || !turma) {
    console.error(`${origem}: turma não encontrada`, erroTurma);
    return { erro: "turma não encontrada" };
  }

  const { data: modulo, error: erroModulo } = await admin
    .schema("catalogo")
    .from("modulos")
    .select("nome, trilha_id")
    .eq("id", turma.modulo_id)
    .single();
  if (erroModulo || !modulo) {
    console.error(`${origem}: módulo não encontrado`, erroModulo);
    return { erro: "módulo não encontrado" };
  }

  const { data: trilha, error: erroTrilha } = await admin
    .schema("catalogo")
    .from("trilhas")
    .select("nome")
    .eq("id", modulo.trilha_id)
    .single();
  if (erroTrilha || !trilha) {
    console.error(`${origem}: trilha não encontrada`, erroTrilha);
    return { erro: "trilha não encontrada" };
  }

  const { data: perfil, error: erroPerfil } = await admin
    .schema("identidade")
    .from("profiles")
    .select("nome_completo")
    .eq("id", matricula.aluno_id)
    .single();
  if (erroPerfil || !perfil) {
    console.error(`${origem}: profile do aluno não encontrado`, erroPerfil);
    return { erro: "aluno não encontrado" };
  }

  const { data: usuarioAuth, error: erroAuth } = await admin.auth.admin.getUserById(
    matricula.aluno_id,
  );
  if (erroAuth || !usuarioAuth?.user?.email) {
    console.error(`${origem}: e-mail do aluno não encontrado`, erroAuth);
    return { erro: "e-mail do aluno não encontrado" };
  }

  return {
    dados: {
      nomeAluno: perfil.nome_completo,
      emailAluno: usuarioAuth.user.email,
      codigoTurma: turma.codigo,
      periodoInicio: turma.periodo_inicio,
      nomeModulo: modulo.nome,
      nomeTrilha: trilha.nome,
    },
  };
}
