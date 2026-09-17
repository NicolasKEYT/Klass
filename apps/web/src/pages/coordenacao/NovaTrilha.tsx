import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Aviso } from "@/components/Aviso";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { PaginaAutenticada } from "@/components/PaginaAutenticada";
import { Titulo } from "@/components/Titulo";
import { criarTrilha, gerarSlug } from "@/lib/catalogo";

// Tempo pra o aviso de sucesso ficar visível antes de navegar — sem
// isso o redirecionamento é instantâneo e o feedback nunca aparece.
const ATRASO_ANTES_DE_NAVEGAR_MS = 700;

export function NovaTrilha() {
  const navigate = useNavigate();
  const [nome, setNome] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEditadoManualmente, setSlugEditadoManualmente] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [descricaoCurta, setDescricaoCurta] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  function aoMudarNome(valor: string) {
    setNome(valor);
    if (!slugEditadoManualmente) setSlug(gerarSlug(valor));
  }

  // "Ficar na tela" não faz sentido aqui como faz em EditarTrilha: o
  // formulário já foi enviado, os campos não se limpam sozinhos, e
  // enviar de novo tentaria criar outra trilha com o mesmo slug. O
  // equivalente de "continuar ajustando" numa trilha nova é ir direto
  // para a edição (onde módulos e pré-requisitos existem) — não ficar
  // parado num formulário de criação já usado.
  async function salvar(irParaListaAoInves: boolean) {
    setErro(null);
    setMensagem(null);
    setEnviando(true);
    try {
      const trilha = await criarTrilha({ nome, slug, descricao, descricaoCurta });
      setMensagem("Trilha criada.");
      await new Promise((resolve) => setTimeout(resolve, ATRASO_ANTES_DE_NAVEGAR_MS));
      navigate(
        irParaListaAoInves ? "/coordenacao/trilhas" : `/coordenacao/trilhas/${trilha.slug}/editar`,
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível criar a trilha.");
    } finally {
      setEnviando(false);
    }
  }

  async function aoSubmeter(evento: FormEvent) {
    evento.preventDefault();
    await salvar(true);
  }

  return (
    <PaginaAutenticada largura="estreita">
        <BotaoVoltar />
        <Titulo className="mb-6">Nova trilha</Titulo>

        <Card>
          <form className="flex flex-col gap-4" onSubmit={aoSubmeter}>
            <label className="flex flex-col gap-1.5">
              <span className="text-label font-medium text-text-secondary">Nome</span>
              <Input required value={nome} onChange={(e) => aoMudarNome(e.target.value)} />
            </label>

            <label className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-label font-medium text-text-secondary">Endereço da página</span>
                <button
                  type="button"
                  onClick={() => {
                    setSlugEditadoManualmente(false);
                    setSlug(gerarSlug(nome));
                  }}
                  className="text-label font-medium text-primary hover:underline"
                >
                  Sincronizar com o nome
                </button>
              </div>
              <Input
                required
                value={slug}
                onChange={(e) => {
                  setSlugEditadoManualmente(true);
                  setSlug(e.target.value);
                }}
              />
              <span className="text-label text-text-muted">
                Esse texto aparece no link da trilha (/catalogo/{slug || "..."}). Evite espaços e
                acentos. Mudar depois de publicado pode quebrar links já compartilhados.
              </span>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-label font-medium text-text-secondary">Descrição curta</span>
              <Input
                value={descricaoCurta}
                maxLength={200}
                onChange={(e) => setDescricaoCurta(e.target.value)}
              />
              <span className="text-label text-text-muted">
                Aparece nos cards do catálogo, onde o aluno navega entre várias trilhas. Seja breve
                (até ~150 caracteres).
              </span>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-label font-medium text-text-secondary">Descrição completa</span>
              <textarea
                required
                rows={4}
                className="rounded-klass-control border border-border bg-surface px-3.5 py-2 text-body-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
              />
              <span className="text-label text-text-muted">
                Aparece na página de detalhe da trilha, quando o aluno já demonstrou interesse. Pode
                ser mais detalhada.
              </span>
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
                Salvar e continuar editando
              </Button>
            </div>
          </form>
        </Card>
    </PaginaAutenticada>
  );
}
