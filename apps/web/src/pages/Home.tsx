import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { PaginaAutenticada } from "@/components/PaginaAutenticada";
import { Titulo } from "@/components/Titulo";
import { useAuth } from "@/auth";
import { listarCertificadosDoAluno } from "@/lib/certificacao";
import { listarTrilhas } from "@/lib/catalogo";
import {
  listarMatriculasDoAluno,
  listarTurmasDoProfessor,
  listarTurmasParaCoordenacao,
} from "@/lib/selecao";

// Card de resumo: um número grande, um rótulo e um link para a tela
// relevante. Substitui a home vazia por atalhos úteis conforme o papel.
function CardResumo({
  numero,
  rotulo,
  para,
  acao,
}: {
  numero: ReactNode;
  rotulo: string;
  para: string;
  acao: string;
}) {
  return (
    <Link
      to={para}
      className="flex flex-col gap-1 rounded-klass-card border border-border bg-surface p-5 shadow-klass-card transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-klass-hover"
    >
      <span className="font-serif text-klass-stat text-text-primary">{numero}</span>
      <span className="text-body-sm text-text-secondary">{rotulo}</span>
      <span className="mt-1 text-label font-medium text-primary">{acao} →</span>
    </Link>
  );
}

interface Resumo {
  numero: ReactNode;
  rotulo: string;
  para: string;
  acao: string;
}

export function Home() {
  const { usuario, profile } = useAuth();
  const [resumos, setResumos] = useState<Resumo[] | null>(null);

  useEffect(() => {
    if (!usuario || !profile) return;
    let ativo = true;

    async function carregar() {
      // usuario/profile já garantidos não-nulos pelo guard acima; a
      // narrow do TS não atravessa a função aninhada, daí o `!`.
      const id = usuario!.id;
      const papel = profile!.papel;
      try {
        let lista: Resumo[] = [];
        if (papel === "aluno") {
          const [matriculas, certificados] = await Promise.all([
            listarMatriculasDoAluno(id),
            listarCertificadosDoAluno(id),
          ]);
          const ativas = matriculas.filter((m) => m.status === "matriculada").length;
          lista = [
            {
              numero: ativas,
              rotulo: ativas === 1 ? "módulo em andamento" : "módulos em andamento",
              para: "/aluno/matriculas",
              acao: "Ver matrículas",
            },
            {
              numero: certificados.length,
              rotulo: certificados.length === 1 ? "certificado emitido" : "certificados emitidos",
              para: "/aluno/certificados",
              acao: "Ver certificados",
            },
            {
              numero: "＋",
              rotulo: "explorar novas trilhas",
              para: "/catalogo",
              acao: "Abrir catálogo",
            },
          ];
        } else if (papel === "professor") {
          const turmas = await listarTurmasDoProfessor(id);
          const totalAlunos = turmas.reduce((s, t) => s + t.matriculados, 0);
          lista = [
            {
              numero: turmas.length,
              rotulo: turmas.length === 1 ? "turma sob sua responsabilidade" : "turmas sob sua responsabilidade",
              para: "/professor/turmas",
              acao: "Ver turmas",
            },
            {
              numero: totalAlunos,
              rotulo: "alunos matriculados no total",
              para: "/professor/turmas",
              acao: "Lançar notas e presença",
            },
          ];
        } else if (papel === "coordenacao") {
          const [turmas, trilhas] = await Promise.all([
            listarTurmasParaCoordenacao(),
            listarTrilhas(),
          ]);
          const pendentes = turmas.reduce((s, t) => s + t.pendentes, 0);
          const publicadas = trilhas.filter((t) => t.publicada).length;
          lista = [
            {
              numero: pendentes,
              rotulo: pendentes === 1 ? "inscrição aguardando aprovação" : "inscrições aguardando aprovação",
              para: "/coordenacao/turmas",
              acao: "Aprovar inscrições",
            },
            {
              numero: publicadas,
              rotulo: publicadas === 1 ? "trilha publicada" : "trilhas publicadas",
              para: "/coordenacao/trilhas",
              acao: "Gerenciar trilhas",
            },
            {
              numero: turmas.length,
              rotulo: turmas.length === 1 ? "turma cadastrada" : "turmas cadastradas",
              para: "/coordenacao/turmas",
              acao: "Ver turmas",
            },
          ];
        }
        if (ativo) setResumos(lista);
      } catch {
        // Home é um atalho; se algum resumo falhar, mostra vazio em vez de
        // quebrar a tela inteira.
        if (ativo) setResumos([]);
      }
    }

    void carregar();
    return () => {
      ativo = false;
    };
  }, [usuario, profile]);

  return (
    <PaginaAutenticada>
      <Titulo>Olá, {profile?.nome_completo ?? "..."}!</Titulo>
      <p className="mt-1 text-body-sm text-text-secondary">
        Um resumo rápido do que está sob seu acompanhamento.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {resumos === null &&
          [0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-klass-card border border-border bg-surface-subtle" />
          ))}
        {resumos?.map((resumo) => (
          <CardResumo key={resumo.rotulo} {...resumo} />
        ))}
      </div>
    </PaginaAutenticada>
  );
}
