# Klass

ERP educacional open source para automação da jornada acadêmica — da
inscrição em uma trilha até a emissão do certificado em PDF.

Trabalho de Conclusão de Curso da Faculdade de Computação e Informática,
Universidade Presbiteriana Mackenzie. Arquitetura, stack e convenções do
projeto estão documentadas em [`CLAUDE.md`](./CLAUDE.md) — leia antes de
mexer em qualquer coisa de domínio ou infraestrutura.

> Os cinco bounded contexts estão implementados: MS1 (Identidade),
> MS2 (Catálogo), MS3 (Motor de Seleção), MS4 (Diário de Classe) e
> MS5 (Certificação) — da autenticação e do catálogo ao fluxo de
> inscrição/matrícula, lançamento de notas/frequência e emissão do
> certificado em PDF com verificação pública.

## Stack

| Camada | Tecnologia |
| --- | --- |
| Frontend | React 18 + TypeScript + Vite + Tailwind, em Cloudflare Pages |
| Núcleo de dados | Supabase (Postgres, Auth, RLS, PostgREST, Realtime) |
| Integrações | Cloudflare Workers (TypeScript) — e-mail, webhooks, cron |
| E-mail transacional | Resend, acessado só pelos Workers |
| Tipos compartilhados | `packages/types`, consumido por web e workers |

`apps/workers` usa [Hono](https://hono.dev) como roteador — não está no
`CLAUDE.md`, mas é só isso: roteamento e middleware (CORS) dentro do
Worker, não um backend de CRUD na frente do Supabase.

## Estrutura do repositório

```
apps/
  web/                  Frontend React (Cloudflare Pages)
  workers/              Cloudflare Workers (integrações)
packages/
  types/                Tipos de domínio compartilhados
supabase/
  migrations/           Schemas identidade, catalogo, selecao, diario, certificacao — RLS, triggers, funções
  seed.sql              Dados de demonstração (usuários, trilhas, turmas, matrículas)
docs/design/             SVGs de design (fonte dos tokens do Tailwind)
```

## Pré-requisitos

- Node.js 20+ (versão fixada em [`.nvmrc`](./.nvmrc))
- [pnpm](https://pnpm.io) 9 — se não tiver instalado globalmente, use
  `corepack enable` ou `npx pnpm@9` no lugar de `pnpm` nos comandos abaixo

## Instalação

```bash
pnpm install
```

## Configurar variáveis de ambiente

Copie o exemplo e preencha com os valores do seu projeto Supabase/Resend:

```bash
cp .env.example .env
```

- **Frontend** (`VITE_*`, públicas): lidas direto do `.env` pelo Vite.
- **Workers** (secretas): não vivem num `.env` consumido em runtime.
  - Em desenvolvimento local, copie as mesmas linhas para
    `apps/workers/.dev.vars` (já no `.gitignore`) — o `wrangler dev` lê
    esse arquivo automaticamente.
  - Em produção, configure cada uma com `wrangler secret put <NOME>`
    (passo a passo na seção de deploy).

## Rodando em desenvolvimento

```bash
# Frontend — http://localhost:5173
pnpm dev

# Workers — http://localhost:8787
pnpm dev:workers
```

Com os dois no ar, `GET http://localhost:8787/health` deve responder
`{"status":"ok"}`.

## Usuários de demonstração

Criados pelo `supabase/seed.sql` (e-mails `@klass.dev` são reservados, só
para teste). Senha de todos abaixo: a indicada.

| Papel | E-mail | Senha |
| --- | --- | --- |
| Coordenação | `coordenacao.teste@klass.dev` | `klass-coord-2026` |
| Professor | `professor.teste@klass.dev` | `klass-prof-2026` |
| Aluno | `aluno.teste@klass.dev` | `klass-aluno-2026` |
| Aluno (Ana) | `aluno.ana@klass.dev` | `klass-aluno-2026` |
| Aluno (Bruno) | `aluno.bruno@klass.dev` | `klass-aluno-2026` |
| Aluno (Carla) | `aluno.carla@klass.dev` | `klass-aluno-2026` |

Ana, Bruno e Carla estão matriculados na turma **EST-2026-1** com dados de
diário variados (Ana com tudo lançado, Bruno com nota parcial, Carla sem
nada) — servem para testar a visão do professor.

## Build e typecheck

```bash
pnpm typecheck
pnpm build
```

## Ambiente de produção

- **Pages (frontend):** https://klass-91y.pages.dev
- **Worker (integrações):** https://klass-workers.nicolasbr56.workers.dev

## Deploy no Cloudflare

### 1. `apps/web` no Cloudflare Pages

1. No dashboard da Cloudflare, **Workers & Pages → Create → Pages →
   Connect to Git** e selecione este repositório.
2. Configuração de build:
   - **Framework preset:** Vite
   - **Build command:** `pnpm --filter @klass/web build`
   - **Build output directory:** `apps/web/dist`
   - **Root directory:** `/` (raiz do monorepo — o comando acima já
     filtra o workspace certo)
3. Em **Settings → Environment variables**, adicione `VITE_SUPABASE_URL`,
   `VITE_SUPABASE_PUBLISHABLE_KEY` e `VITE_WORKERS_URL` (a URL pública do
   Worker publicado no passo 2) para os ambientes de produção e preview.

### 2. `apps/workers` via wrangler

```bash
cd apps/workers
npx wrangler login
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put ALLOWED_ORIGIN   # URL do Pages em produção
npx wrangler secret put WEBHOOK_SECRET   # string aleatória longa — ver seção de webhook abaixo
npx wrangler deploy
```

Depois do primeiro deploy, volte ao passo 1 e atualize
`VITE_WORKERS_URL` no Pages com a URL que o `wrangler deploy` imprimiu.

### 3. Database Webhook do MS3 (e-mail de matrícula aprovada)

O Supabase não tem API pública pra Webhooks — é configuração manual,
uma vez, pelo painel:

1. Gere uma string aleatória longa para `WEBHOOK_SECRET` (ex.:
   `openssl rand -hex 32`) e configure com `wrangler secret put
   WEBHOOK_SECRET` (passo 2 acima) — guarde o mesmo valor, você vai
   usá-lo no passo 4.
2. No painel do Supabase: **Database → Webhooks → Create a new hook**.
3. Configure:
   - **Table:** `matriculas` (schema `selecao`)
   - **Events:** `Update`
   - **Type:** `HTTP Request`
   - **URL:** `https://<seu-worker>.workers.dev/webhooks/matricula-deferida`
     (em desenvolvimento, veja abaixo como expor o Worker local)
   - **HTTP Headers:** adicione `Authorization: Bearer <WEBHOOK_SECRET>`
     — o mesmo valor do passo 1.

**Testando localmente**: o Supabase Cloud não alcança `localhost`, então
para testar o webhook em desenvolvimento é preciso expor o Worker local
publicamente. Duas opções:

- `npx wrangler dev --remote` roda o Worker num endereço `*.workers.dev`
  de verdade (não local), que o Supabase consegue chamar — aponte o
  webhook do painel pra essa URL enquanto testa.
- Ou pule o webhook: chame o endpoint direto com `curl` simulando o
  payload do Supabase, pra testar só a lógica do Worker:
  ```bash
  curl -X POST http://localhost:8787/webhooks/matricula-deferida \
    -H "Authorization: Bearer $WEBHOOK_SECRET" \
    -H "Content-Type: application/json" \
    -d '{
      "type": "UPDATE",
      "table": "matriculas",
      "schema": "selecao",
      "old_record": { "status": "inscrita" },
      "record": { "id": "...", "aluno_id": "...", "turma_id": "...", "status": "matriculada" }
    }'
  ```
- Para ver os logs do Worker publicado em tempo real (produção ou
  `--remote`), use `npx wrangler tail`.

### 4. Database Webhook do MS5 (e-mail de certificado emitido)

Segundo webhook, mesma sequência do MS3 — reusa o **mesmo** `WEBHOOK_SECRET`,
nenhum secret novo. Aponta para o endpoint `/webhooks/certificado-emitido`
do Worker, que envia o e-mail de conclusão via Resend quando um certificado
é inserido.

1. No painel do Supabase: **Database → Webhooks → Create a new hook**.
2. Configure:
   - **Name:** `certificado_emitido`
   - **Schema:** `certificacao`
   - **Table:** `certificados`
   - **Events:** só `Insert`
   - **Type:** `HTTP Request`
   - **URL:** `https://<seu-worker>.workers.dev/webhooks/certificado-emitido`
   - **HTTP Headers:** `Authorization: Bearer <WEBHOOK_SECRET>` — o mesmo
     valor do webhook do MS3.

> O endpoint só existe no Worker publicado após um `npx wrangler deploy`
> com o código do MS5 (o Worker não faz deploy automático no push — só o
> Pages faz). Redeploy o Worker antes de criar/testar este webhook.

## Design system

Os tokens em `apps/web/tailwind.config.ts` foram extraídos diretamente
dos SVGs em `docs/design/` — cada grupo de tokens tem um comentário
indicando de qual tela ele veio.
