import { Hono } from "hono";
import type { Env } from "./shared/env";
import { corsMiddleware } from "./shared/cors";
import {
  receberCertificadoEmitido,
  receberInscricaoRecebida,
  receberMatriculaDeferida,
} from "./webhooks";

const app = new Hono<{ Bindings: Env }>();

app.use("*", corsMiddleware());

// Erro não tratado vira JSON 500 (o padrão do Hono é texto), sem expor detalhes;
// o erro completo fica só no log do Worker.
app.onError((erro, c) => {
  console.error("erro não tratado", erro);
  return c.json({ error: "erro interno" }, 500);
});

app.get("/health", (c) => c.json({ status: "ok" }));

app.post("/webhooks/inscricao-recebida", receberInscricaoRecebida);
app.post("/webhooks/matricula-deferida", receberMatriculaDeferida);
app.post("/webhooks/certificado-emitido", receberCertificadoEmitido);

export default app;
