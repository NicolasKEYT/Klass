import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Aviso } from "@/components/Aviso";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Button } from "@/components/Button";
import { Cabecalho } from "@/components/Cabecalho";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { listarTrilhas } from "@/lib/catalogo";
import { criarTurma, listarProfessores } from "@/lib/selecao";
import type { Trilha } from "@klass/types";

const ATRASO_ANTES_DE_NAVEGAR_MS = 700;

export function NovaTurma() {
  const navigate = useNavigate();
  const [trilhas, setTrilhas] = useState<Trilha[]>([]);
  const [professores, setProfessores] = useState<Array<{ id: string; nomeCompleto: string }>>([]);

  const [trilhaId, setTrilhaId] = useState("");
  const [codigo, setCodigo] = useState("");
  const [professorId, setProfessorId] = useState("");
  const [periodoInicio, setPeriodoInicio] = useState("");
  const [periodoFim, setPeriodoFim] = useState("");
  const [vagasTotal, setVagasTotal] = useState(30);

  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    Promise.all([listarTrilhas(), listarProfessores()])
      .then(([todasTrilhas, todosProfessores]) => {
        const publicadas = todasTrilhas.filter((t) => t.publicada);
        setTrilhas(publicadas);
        setProfessores(todosProfessores);
        if (publicadas[0]) setTrilhaId(publicadas[0].id);
        if (todosProfessores[0]) setProfessorId(todosProfessores[0].id);
      })
      .catch((e) => setErro(e instanceof Error ? e.message : "Não foi possível carregar o formulário."));
  }, []);

  // "Ficar na tela" não existe pra turma como existe pra trilha — não há
  // uma edição de turma neste módulo. O equivalente de "continuar
  // trabalhando" é ir para a tela de detalhes, não repetir o envio.
  async function salvar(irParaListaAoInves: boolean) {
    setErro(null);
    setMensagem(null);
    setEnviando(true);
    try {
      const turma = await criarTurma({
        trilhaId,
        codigo,
        professorId,
        periodoInicio,
        periodoFim,
        vagasTotal,
      });
      setMensagem("Turma criada.");
      await new Promise((resolve) => setTimeout(resolve, ATRASO_ANTES_DE_NAVEGAR_MS));
      navigate(irParaListaAoInves ? "/coordenacao/turmas" : `/coordenacao/turmas/${turma.id}`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível criar a turma.");
    } finally {
      setEnviando(false);
    }
  }

  async function aoSubmeter(evento: FormEvent) {
    evento.preventDefault();
    await salvar(true);
  }

  return (
    <div className="min-h-screen bg-background">
      <Cabecalho />
      <div className="mx-auto max-w-lg p-6">
        <BotaoVoltar />
        <h1 className="mb-6 font-serif text-klass-xl text-text-primary">Nova turma</h1>

        <Card>
          <form className="flex flex-col gap-4" onSubmit={aoSubmeter}>
            <label className="flex flex-col gap-1.5">
              <span className="text-label font-medium text-text-secondary">Trilha</span>
              <select
                required
                className="h-9 rounded-klass-control border border-border bg-surface px-3.5 text-body-sm text-text-primary"
                value={trilhaId}
                onChange={(e) => setTrilhaId(e.target.value)}
              >
                {trilhas.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </select>
              {trilhas.length === 0 && (
                <span className="text-label text-text-muted">
                  Nenhuma trilha publicada ainda — publique uma antes de criar turma.
                </span>
              )}
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-label font-medium text-text-secondary">Código</span>
              <Input
                required
                placeholder="CDA-2026-1"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              />
              <span className="text-label text-text-muted">Padrão: SIGLA-ANO-SEQUÊNCIA</span>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-label font-medium text-text-secondary">
                Professor responsável
              </span>
              <select
                required
                className="h-9 rounded-klass-control border border-border bg-surface px-3.5 text-body-sm text-text-primary"
                value={professorId}
                onChange={(e) => setProfessorId(e.target.value)}
              >
                {professores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nomeCompleto}
                  </option>
                ))}
              </select>
              {professores.length === 0 && (
                <span className="text-label text-text-muted">
                  Nenhum profile com papel de professor cadastrado ainda.
                </span>
              )}
            </label>

            <div className="flex gap-4">
              <label className="flex flex-1 flex-col gap-1.5">
                <span className="text-label font-medium text-text-secondary">
                  Período — início
                </span>
                <Input
                  type="date"
                  required
                  value={periodoInicio}
                  onChange={(e) => setPeriodoInicio(e.target.value)}
                />
              </label>
              <label className="flex flex-1 flex-col gap-1.5">
                <span className="text-label font-medium text-text-secondary">Período — fim</span>
                <Input
                  type="date"
                  required
                  value={periodoFim}
                  onChange={(e) => setPeriodoFim(e.target.value)}
                />
              </label>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-label font-medium text-text-secondary">Vagas</span>
              <Input
                type="number"
                min={1}
                required
                value={vagasTotal}
                onChange={(e) => setVagasTotal(Number(e.target.value))}
              />
            </label>

            {erro && <Aviso variant="danger">{erro}</Aviso>}
            {mensagem && <Aviso variant="success">{mensagem}</Aviso>}

            <div className="flex gap-3">
              <Button type="submit" disabled={enviando}>
                {enviando ? "Criando..." : "Salvar e voltar"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={enviando}
                onClick={() => void salvar(false)}
              >
                Salvar e ver detalhes
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
