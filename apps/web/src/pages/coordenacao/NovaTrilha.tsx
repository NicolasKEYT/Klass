import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Aviso } from "@/components/Aviso";
import { Button } from "@/components/Button";
import { Cabecalho } from "@/components/Cabecalho";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { criarTrilha, gerarSlug } from "@/lib/catalogo";

export function NovaTrilha() {
  const navigate = useNavigate();
  const [nome, setNome] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEditadoManualmente, setSlugEditadoManualmente] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [descricaoCurta, setDescricaoCurta] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  function aoMudarNome(valor: string) {
    setNome(valor);
    if (!slugEditadoManualmente) setSlug(gerarSlug(valor));
  }

  async function aoSubmeter(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const trilha = await criarTrilha({ nome, slug, descricao, descricaoCurta });
      navigate(`/coordenacao/trilhas/${trilha.slug}/editar`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível criar a trilha.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Cabecalho />
      <div className="mx-auto max-w-lg p-6">
        <h1 className="mb-6 font-serif text-klass-xl text-text-primary">Nova trilha</h1>

        <Card>
          <form className="flex flex-col gap-4" onSubmit={aoSubmeter}>
            <label className="flex flex-col gap-1.5">
              <span className="text-label font-medium text-text-secondary">Nome</span>
              <Input required value={nome} onChange={(e) => aoMudarNome(e.target.value)} />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-label font-medium text-text-secondary">Slug</span>
              <Input
                required
                value={slug}
                onChange={(e) => {
                  setSlugEditadoManualmente(true);
                  setSlug(e.target.value);
                }}
              />
              <span className="text-label text-text-muted">
                Aparece na URL pública: /catalogo/{slug || "..."}
              </span>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-label font-medium text-text-secondary">Descrição curta</span>
              <Input
                value={descricaoCurta}
                maxLength={200}
                onChange={(e) => setDescricaoCurta(e.target.value)}
              />
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
            </label>

            {erro && <Aviso variant="danger">{erro}</Aviso>}

            <Button type="submit" disabled={enviando}>
              {enviando ? "Criando..." : "Criar trilha"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
