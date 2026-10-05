import type { ReactNode } from "react";
import { Card } from "@/components/Card";
import { formatarDiaSemanaData, paraIsoLocal } from "@/lib/formato";

// Seção "Esta semana" das três telas iniciais: um cartão compacto abaixo
// do que é do dia, com blocos curtos (título pequeno + lista). Mesmo
// desenho nos três papéis para a semana se ler igual em qualquer tela.
export function CartaoEstaSemana({ subtitulo, children }: { subtitulo: string; children: ReactNode }) {
  return (
    <Card className="mt-4">
      <div className="mb-3 border-b border-border pb-3">
        <h2 className="text-klass-lg text-text-primary">Esta semana</h2>
        <p className="text-label text-text-muted">{subtitulo}</p>
      </div>
      <div className="grid gap-x-8 gap-y-5 lg:grid-cols-2">{children}</div>
    </Card>
  );
}

export function BlocoDaSemana({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="min-w-0">
      <h3 className="mb-2 text-body-sm font-semibold text-text-primary">{titulo}</h3>
      {children}
    </section>
  );
}

/** Estado vazio curto e honesto ("Nenhuma aula nos próximos 7 dias."). */
export function VazioDaSemana({ children }: { children: ReactNode }) {
  return <p className="text-body-sm text-text-secondary">{children}</p>;
}

/** "Hoje · sáb 03/10", "Amanhã · dom 04/10" ou "seg 05/10". */
export function rotuloDoDia(data: string, agora = new Date()): string {
  const hoje = paraIsoLocal(agora);
  const amanha = paraIsoLocal(new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1));
  const dia = formatarDiaSemanaData(data);
  if (data === hoje) return `Hoje · ${dia}`;
  if (data === amanha) return `Amanhã · ${dia}`;
  return dia;
}

/**
 * Teto de itens por lista: a seção é um resumo, não a agenda inteira. O
 * resto aparece como "e mais N", com o caminho para a lista completa.
 */
export const MAXIMO_NA_SEMANA = 8;

export function EMais({ quantidade, children }: { quantidade: number; children: ReactNode }) {
  if (quantidade <= 0) return null;
  return (
    <p className="mt-2 text-label text-text-secondary">
      e mais {quantidade} · {children}
    </p>
  );
}
