import { supabase } from "@/lib/supabase";

const workersUrl = import.meta.env.VITE_WORKERS_URL;

interface CallWorkerOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

/**
 * Chama um endpoint dos Cloudflare Workers, anexando o JWT da sessão do
 * Supabase quando houver. Deixa o caminho frontend→worker pronto; os
 * Workers ainda não expõem endpoints de domínio nesta etapa.
 */
export async function callWorker<T>(
  path: string,
  options: CallWorkerOptions = {},
): Promise<T> {
  if (!workersUrl) {
    throw new Error(
      "VITE_WORKERS_URL não está definida — configure o .env antes de chamar um Worker.",
    );
  }

  const { body, headers, ...rest } = options;
  const session = supabase ? (await supabase.auth.getSession()).data.session : null;

  const response = await fetch(new URL(path, workersUrl), {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`Worker respondeu ${response.status}: ${path}`);
  }

  return response.json() as Promise<T>;
}
