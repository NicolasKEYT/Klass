import type { Context } from "hono";
import type { Env } from "./env";

// Segredo curto ou ausente vira "Bearer undefined"/"Bearer " — fácil de
// adivinhar. Sem um segredo decente configurado, nenhuma chamada passa.
const TAMANHO_MINIMO_SEGREDO = 16;

/**
 * Compara em tempo constante (xor de todos os bytes), para o tempo de
 * resposta não revelar quantos caracteres do segredo acertaram.
 * `crypto.subtle.timingSafeEqual` só existe no runtime da Cloudflare; os
 * testes rodam em Node, por isso a comparação é própria.
 */
function iguaisEmTempoConstante(a: string, b: string): boolean {
  const ba = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  let diferenca = ba.length ^ bb.length;
  const n = Math.max(ba.length, bb.length);
  for (let i = 0; i < n; i++) {
    diferenca |= (ba[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diferenca === 0;
}

/**
 * Confere o `Authorization: Bearer <segredo>` que os triggers (pg_net) mandam
 * com o segredo do Vault (`webhook_secret`, igual ao WEBHOOK_SECRET do Worker).
 * Usada por todas as rotas de webhook.
 */
export function autorizarWebhook(c: Context<{ Bindings: Env }>): boolean {
  const segredo = c.env?.WEBHOOK_SECRET;
  if (typeof segredo !== "string" || segredo.length < TAMANHO_MINIMO_SEGREDO) {
    console.error("webhook: WEBHOOK_SECRET ausente ou curto demais; chamada recusada");
    return false;
  }
  const autorizacao = c.req.header("Authorization") ?? "";
  return iguaisEmTempoConstante(autorizacao, `Bearer ${segredo}`);
}

/** Lê o corpo JSON; `null` se não for JSON válido (a rota responde 400). */
export async function lerCorpoJson<T>(c: Context<{ Bindings: Env }>): Promise<T | null> {
  try {
    return await c.req.json<T>();
  } catch {
    return null;
  }
}
