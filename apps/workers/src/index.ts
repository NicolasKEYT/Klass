import { Hono } from "hono";
import type { Env } from "./shared/env";
import { corsMiddleware } from "./shared/cors";

const app = new Hono<{ Bindings: Env }>();

app.use("*", corsMiddleware());

app.get("/health", (c) => c.json({ status: "ok" }));

export default app;
