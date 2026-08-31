import { cors } from "hono/cors";
import type { Env } from "./env";

const DEV_ORIGIN = "http://localhost:5173";

// Origem explícita (nunca "*") porque as respostas carregam credenciais
// (JWT da sessão via header Authorization).
export function corsMiddleware() {
  return cors({
    origin: (_origin, c) => (c.env as Env).ALLOWED_ORIGIN ?? DEV_ORIGIN,
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  });
}
