import { useState } from "react";
import { Search } from "lucide-react";
import type { Papel } from "@klass/types";
import { useAuth } from "@/auth";
import { Aviso } from "@/components/Aviso";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/Card";
import { EsqueletoCards } from "@/components/Esqueleto";
import { ErroConsulta } from "@/components/ErroConsulta";
import { Input } from "@/components/Input";
import { PaginaAutenticada } from "@/components/PaginaAutenticada";
import { Titulo } from "@/components/Titulo";
import { useGravacao } from "@/lib/consultas/gravacao";
import { usePessoas } from "@/lib/consultas/identidade";
import { invalidar } from "@/lib/consultas/invalidar";
import { alterarPapel, PAPEIS, rotuloDoPapel } from "@/lib/identidade";
import { plural } from "@/lib/plural";

const CLASSE_SELECT =
  "h-12 sm:h-10 rounded-klass-control border border-controle bg-surface px-3.5 text-body-sm text-text-primary transition focus:border-primary";

// D3 — "Pessoas": lista de perfis com troca de papel. Não há convite por
// e-mail (depende de infraestrutura de e-mail; fica com a futura visão do
// Administrador): quem é novo se cadastra em /cadastrar, entra como aluno(a)
// e a coordenação promove aqui. A garantia é do banco — RLS profiles_select
// (coordenação lê todos) e o trigger que só deixa a coordenação trocar papel.
export function Pessoas() {
  const { usuario } = useAuth();
  const gravar = useGravacao();
  const consulta = usePessoas();
  const pessoas = consulta.data;

  const [busca, setBusca] = useState("");
  const [filtroPapel, setFiltroPapel] = useState<Papel | "todos">("todos");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [novoPapel, setNovoPapel] = useState<Papel>("aluno");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [linkCopiado, setLinkCopiado] = useState(false);

  const linkCadastro = `${window.location.origin}/cadastrar`;
  const termo = busca.trim().toLowerCase();
  const filtradas = (pessoas ?? []).filter(
    (p) =>
      (filtroPapel === "todos" || p.papel === filtroPapel) &&
      (termo === "" || p.nomeCompleto.toLowerCase().includes(termo)),
  );

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(linkCadastro);
      setLinkCopiado(true);
      setTimeout(() => setLinkCopiado(false), 2500);
    } catch {
      setErro(`Não foi possível copiar. O link é ${linkCadastro}`);
    }
  }

  async function confirmarTroca(pessoaId: string, nome: string) {
    setErro(null);
    setMensagem(null);
    setSalvando(true);
    try {
      await gravar(() => alterarPapel(pessoaId, novoPapel), (qc) => invalidar.papel(qc));
      setEditandoId(null);
      setMensagem(`${nome} agora é ${rotuloDoPapel(novoPapel)}.`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível alterar o papel.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <PaginaAutenticada>
      <Titulo className="mb-2">Pessoas</Titulo>
      <p className="mb-4 text-body-sm text-text-secondary">
        Novas pessoas se cadastram pelo link de cadastro e entram como aluno(a). Para tornar alguém
        professor(a) ou coordenação, altere o papel aqui.
      </p>
      <Card className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="break-all font-mono text-body-sm text-text-secondary">{linkCadastro}</span>
        <Button variant="secondary" onClick={() => void copiarLink()}>
          {linkCopiado ? "Link copiado" : "Copiar link de cadastro"}
        </Button>
      </Card>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <Input
            className="pl-9"
            type="search"
            aria-label="Buscar por nome"
            placeholder="Buscar por nome"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <select
          aria-label="Filtrar por papel"
          className={CLASSE_SELECT}
          value={filtroPapel}
          onChange={(e) => setFiltroPapel(e.target.value as Papel | "todos")}
        >
          <option value="todos">Todos os papéis</option>
          {PAPEIS.map((p) => (
            <option key={p} value={p}>
              {rotuloDoPapel(p)}
            </option>
          ))}
        </select>
      </div>

      {erro && (
        <Aviso variant="danger" className="mb-4">
          {erro}
        </Aviso>
      )}
      {mensagem && (
        <Aviso variant="success" className="mb-4">
          {mensagem}
        </Aviso>
      )}
      {consulta.isError && !pessoas && (
        <ErroConsulta
          className="mb-4"
          erro={consulta.error}
          padrao="Não foi possível carregar as pessoas."
          tentarDeNovo={() => void consulta.refetch()}
        />
      )}
      {consulta.isPending && <EsqueletoCards quantidade={4} altura="h-16" />}
      {pessoas && (
        <p className="mb-2 text-label text-text-muted">
          {plural(filtradas.length, "pessoa", "pessoas")}
        </p>
      )}
      {pessoas && filtradas.length === 0 && (
        <p className="text-body-sm text-text-secondary">Ninguém encontrado com esses filtros.</p>
      )}

      <div className="flex flex-col gap-2">
        {filtradas.map((pessoa) => {
          const ehEuMesmo = pessoa.id === usuario?.id;
          return (
            <Card key={pessoa.id} className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Avatar nome={pessoa.nomeCompleto} className="mr-1" />
                  <span className="truncate text-body-sm font-medium text-text-primary">
                    {pessoa.nomeCompleto}
                  </span>
                  <Badge variant="contorno">{rotuloDoPapel(pessoa.papel)}</Badge>
                </div>
                {ehEuMesmo ? (
                  // Trocar o próprio papel tiraria a coordenação de si mesma
                  // (e, sendo a única, de todos) — por isso nem é oferecido.
                  <span className="text-label text-text-muted">Você</span>
                ) : (
                  editandoId !== pessoa.id && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setEditandoId(pessoa.id);
                        setNovoPapel(pessoa.papel);
                        setErro(null);
                        setMensagem(null);
                      }}
                    >
                      Alterar papel
                    </Button>
                  )
                )}
              </div>

              {editandoId === pessoa.id && (
                <div className="flex flex-col gap-3 border-t border-border pt-3">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-label font-medium text-text-secondary">Novo papel</span>
                    <select
                      className={CLASSE_SELECT}
                      value={novoPapel}
                      onChange={(e) => setNovoPapel(e.target.value as Papel)}
                    >
                      {PAPEIS.map((p) => (
                        <option key={p} value={p}>
                          {rotuloDoPapel(p)}
                        </option>
                      ))}
                    </select>
                  </label>
                  {novoPapel !== pessoa.papel && (
                    <p className="text-body-sm text-text-secondary">
                      {pessoa.nomeCompleto} passa de {rotuloDoPapel(pessoa.papel)} para{" "}
                      {rotuloDoPapel(novoPapel)} e verá as telas desse papel na próxima vez que
                      entrar.
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      disabled={salvando || novoPapel === pessoa.papel}
                      onClick={() => void confirmarTroca(pessoa.id, pessoa.nomeCompleto)}
                    >
                      {salvando ? "Salvando..." : "Confirmar troca"}
                    </Button>
                    <Button variant="secondary" disabled={salvando} onClick={() => setEditandoId(null)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </PaginaAutenticada>
  );
}
