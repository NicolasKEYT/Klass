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

## Banco local (opcional)

Para desenvolver e testar migrations sem tocar no Supabase de produção, use a
pilha local oficial da CLI do Supabase (precisa de um runtime de containers na
máquina de desenvolvimento, como Docker Desktop, OrbStack ou Colima — o projeto
em si continua sem containers):

```bash
supabase start -x studio,imgproxy,edge-runtime,logflare,vector,supavisor
supabase db reset          # recria o banco local com todas as migrations + seed
supabase gen types typescript --local \
  --schema public,graphql_public,identidade,catalogo,selecao,diario,certificacao \
  > packages/types/src/database.ts   # depois, formatar com prettier
supabase stop
```

Para o app usar o banco local sem mexer no `.env`, passe as variáveis no
comando (a chave publicável local aparece em `supabase status`):

```bash
VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_PUBLISHABLE_KEY=<chave local> pnpm dev
```

Atenção: os triggers de webhook (`20260917001912_webhooks_via_pg_net.sql`)
chamam o Worker de produção. Sem o segredo no Vault local, a chamada é
recusada (401) e nenhum e-mail sai — mesmo assim, nunca grave o
`webhook_secret` real no banco local. Nunca rode `supabase link`/`db push`
apontando para produção a partir de um teste local.

## Licença

Distribuído sob a [Apache License 2.0](LICENSE). Os avisos de autoria estão em
[NOTICE](NOTICE). Fontes, ícones e imagens de terceiros mantêm as licenças
originais; antes de incluir um novo recurso gráfico, confira se a licença
permite redistribuição.

## Testes automatizados

Os testes rodam **só no banco local** (ver "Banco local" acima); nunca no Supabase
hospedado, onde rodadas simultâneas de teste já contaminaram dados de produção.

**Testes SQL (pgTAP)** — `supabase/tests/database/`, 9 arquivos e 276 asserções:
RLS e privilégios, identidade, catálogo, seleção, diário (chamada e notas,
encerramento, materiais), certificação e relatórios da coordenação. Cada arquivo
é uma transação que termina em `rollback`, monta o próprio cenário e assume os
papéis `authenticated` e `anon` com `request.jwt.claims` forjadas.

```bash
supabase start -x studio,imgproxy,edge-runtime,logflare,vector,supavisor
supabase test db
```

**Roteiros Playwright** — `apps/web/e2e/`, 4 roteiros (5 casos) que percorrem a
interface com os três papéis: inscrição e aprovação, chamada e nota (com a nota
chegando ao aluno em tempo real), encerramento e certificado (com verificação
pública e revogação) e relatórios/exports da coordenação. O script recria o banco
local (`supabase db reset`), sobe o Vite apontado para ele e roda os roteiros; a
configuração recusa qualquer URL que não seja local.

```bash
apps/web/e2e/rodar.sh          # precisa de psql no PATH (brew install libpq)
```

A cobertura não é medida. Os testes não substituem avaliação com usuários.

## Migrations pendentes de aplicação em produção

Estas migrations estão no repositório e precisam ser aplicadas no projeto
hospedado (por quem tem acesso, com `supabase db push`) **antes** de publicar o
frontend que depende delas, nesta ordem:

| Migration | O que faz |
|---|---|
| `20261003120000_catalogo_tipo_certificacao_combinado` | modo de certificação "por módulo e da trilha" |
| `20261003120100_seguranca_funcoes_definer` | fecha funções SECURITY DEFINER à API; status final só pelo encerramento |
| `20261003120200_certificacao_turma_revogacao_combinado` | turma no certificado, revogação, verificação pública com tipo |
| `20261003120300_diario_historico_encerramentos` | histórico de encerramentos; desfazer/reativar com motivo |
| `20261004120000_diario_prazo_chamada` | prazo de 7 dias para a chamada, liberação pela coordenação |
| `20261004120100_catalogo_frequencia_minima_trilha` | frequência mínima padrão na trilha |
| `20261004120200_selecao_inscricao_periodo_e_ocupacao` | inscrição fecha com o período; ocupação real |
| `20261004120300_diario_agregados` | progresso da turma e indicadores agregados no banco |
| `20261004120400_realtime_avaliacoes_aulas` | avaliações e aulas no Realtime |
| `20261005120000_catalogo_avaliacoes_modelo` | modelo de avaliações por módulo |
| `20261005120100_diario_avaliacoes_do_modelo` | turma nova nasce com as avaliações do modelo |
| `20261006120000_turma_turno_aula_sala` | turno da turma e sala da aula |
| `20261007120000_diario_materiais_turma` | materiais da turma (bucket privado `materiais`) |
| `20261010120000_relatorios_coordenacao` | funções de relatório e indicadores da coordenação (exports e dashboard) |

### Ordem de publicação

1. O envio do código desta fase para a `main` vai com `[skip ci]`, sem deploy:
   as telas novas (Exports e o Relatório do período do Acompanhamento) chamam
   funções que só existem depois da migration `20261010120000`. Com o site no ar
   antes dela, as duas telas mostram erro.
2. `supabase db push` com as migrations acima (por quem tem acesso ao projeto
   hospedado), na ordem da tabela.
3. Só depois de a migration `20261010120000` estar em produção, publique o site:
   um commit sem `[skip ci]` na `main` ou um novo deploy no Pages.
4. O Worker (`wrangler deploy`) é independente e manual; esta fase não o altera.

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
npx wrangler secret put EMAIL_REMETENTE  # opcional: "Klass <no-reply@seu-dominio>"
npx wrangler deploy
```

**Remetente dos e-mails.** Sem `EMAIL_REMETENTE`, o Worker usa
`Klass <onboarding@resend.dev>`, o remetente de teste do Resend, que **só
entrega para o e-mail dono da conta Resend**. Para os alunos receberem os
e-mails, verifique um domínio em resend.com/domains, defina
`EMAIL_REMETENTE` com um endereço desse domínio e publique o Worker de novo.

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
