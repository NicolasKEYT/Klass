import { useRef, useState, type FormEvent } from "react";
import { Download, ExternalLink, FileText, Pencil, Trash2, Upload } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EsqueletoCards } from "@/components/Esqueleto";
import { ErroConsulta } from "@/components/ErroConsulta";
import { Input } from "@/components/Input";
import { chaves } from "@/lib/consultas/chaves";
import { useMateriaisDaTurma } from "@/lib/consultas/diario";
import { useGravacao } from "@/lib/consultas/gravacao";
import { formatarDataHora } from "@/lib/formato";
import {
  ACEITOS_MATERIAL,
  TIPOS_MATERIAL,
  abreNoNavegador,
  apagarMaterial,
  enviarMaterial,
  formatarTamanho,
  renomearMaterial,
  urlDoMaterial,
  validarArquivoMaterial,
  type MaterialListado,
} from "@/lib/materiais";

// Materiais da turma (pedido do dono do produto: "upload de arquivos igual
// ao Moodle; o aluno baixa ou visualiza no navegador").
//   modo "gestao"  — professor da turma (e coordenação): enviar com
//                    progresso, renomear o título, apagar com confirmação;
//   modo "leitura" — aluno com matrícula na turma: abrir/baixar.
// PDF e imagem abrem no navegador por URL assinada de 2 minutos; os demais
// tipos baixam com o nome original. Quem não tem acesso nem vê a lista (RLS).
export function MateriaisDaTurma({ turmaId, modo }: { turmaId: string; modo: "gestao" | "leitura" }) {
  const gravar = useGravacao();
  const consulta = useMateriaisDaTurma(turmaId);
  const materiais = consulta.data ?? [];
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [titulo, setTitulo] = useState("");
  const [progresso, setProgresso] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [renomeandoId, setRenomeandoId] = useState<string | null>(null);
  const [novoTitulo, setNovoTitulo] = useState("");
  const [apagandoId, setApagandoId] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const campoArquivo = useRef<HTMLInputElement>(null);
  const invalidarLista = (qc: import("@tanstack/react-query").QueryClient) =>
    qc.invalidateQueries({ queryKey: chaves.diario.materiais(turmaId) });

  function aoEscolher(f: File | null) {
    setErro(null);
    setMensagem(null);
    if (!f) return setArquivo(null);
    const motivo = validarArquivoMaterial(f);
    if (motivo) {
      setArquivo(null);
      if (campoArquivo.current) campoArquivo.current.value = "";
      return setErro(motivo);
    }
    setArquivo(f);
    if (!titulo.trim()) setTitulo(f.name.replace(/\.[^.]+$/, ""));
  }

  async function aoEnviar(e: FormEvent) {
    e.preventDefault();
    if (!arquivo) return;
    setErro(null);
    setMensagem(null);
    setProgresso(0);
    try {
      await gravar(() => enviarMaterial({ turmaId, titulo, arquivo, aoProgresso: setProgresso }), invalidarLista);
      setMensagem(`"${titulo.trim() || arquivo.name}" enviado.`);
      setArquivo(null);
      setTitulo("");
      if (campoArquivo.current) campoArquivo.current.value = "";
    } catch (e2) {
      setErro(e2 instanceof Error ? e2.message : "Não foi possível enviar o arquivo.");
    } finally {
      setProgresso(null);
    }
  }

  async function executar(acao: () => Promise<void>, sucesso: string) {
    setErro(null);
    setMensagem(null);
    setOcupado(true);
    try {
      await gravar(acao, invalidarLista);
      setMensagem(sucesso);
      return true;
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível concluir a ação.");
      return false;
    } finally {
      setOcupado(false);
    }
  }

  async function abrir(m: MaterialListado) {
    setErro(null);
    // Janela aberta já no clique (antes do await), senão o navegador a
    // bloqueia como pop-up.
    const baixar = !abreNoNavegador(m.tipo_mime);
    const janela = baixar ? null : window.open("", "_blank");
    try {
      const url = await urlDoMaterial(m, baixar);
      if (janela) janela.location.href = url;
      else {
        const a = document.createElement("a");
        a.href = url;
        a.download = m.nome_arquivo;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } catch (e) {
      janela?.close();
      setErro(e instanceof Error ? e.message : "Não foi possível abrir o material.");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {erro && <Aviso variant="danger">{erro}</Aviso>}
      {mensagem && <Aviso variant="success">{mensagem}</Aviso>}

      {modo === "gestao" && (
        <Card>
          <form className="flex flex-col gap-3" onSubmit={(e) => void aoEnviar(e)}>
            <label className="flex flex-col gap-1.5">
              <span className="text-label font-medium text-text-secondary">Arquivo</span>
              <input
                ref={campoArquivo}
                type="file"
                accept={ACEITOS_MATERIAL}
                onChange={(e) => aoEscolher(e.target.files?.[0] ?? null)}
                className="text-body-sm text-text-primary file:mr-3 file:rounded-klass-control file:border file:border-border file:bg-surface file:px-3 file:py-1.5 file:text-body-sm file:text-text-primary"
              />
              <span className="text-label text-text-muted">
                Até 20 MB. PDF, imagem (PNG, JPG, WEBP), documento, planilha, apresentação (Office ou
                LibreOffice) ou ZIP. PDF e imagem abrem no navegador do aluno; os demais são baixados.
              </span>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-label font-medium text-text-secondary">Título</span>
              <Input value={titulo} maxLength={150} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Slides da aula 3" />
            </label>
            {progresso !== null && (
              <div className="flex items-center gap-3" role="status" aria-live="polite">
                <div className="h-2 flex-1 overflow-hidden rounded-klass-pill bg-neutral-subtle">
                  <div className="h-full bg-primary transition-all" style={{ width: `${Math.round(progresso * 100)}%` }} />
                </div>
                <span className="font-mono text-label tabular-nums text-text-secondary">{Math.round(progresso * 100)}%</span>
              </div>
            )}
            <Button type="submit" className="self-start" disabled={!arquivo || progresso !== null}>
              <Upload className="mr-1.5 h-4 w-4" aria-hidden />
              {progresso !== null ? "Enviando..." : "Enviar material"}
            </Button>
          </form>
        </Card>
      )}

      {consulta.isPending && <EsqueletoCards quantidade={2} altura="h-16" />}
      {consulta.isError && (
        <ErroConsulta erro={consulta.error} padrao="Não foi possível carregar os materiais." tentarDeNovo={() => void consulta.refetch()} />
      )}
      {consulta.data && materiais.length === 0 && (
        <p className="text-body-sm text-text-secondary">
          {modo === "gestao" ? "Nenhum material enviado ainda." : "O professor ainda não publicou materiais nesta turma."}
        </p>
      )}

      {materiais.length > 0 && (
        <ul className="flex flex-col divide-y divide-border rounded-klass-card border border-border bg-surface">
          {materiais.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              {renomeandoId === m.id ? (
                <form
                  className="flex flex-1 flex-wrap items-end gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void executar(() => renomearMaterial(m.id, novoTitulo), "Título atualizado.").then((ok) => ok && setRenomeandoId(null));
                  }}
                >
                  <Input className="min-w-48 flex-1" value={novoTitulo} maxLength={150} onChange={(e) => setNovoTitulo(e.target.value)} aria-label="Novo título" />
                  <Button type="submit" disabled={ocupado || !novoTitulo.trim()}>
                    Salvar
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setRenomeandoId(null)}>
                    Cancelar
                  </Button>
                </form>
              ) : (
                <>
                  <div className="flex min-w-0 items-start gap-3">
                    <FileText className="mt-0.5 h-5 w-5 shrink-0 text-text-secondary" aria-hidden />
                    <div className="min-w-0">
                      <p className="break-words text-body-sm font-medium text-text-primary">{m.titulo}</p>
                      <p className="text-label text-text-muted">
                        {TIPOS_MATERIAL[m.tipo_mime] ?? "Arquivo"} · {formatarTamanho(m.tamanho_bytes)} · {formatarDataHora(m.enviado_em)}
                        {m.enviadoPorNome ? ` · ${m.enviadoPorNome}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <button
                      type="button"
                      onClick={() => void abrir(m)}
                      className="flex items-center gap-1 text-body-sm font-medium text-primary hover:underline"
                    >
                      {abreNoNavegador(m.tipo_mime) ? (
                        <>
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                          Abrir
                        </>
                      ) : (
                        <>
                          <Download className="h-3.5 w-3.5" aria-hidden />
                          Baixar
                        </>
                      )}
                    </button>
                    {modo === "gestao" &&
                      (apagandoId === m.id ? (
                        <span className="flex items-center gap-2">
                          <span className="text-label text-text-secondary">Apagar o arquivo para todos?</span>
                          <Button
                            variant="secondary"
                            disabled={ocupado}
                            onClick={() => void executar(() => apagarMaterial(m), "Material apagado.").then(() => setApagandoId(null))}
                          >
                            Apagar
                          </Button>
                          <Button variant="secondary" onClick={() => setApagandoId(null)}>
                            Cancelar
                          </Button>
                        </span>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setRenomeandoId(m.id);
                              setNovoTitulo(m.titulo);
                            }}
                            className="flex items-center gap-1 text-body-sm font-medium text-text-secondary hover:text-text-primary"
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden />
                            Renomear
                          </button>
                          <button
                            type="button"
                            onClick={() => setApagandoId(m.id)}
                            className="flex items-center gap-1 text-body-sm font-medium text-text-secondary hover:text-danger"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden />
                            Apagar
                          </button>
                        </>
                      ))}
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
