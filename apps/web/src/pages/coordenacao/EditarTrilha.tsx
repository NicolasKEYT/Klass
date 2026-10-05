import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Aviso } from "@/components/Aviso";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Card } from "@/components/Card";
import { Arrastavel } from "@/components/Arrastavel";
import { AvaliacoesPadraoDoModulo } from "@/components/catalogo/AvaliacoesPadraoDoModulo";
import { Esqueleto, EsqueletoCards, EsqueletoPagina, RegiaoCarregando } from "@/components/Esqueleto";
import { ErroConsulta } from "@/components/ErroConsulta";
import { CamposCertificacao } from "@/components/CamposCertificacao";
import { ModalDesvincularPreRequisitos } from "@/components/catalogo/ModalDesvincularPreRequisitos";
import { IconeCatalogo, IconePicker } from "@/components/IconeCatalogo";
import { Input } from "@/components/Input";
import { PaginaAutenticada } from "@/components/PaginaAutenticada";
import { Titulo } from "@/components/Titulo";
import {
  apagarModulo,
  atualizarModulo,
  atualizarTrilha,
  criarModulo,
  definirPreRequisito,
  gerarSlug,
  listarDependentesEmOutrasTrilhas,
  proximaOrdemDisponivel,
  reordenarModulos,
  trocarOrdemModulos,
} from "@/lib/catalogo";
import {
  useModulosDaTrilha,
  useOpcoesDePreRequisito,
  usePreRequisitosDaTrilha,
  usePreRequisitosIdsDaTrilha,
  useTrilhaPorSlug,
} from "@/lib/consultas/catalogo";
import { useTrilhaTemCertificados } from "@/lib/consultas/certificacao";
import { chaves } from "@/lib/consultas/chaves";
import { useGravacao } from "@/lib/consultas/gravacao";
import { invalidar } from "@/lib/consultas/invalidar";
import type { DependenteEmOutraTrilha } from "@/lib/catalogo";
import type { Modulo, NivelModulo, TipoCertificacao, Trilha } from "@klass/types";

const NIVEIS: NivelModulo[] = ["iniciante", "intermediario", "avancado"];
const NIVEL_LABEL: Record<NivelModulo, string> = {
  iniciante: "Iniciante",
  intermediario: "Intermediário",
  avancado: "Avançado",
};

// Tela carregada sob demanda (dnd-kit): ver App.tsx. A trilha costuma já
// estar em cache (vinda da lista de trilhas); o editor só monta com ela.
export function EditarTrilha() {
  const { slug: slugRota } = useParams<{ slug: string }>();
  const consulta = useTrilhaPorSlug(slugRota);
  const trilha = consulta.data;

  if (consulta.isPending) {
    return (
      <PaginaAutenticada titulo="Editar trilha" voltar={{}}>
        <EsqueletoPagina />
      </PaginaAutenticada>
    );
  }
  if (!trilha) {
    return (
      <PaginaAutenticada titulo="Editar trilha" voltar={{}}>
        {consulta.isError ? (
          <ErroConsulta
            erro={consulta.error}
            padrao="Não foi possível carregar a trilha."
            tentarDeNovo={() => void consulta.refetch()}
          />
        ) : (
          <Aviso variant="danger">Trilha não encontrada.</Aviso>
        )}
      </PaginaAutenticada>
    );
  }
  // key: trocar de trilha recria o formulário; trocar só o slug (salvar
  // com endereço novo) mantém o que está sendo editado.
  return <EditorDeTrilha key={trilha.id} trilha={trilha} slugRota={slugRota!} />;
}

function EditorDeTrilha({ trilha, slugRota }: { trilha: Trilha; slugRota: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const gravar = useGravacao();

  const consultaModulos = useModulosDaTrilha(trilha.id);
  const consultaPreRequisitos = usePreRequisitosIdsDaTrilha(trilha.id);
  const temCertificados = useTrilhaTemCertificados(trilha.id).data ?? false;
  const modulos = consultaModulos.data ?? [];
  const preRequisitos = consultaPreRequisitos.data ?? new Map<string, Set<string>>();
  // A15: pré-requisito pode ser módulo de outra trilha publicada. As opções
  // nomeiam o que acabou de ser marcado; os detalhados cobrem o já gravado
  // cuja trilha deixou de ser publicada.
  const opcoesDeFora = (useOpcoesDePreRequisito().data ?? []).filter((m) => m.trilhaId !== trilha.id);
  const detalhados = usePreRequisitosDaTrilha(trilha.id).data;
  const rotuloDeFora = (moduloId: string, preRequisitoId: string) => {
    const opcao = opcoesDeFora.find((m) => m.id === preRequisitoId);
    if (opcao) return `${opcao.trilhaNome} · ${opcao.nome}`;
    const p = detalhados?.get(moduloId)?.find((d) => d.pre_requisito_id === preRequisitoId);
    return p ? `${p.trilha_nome} · ${p.nome}` : "Módulo de outra trilha";
  };
  const trilhasDeFora = [...new Set(opcoesDeFora.map((m) => m.trilhaNome))];
  const erroDeLeitura = consultaModulos.error ?? consultaPreRequisitos.error;
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);

  // O formulário parte da trilha como estava ao abrir a tela.
  const [nome, setNome] = useState(trilha.nome);
  const [slug, setSlug] = useState(trilha.slug);
  const [descricao, setDescricao] = useState(trilha.descricao);
  const [descricaoCurta, setDescricaoCurta] = useState(trilha.descricao_curta ?? "");
  const [icone, setIcone] = useState<string | null>(trilha.icone);
  const [tipoCertificacao, setTipoCertificacao] = useState<TipoCertificacao>(trilha.tipo_certificacao);
  const [mediaMinima, setMediaMinima] = useState(String(trilha.media_minima));
  const [frequenciaMinima, setFrequenciaMinima] = useState(String(trilha.frequencia_minima_percentual));
  const [salvandoTrilha, setSalvandoTrilha] = useState(false);

  const [mostrarNovoModulo, setMostrarNovoModulo] = useState(false);
  const [novoModuloNome, setNovoModuloNome] = useState("");
  const [novoModuloDescricao, setNovoModuloDescricao] = useState("");
  const [novoModuloNivel, setNovoModuloNivel] = useState<NivelModulo>("iniciante");
  const [novoModuloCarga, setNovoModuloCarga] = useState(10);
  const [novoModuloIcone, setNovoModuloIcone] = useState<string | null>(null);
  const [salvandoModulo, setSalvandoModulo] = useState(false);

  const [moduloEmEdicaoId, setModuloEmEdicaoId] = useState<string | null>(null);
  const [edicaoNome, setEdicaoNome] = useState("");
  const [edicaoDescricao, setEdicaoDescricao] = useState("");
  const [edicaoNivel, setEdicaoNivel] = useState<NivelModulo>("iniciante");
  const [edicaoCarga, setEdicaoCarga] = useState(10);
  const [edicaoIcone, setEdicaoIcone] = useState<string | null>(null);

  // dnd-kit: PointerSensor com pequena distância para o clique nos botões
  // internos não virar arraste; KeyboardSensor mantém acessível.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Confirmação inline, não window.confirm — dialogs nativos ficam
  // desabilitados em vários contextos embutidos/automatizados de browser.
  const [confirmandoApagarModuloId, setConfirmandoApagarModuloId] = useState<string | null>(null);
  // Trava enquanto uma reordenação está no ar: sem isso, Subir/Descer
  // seguiam clicáveis durante o round-trip e um segundo clique de reflexo
  // disparava outra troca de ordem (a ação duplicada relatada).
  const [reordenando, setReordenando] = useState(false);
  // Mesma proteção para salvar edição de módulo / apagar módulo: sem ela,
  // um segundo clique durante o round-trip refazia a ação.
  const [processandoModulo, setProcessandoModulo] = useState(false);
  // Módulos de outras trilhas que exigem o que vai ser apagado: o vínculo
  // sai junto (cascade no banco), então a coordenação confirma antes.
  const [avisoModulo, setAvisoModulo] = useState<{
    modulo: Modulo;
    dependentes: DependenteEmOutraTrilha[];
  } | null>(null);

  async function salvarTrilha(voltarParaLista: boolean) {
    setErro(null);
    setMensagem(null);
    const media = Number(mediaMinima);
    if (Number.isNaN(media) || media < 0 || media > 10) {
      setErro("A média mínima precisa ser um número entre 0 e 10.");
      return;
    }
    const frequencia = Number(frequenciaMinima);
    if (!Number.isInteger(frequencia) || frequencia < 0 || frequencia > 100) {
      setErro("A frequência mínima precisa ser um número inteiro entre 0 e 100.");
      return;
    }
    setSalvandoTrilha(true);
    try {
      const atualizada = await gravar(() =>
        atualizarTrilha(trilha.id, {
          nome,
          slug,
          descricao,
          descricao_curta: descricaoCurta || null,
          icone,
          tipo_certificacao: tipoCertificacao,
          media_minima: media,
          frequencia_minima_percentual: frequencia,
        }),
      );
      // A trilha salva vai direto para o cache do endereço (novo ou não)
      // antes de qualquer releitura: com o slug trocado, reler pelo
      // endereço antigo daria "não encontrada" no meio do caminho.
      qc.setQueryData(chaves.catalogo.trilhaPorSlug(atualizada.slug), atualizada);
      if (atualizada.slug !== slugRota) {
        // O slug é a chave da URL desta tela — troca a rota para o novo
        // endereço para um refresh não cair em "trilha não encontrada".
        navigate(`/coordenacao/trilhas/${atualizada.slug}/editar`, { replace: true });
      }
      void invalidar.catalogo(qc);
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
    setErro(null);
    setMensagem(null);
    setSalvandoModulo(true);
    try {
      await gravar(
        async () =>
          criarModulo({
            trilhaId: trilha.id,
            ordem: await proximaOrdemDisponivel(trilha.id),
            nome: novoModuloNome,
            descricao: novoModuloDescricao,
            nivel: novoModuloNivel,
            cargaHorariaHoras: novoModuloCarga,
            icone: novoModuloIcone,
          }),
        (qc) => invalidar.modulos(qc, trilha.id),
      );
      setNovoModuloNome("");
      setNovoModuloDescricao("");
      setNovoModuloNivel("iniciante");
      setNovoModuloCarga(10);
      setNovoModuloIcone(null);
      setMostrarNovoModulo(false);
      setMensagem("Módulo adicionado.");
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
    setEdicaoIcone(modulo.icone);
  }

  async function salvarEdicaoModulo(evento: FormEvent) {
    evento.preventDefault();
    if (!moduloEmEdicaoId || processandoModulo) return;
    setErro(null);
    setMensagem(null);
    setProcessandoModulo(true);
    try {
      const moduloId = moduloEmEdicaoId;
      await gravar(
        () =>
          atualizarModulo(moduloId, {
            nome: edicaoNome,
            descricao: edicaoDescricao,
            nivel: edicaoNivel,
            carga_horaria_horas: edicaoCarga,
            icone: edicaoIcone,
          }),
        (qc) => invalidar.modulos(qc, trilha.id),
      );
      setModuloEmEdicaoId(null);
      setMensagem("Módulo atualizado.");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar o módulo.");
    } finally {
      setProcessandoModulo(false);
    }
  }

  async function aoApagarModulo(modulo: Modulo, confirmado = false) {
    if (processandoModulo) return;
    setErro(null);
    setMensagem(null);
    setProcessandoModulo(true);
    try {
      if (!confirmado) {
        const dependentes = await listarDependentesEmOutrasTrilhas({ moduloId: modulo.id });
        if (dependentes.length > 0) {
          setConfirmandoApagarModuloId(null);
          setAvisoModulo({ modulo, dependentes });
          return;
        }
      }
      await gravar(() => apagarModulo(modulo.id), (qc) => invalidar.modulos(qc, trilha.id));
      setAvisoModulo(null);
      setMensagem("Módulo apagado.");
      setConfirmandoApagarModuloId(null);
    } catch (e) {
      setAvisoModulo(null);
      setErro(e instanceof Error ? e.message : "Não foi possível apagar o módulo.");
    } finally {
      setProcessandoModulo(false);
    }
  }

  async function mover(modulo: Modulo, direcao: "subir" | "descer") {
    if (reordenando) return;
    const indice = modulos.findIndex((m) => m.id === modulo.id);
    const alvo = direcao === "subir" ? modulos[indice - 1] : modulos[indice + 1];
    if (!alvo) return;
    setErro(null);
    setReordenando(true);
    try {
      await gravar(() => trocarOrdemModulos(modulo.id, alvo.id), (qc) => invalidar.modulos(qc, trilha.id));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível reordenar.");
    } finally {
      setReordenando(false);
    }
  }

  // Drag-and-drop: aplica a nova ordem na hora (otimista) e persiste em
  // lote; se o banco recusar, recarrega para voltar ao estado real.
  async function aoArrastar(evento: DragEndEvent) {
    const { active, over } = evento;
    if (!over || active.id === over.id) return;
    const de = modulos.findIndex((m) => m.id === active.id);
    const para = modulos.findIndex((m) => m.id === over.id);
    if (de < 0 || para < 0) return;

    const nova = arrayMove(modulos, de, para);
    qc.setQueryData<Modulo[]>(chaves.catalogo.modulos(trilha.id), nova);
    setErro(null);
    try {
      await gravar(() => reordenarModulos(nova.map((m) => m.id)), (qc) => invalidar.modulos(qc, trilha.id));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível reordenar.");
      await qc.invalidateQueries({ queryKey: chaves.catalogo.modulos(trilha.id) });
    }
  }

  async function aoAlternarPreRequisito(modulo: Modulo, preRequisitoId: string, ativo: boolean) {
    setErro(null);
    // Atualização otimista: o checkbox reflete a escolha na hora. Antes,
    // o estado só mudava depois de gravar e recarregar tudo, então a
    // marca de "selecionado" demorava um round-trip inteiro para sumir ao
    // desmarcar. Só recarregamos do banco se a gravação falhar (revertendo
    // para o estado real).
    qc.setQueryData<Map<string, Set<string>>>(chaves.catalogo.preRequisitosIdsDaTrilha(trilha.id), (atual) => {
      const copia = new Map(atual);
      const doModulo = new Set(copia.get(modulo.id) ?? []);
      if (ativo) doModulo.add(preRequisitoId);
      else doModulo.delete(preRequisitoId);
      copia.set(modulo.id, doModulo);
      return copia;
    });
    try {
      await gravar(
        () => definirPreRequisito(modulo.id, preRequisitoId, ativo),
        (qc) => invalidar.preRequisitos(qc, trilha.id),
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível atualizar o pré-requisito.");
      await qc.invalidateQueries({ queryKey: chaves.catalogo.preRequisitosIdsDaTrilha(trilha.id) });
    }
  }

  return (
    <PaginaAutenticada titulo="Editar trilha" sobrelinha={trilha.nome} voltar={{}}>

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
        {erroDeLeitura && (
          <ErroConsulta
            className="mb-4"
            erro={erroDeLeitura}
            padrao="Não foi possível carregar os módulos da trilha."
            tentarDeNovo={() => {
              if (consultaModulos.isError) void consultaModulos.refetch();
              if (consultaPreRequisitos.isError) void consultaPreRequisitos.refetch();
            }}
          />
        )}

        <Card className="mb-6">
          <form className="flex flex-col gap-4" onSubmit={aoSubmeterFormularioTrilha}>
            <label className="flex flex-col gap-1.5">
              <span className="text-label font-medium text-text-secondary">Nome</span>
              <Input required value={nome} onChange={(e) => setNome(e.target.value)} />
            </label>

            <div className="flex flex-col gap-1.5">
              <span className="text-label font-medium text-text-secondary">Ícone</span>
              <IconePicker valor={icone} onChange={setIcone} />
            </div>

            <label className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-label font-medium text-text-secondary">Endereço da página</span>
                <button
                  type="button"
                  onClick={() => setSlug(gerarSlug(nome))}
                  className="text-label font-medium text-primary hover:underline"
                >
                  Sincronizar com o nome
                </button>
              </div>
              <Input required value={slug} onChange={(e) => setSlug(e.target.value)} />
              <span className="text-label text-text-muted">
                Esse texto aparece no link da trilha (/catalogo/{slug || "..."}). Evite espaços e
                acentos. Mudar depois de publicado pode quebrar links já compartilhados.
              </span>
              {/* Aviso inline, não bloqueante: coordenador decide se salva assim mesmo. */}
              {slug !== trilha.slug && (
                <span className="text-label font-medium text-danger">
                  Você mudou o endereço: links antigos para /catalogo/{trilha.slug} deixarão de
                  funcionar.
                </span>
              )}
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-label font-medium text-text-secondary">Descrição curta</span>
              <Input
                maxLength={200}
                value={descricaoCurta}
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
                className="rounded-klass-control border border-controle bg-surface px-3.5 py-2 text-body-sm text-text-primary transition focus:border-primary"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
              />
              <span className="text-label text-text-muted">
                Aparece na página de detalhe da trilha, quando o aluno já demonstrou interesse. Pode
                ser mais detalhada.
              </span>
            </label>

            <CamposCertificacao
              tipoCertificacao={tipoCertificacao}
              onTipoChange={setTipoCertificacao}
              mediaMinima={mediaMinima}
              frequenciaMinima={frequenciaMinima}
              onFrequenciaChange={setFrequenciaMinima}
              onMediaChange={setMediaMinima}
              aviso={
                temCertificados && tipoCertificacao !== trilha.tipo_certificacao ? (
                  <span className="text-label font-medium text-danger">
                    Esta trilha já tem certificados emitidos. Mudar o tipo não altera os documentos
                    já emitidos — vale só para as conclusões daqui para frente.
                  </span>
                ) : undefined
              }
            />

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

        <div className="mb-4 flex items-center justify-between">
          {consultaModulos.data ? (
            <Titulo nivel="secao">
              Módulos ({modulos.length}) ·{" "}
              {/* Soma dos módulos da tela, não trilha.carga_horaria_total:
                  acompanha cada operação sem depender de reler a trilha. */}
              {modulos.reduce((soma, m) => soma + m.carga_horaria_horas, 0)}h
            </Titulo>
          ) : (
            <RegiaoCarregando>
              <Esqueleto className="h-6 w-40" />
            </RegiaoCarregando>
          )}
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
              <div className="flex flex-col gap-1.5">
                <span className="text-label font-medium text-text-secondary">Ícone</span>
                <IconePicker valor={novoModuloIcone} onChange={setNovoModuloIcone} />
              </div>
              <div className="flex gap-4">
                <label className="flex flex-1 flex-col gap-1.5">
                  <span className="text-label font-medium text-text-secondary">Nível</span>
                  <select
                    className="h-12 sm:h-10 rounded-klass-control border border-controle bg-surface px-3.5 text-body-sm text-text-primary transition focus:border-primary"
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

        {(consultaModulos.isPending || consultaPreRequisitos.isPending) && !erroDeLeitura && (
          <EsqueletoCards quantidade={3} altura="h-36" />
        )}
        {consultaModulos.data && consultaPreRequisitos.data && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={aoArrastar}>
          <SortableContext
            items={modulos.map((m) => m.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-3">
              {modulos.map((modulo, indice) => (
                <Arrastavel key={modulo.id} id={modulo.id}>
                  <Card className="flex flex-col gap-3">
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
                      className="h-12 sm:h-10 flex-1 rounded-klass-control border border-controle bg-surface px-3.5 text-body-sm text-text-primary transition focus:border-primary"
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
                  <div className="flex flex-col gap-1.5">
                    <span className="text-label font-medium text-text-secondary">Ícone</span>
                    <IconePicker valor={edicaoIcone} onChange={setEdicaoIcone} />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={processandoModulo}>
                      {processandoModulo ? "Salvando..." : "Salvar"}
                    </Button>
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
                      <IconeCatalogo nome={modulo.icone} className="h-4 w-4 text-text-muted" />
                      <Titulo nivel="item" as="h3">
                        {modulo.nome}
                      </Titulo>
                      <Badge variant="contorno">{NIVEL_LABEL[modulo.nivel]}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        disabled={indice === 0 || reordenando}
                        onClick={() => void mover(modulo, "subir")}
                      >
                        Subir
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={indice === modulos.length - 1 || reordenando}
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
                          <Button
                            variant="secondary"
                            disabled={processandoModulo}
                            onClick={() => void aoApagarModulo(modulo)}
                          >
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
                      {modulos.length === 1 && opcoesDeFora.length === 0 && (
                        <span className="text-label text-text-muted">
                          Nenhum outro módulo disponível ainda.
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
                      {[...(preRequisitos.get(modulo.id) ?? [])]
                        .filter((id) => !modulos.some((m) => m.id === id))
                        .map((id) => (
                          <label
                            key={id}
                            className="flex items-center gap-1.5 text-body-sm text-text-secondary"
                          >
                            <input
                              type="checkbox"
                              checked
                              onChange={() => void aoAlternarPreRequisito(modulo, id, false)}
                            />
                            {rotuloDeFora(modulo.id, id)}
                          </label>
                        ))}
                    </div>
                    {opcoesDeFora.length > 0 && (
                      <select
                        aria-label={`Adicionar pré-requisito de outra trilha para ${modulo.nome}`}
                        value=""
                        onChange={(e) => {
                          if (e.target.value) void aoAlternarPreRequisito(modulo, e.target.value, true);
                        }}
                        className="mt-2 h-12 sm:h-10 w-full sm:w-auto rounded-klass-control border border-controle bg-surface px-3.5 text-body-sm text-text-primary transition focus:border-primary"
                      >
                        <option value="">Adicionar módulo de outra trilha…</option>
                        {trilhasDeFora.map((nomeTrilha) => (
                          <optgroup key={nomeTrilha} label={nomeTrilha}>
                            {opcoesDeFora
                              .filter(
                                (m) =>
                                  m.trilhaNome === nomeTrilha && !preRequisitos.get(modulo.id)?.has(m.id),
                              )
                              .map((m) => (
                                <option key={m.id} value={m.id}>
                                  {nomeTrilha} · {m.nome}
                                </option>
                              ))}
                          </optgroup>
                        ))}
                      </select>
                    )}
                  </div>

                  <AvaliacoesPadraoDoModulo moduloId={modulo.id} />
                </>
              )}
                  </Card>
                </Arrastavel>
              ))}
            </div>
          </SortableContext>
        </DndContext>
        )}

        <ModalDesvincularPreRequisitos
          aberto={avisoModulo !== null}
          acao="Apagar"
          dependentes={avisoModulo?.dependentes ?? []}
          processando={processandoModulo}
          onCancelar={() => setAvisoModulo(null)}
          onConfirmar={() => avisoModulo && void aoApagarModulo(avisoModulo.modulo, true)}
        />
    </PaginaAutenticada>
  );
}
