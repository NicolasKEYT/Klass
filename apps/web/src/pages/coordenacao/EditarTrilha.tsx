import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Aviso } from "@/components/Aviso";
import { Badge } from "@/components/Badge";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Button } from "@/components/Button";
import { Cabecalho } from "@/components/Cabecalho";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import {
  apagarModulo,
  atualizarModulo,
  atualizarTrilha,
  buscarTrilhaPorSlug,
  criarModulo,
  definirPreRequisito,
  listarModulosDaTrilha,
  listarPreRequisitosIdsDaTrilha,
  listarTrilhas,
  proximaOrdemDisponivel,
  trocarOrdemModulos,
} from "@/lib/catalogo";
import { definirPreRequisitoTrilha, listarIdsTrilhasRequisito } from "@/lib/selecao";
import type { Modulo, NivelModulo, Trilha } from "@klass/types";

const NIVEIS: NivelModulo[] = ["iniciante", "intermediario", "avancado"];
const NIVEL_LABEL: Record<NivelModulo, string> = {
  iniciante: "Iniciante",
  intermediario: "Intermediário",
  avancado: "Avançado",
};

export function EditarTrilha() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [trilha, setTrilha] = useState<Trilha | null>(null);
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [preRequisitos, setPreRequisitos] = useState<Map<string, Set<string>>>(new Map());
  const [outrasTrilhas, setOutrasTrilhas] = useState<Trilha[]>([]);
  const [trilhasRequisito, setTrilhasRequisito] = useState<Set<string>>(new Set());
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [descricaoCurta, setDescricaoCurta] = useState("");
  const [salvandoTrilha, setSalvandoTrilha] = useState(false);

  const [mostrarNovoModulo, setMostrarNovoModulo] = useState(false);
  const [novoModuloNome, setNovoModuloNome] = useState("");
  const [novoModuloDescricao, setNovoModuloDescricao] = useState("");
  const [novoModuloNivel, setNovoModuloNivel] = useState<NivelModulo>("iniciante");
  const [novoModuloCarga, setNovoModuloCarga] = useState(10);
  const [salvandoModulo, setSalvandoModulo] = useState(false);

  const [moduloEmEdicaoId, setModuloEmEdicaoId] = useState<string | null>(null);
  const [edicaoNome, setEdicaoNome] = useState("");
  const [edicaoDescricao, setEdicaoDescricao] = useState("");
  const [edicaoNivel, setEdicaoNivel] = useState<NivelModulo>("iniciante");
  const [edicaoCarga, setEdicaoCarga] = useState(10);

  // Confirmação inline, não window.confirm — dialogs nativos ficam
  // desabilitados em vários contextos embutidos/automatizados de browser.
  const [confirmandoApagarModuloId, setConfirmandoApagarModuloId] = useState<string | null>(null);

  async function carregar() {
    if (!slug) return;
    setErro(null);
    try {
      const encontrada = await buscarTrilhaPorSlug(slug);
      if (!encontrada) {
        setErro("Trilha não encontrada.");
        setCarregando(false);
        return;
      }
      setTrilha(encontrada);
      setNome(encontrada.nome);
      setDescricao(encontrada.descricao);
      setDescricaoCurta(encontrada.descricao_curta ?? "");

      const [listaModulos, mapaPreRequisitos, todasTrilhas, idsRequisito] = await Promise.all([
        listarModulosDaTrilha(encontrada.id),
        listarPreRequisitosIdsDaTrilha(encontrada.id),
        listarTrilhas(),
        listarIdsTrilhasRequisito(encontrada.id),
      ]);
      setModulos(listaModulos);
      setPreRequisitos(mapaPreRequisitos);
      setOutrasTrilhas(
        todasTrilhas.filter((t) => t.id !== encontrada.id && t.publicada),
      );
      setTrilhasRequisito(new Set(idsRequisito));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar a trilha.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function salvarTrilha(voltarParaLista: boolean) {
    if (!trilha) return;
    setErro(null);
    setMensagem(null);
    setSalvandoTrilha(true);
    try {
      const atualizada = await atualizarTrilha(trilha.id, {
        nome,
        descricao,
        descricao_curta: descricaoCurta || null,
      });
      setTrilha(atualizada);
      setMensagem("Dados da trilha salvos.");
      if (voltarParaLista) {
        // Espera o aviso de sucesso aparecer antes de sair da tela —
        // um redirecionamento instantâneo nunca deixaria o usuário vê-lo.
        await new Promise((resolve) => setTimeout(resolve, 700));
        navigate("/coordenacao/trilhas");
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar a trilha.");
    } finally {
      setSalvandoTrilha(false);
    }
  }

  async function aoSubmeterFormularioTrilha(evento: FormEvent) {
    evento.preventDefault();
    await salvarTrilha(true);
  }

  async function aoCriarModulo(evento: FormEvent) {
    evento.preventDefault();
    if (!trilha) return;
    setErro(null);
    setMensagem(null);
    setSalvandoModulo(true);
    try {
      const ordem = await proximaOrdemDisponivel(trilha.id);
      await criarModulo({
        trilhaId: trilha.id,
        ordem,
        nome: novoModuloNome,
        descricao: novoModuloDescricao,
        nivel: novoModuloNivel,
        cargaHorariaHoras: novoModuloCarga,
      });
      setNovoModuloNome("");
      setNovoModuloDescricao("");
      setNovoModuloNivel("iniciante");
      setNovoModuloCarga(10);
      setMostrarNovoModulo(false);
      setMensagem("Módulo adicionado.");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível criar o módulo.");
    } finally {
      setSalvandoModulo(false);
    }
  }

  function iniciarEdicaoModulo(modulo: Modulo) {
    setModuloEmEdicaoId(modulo.id);
    setEdicaoNome(modulo.nome);
    setEdicaoDescricao(modulo.descricao);
    setEdicaoNivel(modulo.nivel);
    setEdicaoCarga(modulo.carga_horaria_horas);
  }

  async function salvarEdicaoModulo(evento: FormEvent) {
    evento.preventDefault();
    if (!moduloEmEdicaoId) return;
    setErro(null);
    setMensagem(null);
    try {
      await atualizarModulo(moduloEmEdicaoId, {
        nome: edicaoNome,
        descricao: edicaoDescricao,
        nivel: edicaoNivel,
        carga_horaria_horas: edicaoCarga,
      });
      setModuloEmEdicaoId(null);
      setMensagem("Módulo atualizado.");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar o módulo.");
    }
  }

  async function aoApagarModulo(modulo: Modulo) {
    setErro(null);
    setMensagem(null);
    try {
      await apagarModulo(modulo.id);
      setMensagem("Módulo apagado.");
      setConfirmandoApagarModuloId(null);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível apagar o módulo.");
    }
  }

  async function mover(modulo: Modulo, direcao: "subir" | "descer") {
    const indice = modulos.findIndex((m) => m.id === modulo.id);
    const alvo = direcao === "subir" ? modulos[indice - 1] : modulos[indice + 1];
    if (!alvo) return;
    setErro(null);
    try {
      await trocarOrdemModulos(modulo.id, alvo.id);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível reordenar.");
    }
  }

  async function aoAlternarPreRequisito(modulo: Modulo, preRequisitoId: string, ativo: boolean) {
    setErro(null);
    try {
      await definirPreRequisito(modulo.id, preRequisitoId, ativo);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível atualizar o pré-requisito.");
    }
  }

  async function aoAlternarPreRequisitoTrilha(trilhaRequisitoId: string, ativo: boolean) {
    if (!trilha) return;
    setErro(null);
    try {
      await definirPreRequisitoTrilha(trilha.id, trilhaRequisitoId, ativo);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível atualizar o pré-requisito.");
    }
  }

  if (carregando) {
    return (
      <div className="min-h-screen bg-background">
        <Cabecalho />
        <p className="p-6 text-body-sm text-text-secondary">Carregando...</p>
      </div>
    );
  }

  if (!trilha) {
    return (
      <div className="min-h-screen bg-background">
        <Cabecalho />
        <div className="m-6">
          <BotaoVoltar />
          <Aviso variant="danger">{erro ?? "Trilha não encontrada."}</Aviso>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Cabecalho />
      <div className="mx-auto max-w-3xl p-6">
        <BotaoVoltar />
        <h1 className="mb-6 font-serif text-klass-xl text-text-primary">Editar trilha</h1>

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

        <Card className="mb-6">
          <form className="flex flex-col gap-4" onSubmit={aoSubmeterFormularioTrilha}>
            <label className="flex flex-col gap-1.5">
              <span className="text-label font-medium text-text-secondary">Nome</span>
              <Input required value={nome} onChange={(e) => setNome(e.target.value)} />
            </label>
            {/* Slug vira parte de URLs já divulgadas — só é definido na criação. */}
            <p className="text-label text-text-muted">Slug: {trilha.slug} (não pode ser alterado)</p>
            <label className="flex flex-col gap-1.5">
              <span className="text-label font-medium text-text-secondary">Descrição curta</span>
              <Input
                maxLength={200}
                value={descricaoCurta}
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
            <div className="flex gap-3">
              <Button type="submit" disabled={salvandoTrilha}>
                {salvandoTrilha ? "Salvando..." : "Salvar e voltar"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={salvandoTrilha}
                onClick={() => void salvarTrilha(false)}
              >
                Salvar
              </Button>
            </div>
          </form>
        </Card>

        {/* Pré-requisito ENTRE TRILHAS (MS3) — diferente do "este módulo
            requer" abaixo, que é entre módulos DENTRO desta trilha (MS2). */}
        <Card className="mb-6">
          <h2 className="mb-1 font-serif text-klass-lg text-text-primary">Pré-requisitos</h2>
          <p className="mb-3 text-body-sm text-text-secondary">
            Para se inscrever em "{trilha.nome}", o aluno precisa ter concluído:
          </p>
          {outrasTrilhas.length === 0 ? (
            <p className="text-label text-text-muted">
              Nenhuma outra trilha publicada ainda para ser pré-requisito.
            </p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {outrasTrilhas.map((outra) => (
                <label
                  key={outra.id}
                  className="flex items-center gap-1.5 text-body-sm text-text-secondary"
                >
                  <input
                    type="checkbox"
                    checked={trilhasRequisito.has(outra.id)}
                    onChange={(e) => void aoAlternarPreRequisitoTrilha(outra.id, e.target.checked)}
                  />
                  {outra.nome}
                </label>
              ))}
            </div>
          )}
        </Card>

        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-klass-lg text-text-primary">
            Módulos ({modulos.length}) · {trilha.carga_horaria_total}h
          </h2>
          <Button onClick={() => setMostrarNovoModulo((v) => !v)}>
            {mostrarNovoModulo ? "Cancelar" : "Adicionar módulo"}
          </Button>
        </div>

        {mostrarNovoModulo && (
          <Card className="mb-4">
            <form className="flex flex-col gap-4" onSubmit={aoCriarModulo}>
              <label className="flex flex-col gap-1.5">
                <span className="text-label font-medium text-text-secondary">Nome</span>
                <Input
                  required
                  value={novoModuloNome}
                  onChange={(e) => setNovoModuloNome(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-label font-medium text-text-secondary">Descrição</span>
                <Input
                  required
                  value={novoModuloDescricao}
                  onChange={(e) => setNovoModuloDescricao(e.target.value)}
                />
              </label>
              <div className="flex gap-4">
                <label className="flex flex-1 flex-col gap-1.5">
                  <span className="text-label font-medium text-text-secondary">Nível</span>
                  <select
                    className="h-9 rounded-klass-control border border-border bg-surface px-3.5 text-body-sm text-text-primary"
                    value={novoModuloNivel}
                    onChange={(e) => setNovoModuloNivel(e.target.value as NivelModulo)}
                  >
                    {NIVEIS.map((n) => (
                      <option key={n} value={n}>
                        {NIVEL_LABEL[n]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-1 flex-col gap-1.5">
                  <span className="text-label font-medium text-text-secondary">
                    Carga horária (h)
                  </span>
                  <Input
                    type="number"
                    min={1}
                    required
                    value={novoModuloCarga}
                    onChange={(e) => setNovoModuloCarga(Number(e.target.value))}
                  />
                </label>
              </div>
              <Button type="submit" disabled={salvandoModulo} className="self-start">
                {salvandoModulo ? "Adicionando..." : "Adicionar"}
              </Button>
            </form>
          </Card>
        )}

        <div className="flex flex-col gap-3">
          {modulos.map((modulo, indice) => (
            <Card key={modulo.id} className="flex flex-col gap-3">
              {moduloEmEdicaoId === modulo.id ? (
                <form className="flex flex-col gap-3" onSubmit={salvarEdicaoModulo}>
                  <Input value={edicaoNome} onChange={(e) => setEdicaoNome(e.target.value)} required />
                  <Input
                    value={edicaoDescricao}
                    onChange={(e) => setEdicaoDescricao(e.target.value)}
                    required
                  />
                  <div className="flex gap-4">
                    <select
                      className="h-9 flex-1 rounded-klass-control border border-border bg-surface px-3.5 text-body-sm text-text-primary"
                      value={edicaoNivel}
                      onChange={(e) => setEdicaoNivel(e.target.value as NivelModulo)}
                    >
                      {NIVEIS.map((n) => (
                        <option key={n} value={n}>
                          {NIVEL_LABEL[n]}
                        </option>
                      ))}
                    </select>
                    <Input
                      type="number"
                      min={1}
                      className="flex-1"
                      value={edicaoCarga}
                      onChange={(e) => setEdicaoCarga(Number(e.target.value))}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit">Salvar</Button>
                    <Button variant="secondary" type="button" onClick={() => setModuloEmEdicaoId(null)}>
                      Cancelar
                    </Button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-label text-text-muted">#{modulo.ordem}</span>
                      <h3 className="text-klass-md text-text-primary">{modulo.nome}</h3>
                      <Badge variant="neutral">{NIVEL_LABEL[modulo.nivel]}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        disabled={indice === 0}
                        onClick={() => void mover(modulo, "subir")}
                      >
                        Subir
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={indice === modulos.length - 1}
                        onClick={() => void mover(modulo, "descer")}
                      >
                        Descer
                      </Button>
                      <Button variant="secondary" onClick={() => iniciarEdicaoModulo(modulo)}>
                        Editar
                      </Button>
                      {confirmandoApagarModuloId === modulo.id ? (
                        <>
                          <span className="text-label text-text-secondary">Apagar de vez?</span>
                          <Button variant="secondary" onClick={() => void aoApagarModulo(modulo)}>
                            Sim
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => setConfirmandoApagarModuloId(null)}
                          >
                            Cancelar
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="secondary"
                          onClick={() => setConfirmandoApagarModuloId(modulo.id)}
                        >
                          Apagar
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="text-body-sm text-text-secondary">{modulo.descricao}</p>
                  <p className="text-label text-text-muted">{modulo.carga_horaria_horas}h</p>

                  <div>
                    <p className="mb-1 text-label font-medium text-text-secondary">
                      Este módulo requer:
                    </p>
                    <div className="flex flex-wrap gap-3">
                      {modulos.length === 1 && (
                        <span className="text-label text-text-muted">
                          Nenhum outro módulo nesta trilha ainda.
                        </span>
                      )}
                      {modulos
                        .filter((outro) => outro.id !== modulo.id)
                        .map((outro) => (
                          <label
                            key={outro.id}
                            className="flex items-center gap-1.5 text-body-sm text-text-secondary"
                          >
                            <input
                              type="checkbox"
                              checked={preRequisitos.get(modulo.id)?.has(outro.id) ?? false}
                              onChange={(e) =>
                                void aoAlternarPreRequisito(modulo, outro.id, e.target.checked)
                              }
                            />
                            {outro.nome}
                          </label>
                        ))}
                    </div>
                  </div>
                </>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
