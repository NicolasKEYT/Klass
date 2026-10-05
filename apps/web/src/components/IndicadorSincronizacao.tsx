import { useEffect, useRef, useState, type ReactNode } from "react";
import { useIsMutating } from "@tanstack/react-query";
import { Check, CloudOff, Loader2 } from "lucide-react";
import { useUltimaGravacao } from "@/lib/consultas/estadoGravacao";
import { supabase } from "@/lib/supabase";
import { formatarHora } from "@/lib/formato";

// D13 (klass-uikit.pdf) — "o estado de sincronização fica sempre visível:
// tempo real, salvando, salvo, sem conexão". Mora na faixa superior da
// casca persistente, então o estado sobrevive à troca de tela. Lê tudo do
// estado real, sem cada tela avisar nada:
// - sem conexão: navegador offline, ou canais do Realtime abertos com o
//   socket caído (as atualizações ao vivo pararam de chegar);
// - salvando: alguma gravação (useGravacao → mutation) ainda no ar;
// - salvo às HH:MM: horário da última gravação concluída;
// - tempo real: o resto.
type EstadoSincronizacao = "tempo-real" | "salvando" | "salvo" | "sem-conexao";

function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  useEffect(() => {
    const aoFicarOnline = () => setOnline(true);
    const aoFicarOffline = () => setOnline(false);
    window.addEventListener("online", aoFicarOnline);
    window.addEventListener("offline", aoFicarOffline);
    return () => {
      window.removeEventListener("online", aoFicarOnline);
      window.removeEventListener("offline", aoFicarOffline);
    };
  }, []);
  return online;
}

// O supabase-js não emite evento público de mudança de conexão do
// Realtime; consulta o socket e o estado dos canais ativos a cada 2 s.
// Tolerância de 5 s fora do ar antes de avisar: a conexão inicial e as
// reconexões automáticas não devem piscar "Sem conexão".
const TOLERANCIA_MS = 5_000;

function useRealtimeCaido(): boolean {
  const [caido, setCaido] = useState(false);
  const foraDesde = useRef<number | null>(null);
  useEffect(() => {
    if (!supabase) return;
    const cliente = supabase;
    function verificar() {
      const canais = cliente.getChannels();
      const conectado =
        canais.length === 0 ||
        (cliente.realtime.isConnected() && canais.every((c) => c.state !== "errored" && c.state !== "closed"));
      if (conectado) foraDesde.current = null;
      else foraDesde.current ??= Date.now();
      setCaido(foraDesde.current !== null && Date.now() - foraDesde.current >= TOLERANCIA_MS);
    }
    verificar();
    const intervalo = window.setInterval(verificar, 2_000);
    return () => window.clearInterval(intervalo);
  }, []);
  return caido;
}

// Prompt 17 — mapeamento de forma corrigido por pixel-comparação direta
// com a página de Fundamentos: "Tempo real" e "Salvo" são contorno,
// "Salvando..." é tracejado (estado incerto/em andamento), "Sem conexão"
// é preenchido a preto (o único estado que exige atenção imediata). Cor
// nunca é verde/vermelha — só preto, contorno ou tracejado.
export function IndicadorSincronizacao({ className = "" }: { className?: string }) {
  const online = useOnline();
  const realtimeCaido = useRealtimeCaido();
  const gravando = useIsMutating() > 0;
  const salvoEm = useUltimaGravacao();

  const estado: EstadoSincronizacao =
    !online || realtimeCaido ? "sem-conexao" : gravando ? "salvando" : salvoEm ? "salvo" : "tempo-real";

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
      classeForma: "bg-text-primary text-primary-contraste",
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
