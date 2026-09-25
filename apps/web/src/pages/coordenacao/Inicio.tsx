import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { Badge } from "@/components/Badge";
import { BarraDeMeta } from "@/components/BarraDeMeta";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Titulo } from "@/components/Titulo";
import { listarTrilhas } from "@/lib/catalogo";
import {
  buscarAlunosPorNome,
  buscarIndicadoresCoordenacao,
  listarPendenciasCoordenacao,
  listarTurmasEmAndamento,
  type IndicadoresCoordenacao,
  type PendenciaCoordenacao,
  type ResultadoBuscaAluno,
  type TurmaEmAndamento,
} from "@/lib/painelCoordenacao";
import type { Trilha } from "@klass/types";

const TEXTO_PENDENCIA: Record<PendenciaCoordenacao["tipo"], (q: number) => string> = {
  inscricoes: (q) => `${q} inscrição(ões) para aprovar`,
  chamadas_atrasadas: (q) => `${q} chamada(s) atrasada(s)`,
  turmas_terminando: (q) => `${q} turma(s) terminando`,
};

const LINK_PENDENCIA: Record<PendenciaCoordenacao["tipo"], string> = {
  inscricoes: "/coordenacao/turmas",
  chamadas_atrasadas: "/coordenacao/turmas",
  turmas_terminando: "/coordenacao/turmas",
};

// D7 (klass-uikit.pdf) — painel "Início" da coordenação: busca global,
// "Precisa de você" (pendências acionáveis), três indicadores em barra
// contra meta, e a tabela de turmas em andamento.
//
// Decisão própria: o wireframe original mostra 4 cards em "Precisa de
// você", incluindo "turma sem professor" e "certificados prontos para
// emitir". Nenhum dos dois corresponde a um estado real do sistema —
// selecao.turmas.professor_id é NOT NULL (toda turma já nasce com
// professor), e certificacao.certificados é emitido automaticamente por
// trigger, sem etapa manual de "emitir". Em vez de fingir uma ação que
// não existe, o painel mostra só os 3 cards com dado e ação reais.
export function Inicio() {
  const [indicadores, setIndicadores] = useState<IndicadoresCoordenacao | null>(null);
  const [pendencias, setPendencias] = useState<PendenciaCoordenacao[] | null>(null);
  const [turmas, setTurmas] = useState<TurmaEmAndamento[] | null>(null);
  const [trilhas, setTrilhas] = useState<Trilha[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  const [termoBusca, setTermoBusca] = useState("");
  const [alunosEncontrados, setAlunosEncontrados] = useState<ResultadoBuscaAluno[]>([]);

  useEffect(() => {
    Promise.all([
      buscarIndicadoresCoordenacao(),
      listarPendenciasCoordenacao(),
      listarTurmasEmAndamento(),
      listarTrilhas(),
    ])
      .then(([ind, pend, turm, tril]) => {
        setIndicadores(ind);
        setPendencias(pend);
        setTurmas(turm);
        setTrilhas(tril);
      })
      .catch((e) => setErro(e instanceof Error ? e.message : "Não foi possível carregar o painel."));
  }, []);

  useEffect(() => {
    if (termoBusca.trim().length < 2) {
      setAlunosEncontrados([]);
      return;
    }
    let ativo = true;
    const debounce = setTimeout(() => {
      buscarAlunosPorNome(termoBusca)
        .then((r) => ativo && setAlunosEncontrados(r))
        .catch(() => ativo && setAlunosEncontrados([]));
    }, 300);
    return () => {
      ativo = false;
      clearTimeout(debounce);
    };
  }, [termoBusca]);

  const turmasFiltradas = (turmas ?? []).filter(
    (t) =>
      termoBusca.trim().length < 2 ||
      t.codigo.toLowerCase().includes(termoBusca.toLowerCase()) ||
      t.moduloNome.toLowerCase().includes(termoBusca.toLowerCase()) ||
      t.trilhaNome.toLowerCase().includes(termoBusca.toLowerCase()),
  );
  const trilhasFiltradas = trilhas.filter((t) =>
    termoBusca.trim().length >= 2 ? t.nome.toLowerCase().includes(termoBusca.toLowerCase()) : false,
  );
  const mostrandoBusca = termoBusca.trim().length >= 2;

  return (
    <>
      <div className="mb-6 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <Titulo>Início</Titulo>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <Input
            className="pl-9"
            type="search"
            placeholder="Buscar aluno, turma ou trilha"
            value={termoBusca}
            onChange={(e) => setTermoBusca(e.target.value)}
          />
        </div>
      </div>

      {erro && <p className="mb-4 text-body-sm text-danger">{erro}</p>}

      {mostrandoBusca ? (
        <div className="flex flex-col gap-6">
          <div>
            <p className="mb-2 text-label font-medium text-text-muted">Alunos</p>
            {alunosEncontrados.length === 0 && (
              <p className="text-body-sm text-text-secondary">Nenhum aluno encontrado.</p>
            )}
            <div className="flex flex-col gap-2">
              {alunosEncontrados.map((a) => (
                <Card key={a.id} className="text-body-sm text-text-primary">
                  {a.nomeCompleto}
                </Card>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-label font-medium text-text-muted">Turmas</p>
            {turmasFiltradas.length === 0 && (
              <p className="text-body-sm text-text-secondary">Nenhuma turma encontrada.</p>
            )}
            <div className="flex flex-col gap-2">
              {turmasFiltradas.map((t) => (
                <Link key={t.id} to={`/coordenacao/turmas/${t.id}`}>
                  <Card className="text-body-sm text-text-primary hover:shadow-klass-hover">
                    {t.codigo} · {t.moduloNome} · {t.trilhaNome}
                  </Card>
                </Link>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-label font-medium text-text-muted">Trilhas</p>
            {trilhasFiltradas.length === 0 && (
              <p className="text-body-sm text-text-secondary">Nenhuma trilha encontrada.</p>
            )}
            <div className="flex flex-col gap-2">
              {trilhasFiltradas.map((t) => (
                <Link key={t.id} to={`/coordenacao/trilhas/${t.slug}/editar`}>
                  <Card className="text-body-sm text-text-primary hover:shadow-klass-hover">{t.nome}</Card>
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          <Titulo nivel="secao" className="mb-3">
            Precisa de você
          </Titulo>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            {pendencias === null && !erro && (
              <p className="text-body-sm text-text-secondary">Carregando...</p>
            )}
            {pendencias?.length === 0 && (
              <p className="text-body-sm text-text-secondary sm:col-span-3">
                Nenhuma pendência no momento.
              </p>
            )}
            {pendencias?.map((p) => (
              <Card key={p.tipo} className="flex flex-col gap-2">
                <span className="font-mono text-klass-stat font-semibold tabular-nums text-text-primary">
                  {p.quantidade}
                </span>
                <p className="text-body-sm text-text-secondary">{TEXTO_PENDENCIA[p.tipo](p.quantidade)}</p>
                <p className="text-label text-text-muted">{p.detalhe}</p>
                <Link to={LINK_PENDENCIA[p.tipo]}>
                  <Button variant="secondary" className="mt-1 w-full">
                    Revisar
                  </Button>
                </Link>
              </Card>
            ))}
          </div>

          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <Card>
              <p className="text-label font-medium text-text-muted">Frequência média</p>
              <p className="mt-1 font-mono text-klass-stat font-semibold tabular-nums text-text-primary">
                {indicadores?.frequenciaMedia !== null && indicadores?.frequenciaMedia !== undefined
                  ? `${indicadores.frequenciaMedia.toFixed(0)}%`
                  : "—"}
              </p>
              <p className="mb-2 text-label text-text-muted">mínimo 75%</p>
              <BarraDeMeta
                valor={indicadores?.frequenciaMedia ?? 0}
                meta={75}
                rotulo="Frequência média da instituição"
              />
              {indicadores && indicadores.alunosAbaixoDoMinimo > 0 && (
                <p className="mt-2 text-label text-text-muted">
                  {indicadores.alunosAbaixoDoMinimo} aluno(s) abaixo do mínimo
                </p>
              )}
            </Card>
            <Card>
              <p className="text-label font-medium text-text-muted">Aprovação nos módulos encerrados</p>
              <p className="mt-1 font-mono text-klass-stat font-semibold tabular-nums text-text-primary">
                {indicadores?.aprovacaoModulosEncerrados !== null &&
                indicadores?.aprovacaoModulosEncerrados !== undefined
                  ? `${indicadores.aprovacaoModulosEncerrados.toFixed(0)}%`
                  : "—"}
              </p>
              <p className="mb-2 text-label text-text-muted">vw_desempenho_por_trilha</p>
              <BarraDeMeta
                valor={indicadores?.aprovacaoModulosEncerrados ?? 0}
                meta={80}
                rotulo="Aprovação nos módulos encerrados"
              />
            </Card>
            <Card>
              <p className="text-label font-medium text-text-muted">
                Evasão {indicadores?.periodoEvasao ? `(${indicadores.periodoEvasao})` : "no semestre"}
              </p>
              <p className="mt-1 font-mono text-klass-stat font-semibold tabular-nums text-text-primary">
                {indicadores?.evasaoSemestreAtual !== null && indicadores?.evasaoSemestreAtual !== undefined
                  ? `${indicadores.evasaoSemestreAtual.toFixed(0)}%`
                  : "—"}
              </p>
              <p className="mb-2 text-label text-text-muted">vw_taxa_evasao</p>
              <BarraDeMeta
                valor={indicadores?.evasaoSemestreAtual ?? 0}
                meta={10}
                rotulo="Evasão no semestre"
              />
            </Card>
          </div>

          <Titulo nivel="secao" className="mb-3">
            Turmas em andamento
          </Titulo>
          <Card className="overflow-hidden !px-0 !py-0">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border text-label text-text-muted">
                  <th className="px-4 py-3 font-medium">Turma</th>
                  <th className="px-4 py-3 font-medium">Módulo</th>
                  <th className="px-4 py-3 font-medium">Professor</th>
                  <th className="px-4 py-3 font-medium">Ocupação</th>
                  <th className="px-4 py-3 font-medium">Freq. média</th>
                  <th className="px-4 py-3 font-medium">Situação</th>
                </tr>
              </thead>
              <tbody>
                {turmas === null && !erro && (
                  <tr>
                    <td className="px-4 py-3 text-body-sm text-text-secondary" colSpan={6}>
                      Carregando...
                    </td>
                  </tr>
                )}
                {turmas?.map((t) => (
                  <tr key={t.id} className="h-[52px] border-b border-border last:border-b-0">
                    <td className="px-4 py-3">
                      <Link
                        to={`/coordenacao/turmas/${t.id}`}
                        className="text-body-sm font-medium text-primary hover:underline"
                      >
                        {t.codigo}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-body-sm text-text-secondary">{t.moduloNome}</td>
                    <td className="px-4 py-3 text-body-sm text-text-secondary">{t.professorNome}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-body-sm tabular-nums text-text-secondary">
                        {t.matriculados}/{t.vagasTotal}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-body-sm tabular-nums text-text-secondary">
                        {t.frequenciaMedia !== null ? `${t.frequenciaMedia.toFixed(0)}%` : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="neutral">{t.situacao}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </>
  );
}
