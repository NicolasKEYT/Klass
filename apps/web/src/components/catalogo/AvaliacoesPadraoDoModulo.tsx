import { useState, type FormEvent } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { useAvaliacoesModelo } from "@/lib/consultas/catalogo";
import { chaves } from "@/lib/consultas/chaves";
import { useGravacao } from "@/lib/consultas/gravacao";
import {
  apagarAvaliacaoModelo,
  atualizarAvaliacaoModelo,
  criarAvaliacaoModelo,
  reordenarAvaliacoesModelo,
} from "@/lib/catalogo";
import type { AvaliacaoModelo } from "@klass/types";

// Decisão do dono do produto (03/10/2026): "a coordenação cadastra no módulo
// as avaliações padrão (título e peso); toda turma nova já nasce com elas e o
// professor ajusta na turma dele, sem pedir liberação". Este bloco fica em
// cada módulo da edição da trilha. Mudar o modelo NÃO altera turmas já
// criadas — o aviso abaixo diz isso.
export function AvaliacoesPadraoDoModulo({ moduloId }: { moduloId: string }) {
  const gravar = useGravacao();
  const consulta = useAvaliacoesModelo(moduloId);
  const itens = consulta.data ?? [];
  const somaPesos = itens.reduce((s, a) => s + a.peso, 0);
  const percentual = (peso: number) => (somaPesos > 0 ? Math.round((peso / somaPesos) * 100) : 0);

  const [titulo, setTitulo] = useState("");
  const [peso, setPeso] = useState("1");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editTitulo, setEditTitulo] = useState("");
  const [editPeso, setEditPeso] = useState("1");
  const [apagandoId, setApagandoId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const invalidarModelo = (qc: QueryClient) =>
    qc.invalidateQueries({ queryKey: chaves.catalogo.avaliacoesModelo(moduloId) });

  async function executar(acao: () => Promise<void>) {
    setErro(null);
    setOcupado(true);
    try {
      await gravar(acao, invalidarModelo);
      return true;
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar o modelo.");
      return false;
    } finally {
      setOcupado(false);
    }
  }

  function pesoValido(texto: string) {
    const n = Number(texto);
    return Number.isInteger(n) && n > 0 && n <= 1000 ? n : null;
  }

  async function aoAdicionar(e: FormEvent) {
    e.preventDefault();
    const p = pesoValido(peso);
    if (titulo.trim().length < 2 || p === null) {
      setErro("Informe um título (2+ caracteres) e um peso inteiro maior que zero.");
      return;
    }
    const ordem = itens.length ? Math.max(...itens.map((a) => a.ordem)) + 1 : 1;
    if (await executar(() => criarAvaliacaoModelo({ moduloId, titulo, peso: p, ordem }))) {
      setTitulo("");
      setPeso("1");
    }
  }

  async function aoSalvarEdicao(e: FormEvent, item: AvaliacaoModelo) {
    e.preventDefault();
    const p = pesoValido(editPeso);
    if (editTitulo.trim().length < 2 || p === null) {
      setErro("Informe um título (2+ caracteres) e um peso inteiro maior que zero.");
      return;
    }
    if (await executar(() => atualizarAvaliacaoModelo(item.id, { titulo: editTitulo, peso: p }))) setEditandoId(null);
  }

  async function mover(indice: number, delta: -1 | 1) {
    const ids = itens.map((a) => a.id);
    const alvo = indice + delta;
    if (alvo < 0 || alvo >= ids.length) return;
    [ids[indice], ids[alvo]] = [ids[alvo], ids[indice]];
    await executar(() => reordenarAvaliacoesModelo(ids));
  }

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-label font-medium text-text-secondary">Avaliações padrão</p>
        <p className="text-label text-text-muted">
          Toda turma nova deste módulo nasce com elas; o professor ajusta na turma dele. Turmas já
          criadas não mudam.
        </p>
      </div>

      {consulta.isError && <p className="text-label text-danger">Não foi possível carregar o modelo.</p>}
      {consulta.data && itens.length === 0 && (
        <p className="text-label text-text-muted">Nenhuma avaliação padrão: as turmas novas nascem sem avaliações.</p>
      )}

      {itens.length > 0 && (
        <ol className="flex flex-col divide-y divide-border rounded-klass-control border border-border">
          {itens.map((item, i) =>
            editandoId === item.id ? (
              <li key={item.id} className="px-3 py-2">
                <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => void aoSalvarEdicao(e, item)}>
                  <label className="flex min-w-40 flex-1 flex-col gap-1">
                    <span className="text-label text-text-secondary">Título</span>
                    <Input value={editTitulo} onChange={(e) => setEditTitulo(e.target.value)} maxLength={120} />
                  </label>
                  <label className="flex w-24 flex-col gap-1">
                    <span className="text-label text-text-secondary">Peso</span>
                    <Input type="number" min={1} value={editPeso} onChange={(e) => setEditPeso(e.target.value)} />
                  </label>
                  <Button type="submit" disabled={ocupado}>
                    Salvar
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setEditandoId(null)}>
                    Cancelar
                  </Button>
                </form>
              </li>
            ) : (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span className="text-body-sm text-text-primary">
                  {item.titulo}{" "}
                  <span className="text-text-secondary">
                    · peso {item.peso} ({percentual(item.peso)}%)
                  </span>
                </span>
                {apagandoId === item.id ? (
                  <span className="flex items-center gap-2">
                    <span className="text-label text-text-secondary">Remover do modelo?</span>
                    <Button
                      variant="secondary"
                      disabled={ocupado}
                      onClick={() => void executar(() => apagarAvaliacaoModelo(item.id)).then(() => setApagandoId(null))}
                    >
                      Remover
                    </Button>
                    <Button variant="secondary" onClick={() => setApagandoId(null)}>
                      Cancelar
                    </Button>
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label={`Subir ${item.titulo}`}
                      disabled={i === 0 || ocupado}
                      onClick={() => void mover(i, -1)}
                      className="rounded-klass-control p-1.5 text-text-secondary hover:text-text-primary disabled:opacity-40"
                    >
                      <ArrowUp className="h-4 w-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      aria-label={`Descer ${item.titulo}`}
                      disabled={i === itens.length - 1 || ocupado}
                      onClick={() => void mover(i, 1)}
                      className="rounded-klass-control p-1.5 text-text-secondary hover:text-text-primary disabled:opacity-40"
                    >
                      <ArrowDown className="h-4 w-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      aria-label={`Editar ${item.titulo}`}
                      onClick={() => {
                        setEditandoId(item.id);
                        setEditTitulo(item.titulo);
                        setEditPeso(String(item.peso));
                      }}
                      className="rounded-klass-control p-1.5 text-text-secondary hover:text-text-primary"
                    >
                      <Pencil className="h-4 w-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      aria-label={`Remover ${item.titulo}`}
                      onClick={() => setApagandoId(item.id)}
                      className="rounded-klass-control p-1.5 text-text-secondary hover:text-danger"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </span>
                )}
              </li>
            ),
          )}
        </ol>
      )}

      <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => void aoAdicionar(e)}>
        <label className="flex min-w-40 flex-1 flex-col gap-1">
          <span className="text-label text-text-secondary">Nova avaliação padrão</span>
          <Input placeholder="Ex.: Prova 1" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={120} />
        </label>
        <label className="flex w-24 flex-col gap-1">
          <span className="text-label text-text-secondary">Peso</span>
          <Input type="number" min={1} value={peso} onChange={(e) => setPeso(e.target.value)} />
        </label>
        <Button type="submit" variant="secondary" disabled={ocupado}>
          Adicionar
        </Button>
      </form>
      {erro && (
        <p className="text-label text-danger" role="alert">
          {erro}
        </p>
      )}
    </div>
  );
}
