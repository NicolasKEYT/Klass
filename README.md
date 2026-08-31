# Klass

ERP educacional open source para automação da jornada acadêmica — da
inscrição em uma trilha até a emissão do certificado em PDF.

Trabalho de Conclusão de Curso da Faculdade de Computação e Informática,
Universidade Presbiteriana Mackenzie. Arquitetura, stack e convenções do
projeto estão documentadas em [`CLAUDE.md`](./CLAUDE.md) — leia antes de
mexer em qualquer coisa de domínio ou infraestrutura.

> Este repositório está no esqueleto inicial: monorepo configurado,
> frontend e Workers de pé, design system extraído, sem telas de domínio
> ou schema de banco ainda.

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
supabase/               (schemas, RLS, funções — fase seguinte)
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

## Build e typecheck

```bash
pnpm typecheck
pnpm build
```

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
   `VITE_SUPABASE_ANON_KEY` e `VITE_WORKERS_URL` (a URL pública do Worker
   publicado no passo 2) para os ambientes de produção e preview.

### 2. `apps/workers` via wrangler

```bash
cd apps/workers
npx wrangler login
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put ALLOWED_ORIGIN   # URL do Pages em produção
npx wrangler deploy
```

Depois do primeiro deploy, volte ao passo 1 e atualize
`VITE_WORKERS_URL` no Pages com a URL que o `wrangler deploy` imprimiu.

## Design system

Os tokens em `apps/web/tailwind.config.ts` foram extraídos diretamente
dos SVGs em `docs/design/` — cada grupo de tokens tem um comentário
indicando de qual tela ele veio.
