// Testes das rotas de webhook do Worker, em Node, sem rede: o fetch global
// (usado pelo supabase-js e pelo envio ao Resend) é simulado.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import app from "../src/index";

const SEGREDO = "segredo-de-teste-com-32-caracteres";
const ROTA = "/webhooks/inscricao-recebida";
const ALUNO = "a1000000-0000-4000-8000-000000000001";

const ENV = {
  SUPABASE_URL: "https://banco.exemplo.test",
  SUPABASE_SERVICE_ROLE_KEY: "chave-service-role-falsa",
  RESEND_API_KEY: "chave-resend-falsa",
  WEBHOOK_SECRET: SEGREDO,
  ALLOWED_ORIGIN: "https://klass.exemplo.test",
  EMAIL_REMETENTE: "Klass <no-reply@exemplo.test>",
};

const PAYLOAD = {
  type: "INSERT",
  table: "matriculas",
  schema: "selecao",
  record: { id: "m1", aluno_id: ALUNO, turma_id: "t1", status: "inscrita" },
};

function chamar(corpo: string, env: Record<string, unknown>, autorizacao?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (autorizacao !== undefined) headers.Authorization = autorizacao;
  return app.request(ROTA, { method: "POST", headers, body: corpo }, env);
}

function json(corpo: unknown) {
  return new Response(JSON.stringify(corpo), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// Respostas falsas do PostgREST, da Admin API do Auth e do Resend.
const fetchFalso = vi.fn(async (entrada: RequestInfo | URL) => {
  const url = String(entrada instanceof Request ? entrada.url : entrada);
  if (url.startsWith("https://api.resend.com/")) return json({ id: "email-1" });
  if (url.includes(`/auth/v1/admin/users/${ALUNO}`)) return json({ id: ALUNO, email: "aluna@exemplo.test" });
  if (url.includes("/rest/v1/turmas")) return json({ codigo: "WEB-1", periodo_inicio: "2026-12-01", modulo_id: "mod1" });
  if (url.includes("/rest/v1/modulos")) return json({ nome: "HTML e CSS", trilha_id: "tr1" });
  if (url.includes("/rest/v1/trilhas")) return json({ nome: "Desenvolvimento Web" });
  if (url.includes("/rest/v1/profiles")) return json({ nome_completo: "Ana Souza" });
  throw new Error(`chamada de rede inesperada: ${url}`);
});

beforeEach(() => {
  vi.stubGlobal("fetch", fetchFalso);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  fetchFalso.mockClear();
});

describe("webhook inscricao-recebida", () => {
  it("recusa (401) sem cabeçalho Authorization", async () => {
    const res = await chamar(JSON.stringify(PAYLOAD), ENV);
    expect(res.status).toBe(401);
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it("recusa (401) com WEBHOOK_SECRET ausente e cabeçalho 'Bearer undefined'", async () => {
    const { WEBHOOK_SECRET: _, ...semSegredo } = ENV;
    const res = await chamar(JSON.stringify(PAYLOAD), semSegredo, "Bearer undefined");
    expect(res.status).toBe(401);
  });

  it("recusa (401) com WEBHOOK_SECRET vazio e cabeçalho 'Bearer '", async () => {
    const res = await chamar(JSON.stringify(PAYLOAD), { ...ENV, WEBHOOK_SECRET: "" }, "Bearer ");
    expect(res.status).toBe(401);
  });

  it("recusa (401) com WEBHOOK_SECRET curto demais, mesmo com o cabeçalho certo", async () => {
    const res = await chamar(JSON.stringify(PAYLOAD), { ...ENV, WEBHOOK_SECRET: "curto" }, "Bearer curto");
    expect(res.status).toBe(401);
  });

  it("recusa (401) com segredo errado", async () => {
    const res = await chamar(JSON.stringify(PAYLOAD), ENV, `Bearer ${SEGREDO}x`);
    expect(res.status).toBe(401);
  });

  it("responde 400 com JSON inválido", async () => {
    const res = await chamar("{isto não é json", ENV, `Bearer ${SEGREDO}`);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "corpo JSON inválido" });
  });

  it("responde 200 e envia o e-mail no caminho feliz", async () => {
    const res = await chamar(JSON.stringify(PAYLOAD), ENV, `Bearer ${SEGREDO}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ enviado: true });

    const envio = fetchFalso.mock.calls.find(([u]) => String(u).startsWith("https://api.resend.com/"));
    expect(envio).toBeDefined();
    const corpo = JSON.parse(String((envio![1] as RequestInit).body));
    expect(corpo.to).toBe("aluna@exemplo.test");
    expect(corpo.from).toBe(ENV.EMAIL_REMETENTE);
    expect(corpo.subject).toContain("HTML e CSS");
  });
});

describe("app", () => {
  it("erro não tratado vira JSON 500", async () => {
    // URL inválida faz o createClient lançar dentro da rota.
    const res = await chamar(JSON.stringify(PAYLOAD), { ...ENV, SUPABASE_URL: "não é url" }, `Bearer ${SEGREDO}`);
    expect(res.status).toBe(500);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(await res.json()).toEqual({ error: "erro interno" });
  });

  it("CORS só libera GET, POST e OPTIONS", async () => {
    const res = await app.request(
      ROTA,
      { method: "OPTIONS", headers: { Origin: ENV.ALLOWED_ORIGIN, "Access-Control-Request-Method": "POST" } },
      ENV,
    );
    expect(res.headers.get("access-control-allow-methods")).toBe("GET,POST,OPTIONS");
  });
});
