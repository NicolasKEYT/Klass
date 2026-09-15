import { Hono } from "hono";
import type { Env } from "./shared/env";
import { corsMiddleware } from "./shared/cors";
import { receberMatriculaDeferida, receberCertificadoEmitido } from "./webhooks";

const app = new Hono<{ Bindings: Env }>();

app.use("*", corsMiddleware());

app.get("/health", (c) => c.json({ status: "ok" }));

app.post("/webhooks/matricula-deferida", receberMatriculaDeferida);
app.post("/webhooks/certificado-emitido", receberCertificadoEmitido);

export default app;
