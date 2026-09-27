import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Check, CloudOff, Loader2 } from "lucide-react";

// D13 (klass-uikit.pdf) — "o estado de sincronização fica sempre visível:
// tempo real, salvando, salvo, sem conexão". Contexto único no shell
// autenticado: por padrão reflete a conectividade real do navegador
// (tempo real quando online, sem conexão quando offline); telas com
// gravação própria (chamada, grade de notas) chamam notificarSalvando/
// notificarSalvo para substituir o "tempo real" genérico pelo estado real
// daquela operação, sem cada tela reimplementar o indicador.
type EstadoSincronizacao = "tempo-real" | "salvando" | "salvo" | "sem-conexao";

interface SincronizacaoContextValue {
  estado: EstadoSincronizacao;
  salvoEm: Date | null;
  notificarSalvando: () => void;
  notificarSalvo: () => void;
  /** Falha ao salvar: volta para "tempo real"/"sem conexão" sem fingir sucesso. */
  notificarErro: () => void;
}

const SincronizacaoContext = createContext<SincronizacaoContextValue | null>(null);

export function SincronizacaoProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [estadoManual, setEstadoManual] = useState<"salvando" | "salvo" | null>(null);
  const [salvoEm, setSalvoEm] = useState<Date | null>(null);

  useEffect(() => {
    function aoFicarOnline() {
      setOnline(true);
    }
    function aoFicarOffline() {
      setOnline(false);
    }
    window.addEventListener("online", aoFicarOnline);
    window.addEventListener("offline", aoFicarOffline);
    return () => {
      window.removeEventListener("online", aoFicarOnline);
      window.removeEventListener("offline", aoFicarOffline);
    };
  }, []);

  const estado: EstadoSincronizacao = !online
    ? "sem-conexao"
    : estadoManual === "salvando"
      ? "salvando"
      : estadoManual === "salvo"
        ? "salvo"
        : "tempo-real";

  const valor: SincronizacaoContextValue = {
    estado,
    salvoEm,
    notificarSalvando: () => setEstadoManual("salvando"),
    notificarSalvo: () => {
      setEstadoManual("salvo");
      setSalvoEm(new Date());
    },
    notificarErro: () => setEstadoManual(null),
  };

  return (
    <SincronizacaoContext.Provider value={valor}>{children}</SincronizacaoContext.Provider>
  );
}

export function useSincronizacao(): SincronizacaoContextValue {
  const contexto = useContext(SincronizacaoContext);
  if (!contexto) {
    throw new Error("useSincronizacao precisa ser usado dentro de um <SincronizacaoProvider>.");
  }
  return contexto;
}

function formatarHora(data: Date): string {
  return data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

// Prompt 17 — mapeamento de forma corrigido por pixel-comparação direta
// com a página de Fundamentos: "Tempo real" e "Salvo" são contorno,
// "Salvando..." é tracejado (estado incerto/em andamento), "Sem conexão"
// é preenchido a preto (o único estado que exige atenção imediata). Cor
// nunca é verde/vermelha — só preto, contorno ou tracejado.
export function IndicadorSincronizacao({ className = "" }: { className?: string }) {
  const { estado, salvoEm } = useSincronizacao();

  const conteudo: Record<
    EstadoSincronizacao,
    { texto: string; icone: ReactNode; classeForma: string }
  > = {
    "tempo-real": {
      texto: "Tempo real",
      icone: <span className="h-2 w-2 rounded-full bg-text-primary" aria-hidden />,
      classeForma: "border border-border bg-surface text-text-secondary",
    },
    salvando: {
      texto: "Salvando...",
      icone: <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />,
      classeForma: "border border-dashed border-border bg-surface text-text-secondary",
    },
    salvo: {
      texto: salvoEm ? `Salvo às ${formatarHora(salvoEm)}` : "Salvo",
      icone: <Check className="h-3.5 w-3.5" aria-hidden />,
      classeForma: "border border-border bg-surface text-text-primary",
    },
    "sem-conexao": {
      texto: "Sem conexão",
      icone: <CloudOff className="h-3.5 w-3.5" aria-hidden />,
      classeForma: "bg-text-primary text-white",
    },
  };

  const { texto, icone, classeForma } = conteudo[estado];

  return (
    <span
      role="status"
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-klass-pill px-3 py-1 text-label font-medium ${classeForma} ${className}`}
    >
      {icone}
      {texto}
    </span>
  );
}
