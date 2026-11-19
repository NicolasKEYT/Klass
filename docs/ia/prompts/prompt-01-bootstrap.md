# Prompt de bootstrap — Klass

Os arquivos SVG do design estão em `docs/design/`, com esta nomenclatura:

- `01-gestor-visao-geral.svg` — dashboard da coordenação
- `02-gestor-turmas.svg` — gestão de turmas
- `03-aluno-painel.svg` — portal do aluno
- `04-aluno-boletim.svg` — boletim do aluno
- `05-professor-diario.svg` — diário de classe do professor
- `06-certificado.svg` — template do certificado

Leia todos no passo 6 para extrair os tokens do design system. Se algum SVG
mostrar uma tela que não corresponde ao nome, me avise antes de continuar.
O `06-certificado.svg` provavelmente é o template do PDF (não uma tela
navegável): trate-o como referência visual do certificado e registre os
tokens dele junto com os demais.

---

Você vai montar o esqueleto do **Klass**, um ERP educacional que é o meu
Trabalho de Conclusão de Curso. Leia o arquivo `CLAUDE.md` na raiz antes de
começar — ele é a fonte de verdade sobre arquitetura, stack e regras do
projeto, e tudo o que você fizer deve respeitá-lo. Se algo neste prompt
contradisser o `CLAUDE.md`, pare e me pergunte.

## Objetivo desta etapa

Montar **apenas o esqueleto**: monorepo configurado, frontend e workers
inicializados, integrações conectadas por variável de ambiente, o design
system extraído dos SVGs, e o deploy preparado. **Não** crie telas de
domínio, schema de banco, nem lógica de negócio nesta etapa — isso virá em
prompts seguintes. Se você sentir vontade de adiantar uma tela ou uma
tabela, não adiante: pare no esqueleto.

## Stack e decisões (resumo; o `CLAUDE.md` tem o detalhe)

- Monorepo com **pnpm workspaces**.
- `apps/web`: React + TypeScript + Vite + Tailwind, para **Cloudflare Pages**.
- `apps/workers`: **Cloudflare Workers** em TypeScript, só para integrações
  (e-mail, webhooks, cron) — **não** é um backend de CRUD na frente do
  Supabase.
- `packages/types`: tipos de domínio compartilhados entre web e workers.
- **Supabase** é o núcleo (o frontend fala direto com ele); nesta etapa,
  apenas o cliente e as variáveis de ambiente, sem schema.
- **Resend** para e-mail, acessado só pelos workers.
- Roteamento no frontend com **react-router-dom v6**.

## Passo a passo

### 1. Estrutura do monorepo

Crie a estrutura abaixo. O repositório já está clonado e pode conter um
`README.md` inicial — preserve-o (você vai reescrevê-lo no passo 8).

```
apps/
  web/
  workers/
    src/
      email/
      webhooks/
      cron/
      shared/
packages/
  types/
```

Configure `pnpm-workspace.yaml` cobrindo `apps/*` e `packages/*`, e um
`package.json` na raiz com scripts que orquestram os workspaces
(`dev`, `build`, `typecheck`, e um `dev:workers` para o worker). Node 20+,
declare em `engines` e num `.nvmrc`.

### 2. `packages/types`

Um pacote TypeScript simples, sem build próprio (consumido direto como
código-fonte pelos outros workspaces). Crie a espinha de um módulo de tipos
de domínio organizado pelos **cinco bounded contexts** (identidade,
catálogo, seleção, diário, certificação), mas **sem inventar os campos
ainda** — deixe cada bloco comentado, indicando que os tipos entram na fase
de cada módulo. O que importa nesta etapa é o pacote existir, exportar, e os
outros workspaces conseguirem importar dele. Inclua desde já os três papéis
de persona (`aluno`, `professor`, `coordenacao`) como um tipo, porque isso é
transversal e já está definido.

### 3. `apps/web` — frontend

- Vite + React 18 + TypeScript, com alias `@/` para `src/`.
- Tailwind configurado (o passo 6 preenche os tokens).
- `react-router-dom` v6 com um roteador mínimo: uma rota `/` que renderiza
  uma página de esqueleto (um placeholder simples dizendo "Klass" e que o
  projeto está em construção). **Não** crie as telas das personas agora;
  só prove que o roteamento, o Tailwind e o build funcionam.
- Cliente Supabase em `src/lib/supabase.ts`, lendo `VITE_SUPABASE_URL` e
  `VITE_SUPABASE_ANON_KEY` do ambiente. Use **apenas a anon key** aqui —
  a service key nunca entra no frontend. Se as variáveis não estiverem
  definidas, o cliente pode ficar nulo sem quebrar o app (as telas reais
  virão depois).
- Um wrapper tipado para chamar os Workers (uma função `callWorker` ou
  similar) que já monta a URL base do Worker a partir de uma variável de
  ambiente (`VITE_WORKERS_URL`) e anexa o header `Authorization` com o JWT
  da sessão do Supabase quando houver. Isso deixa o caminho frontend→worker
  pronto para quando os workers ganharem endpoints.

### 4. `apps/workers` — integrações

- Projeto Cloudflare Workers em TypeScript, com **wrangler**.
- Um `wrangler.toml` configurado, com as variáveis de ambiente declaradas
  (sem valores secretos no arquivo — use o mecanismo de secrets do
  wrangler; deixe documentado no README como configurá-las).
- Um Worker de entrada que apenas expõe uma rota de saúde
  (`GET /health` retornando 200 e um JSON simples), para provar que builda
  e roda. **Não** crie endpoints de domínio nem rotas de CRUD.
- `src/shared/`: um cliente Supabase para uso do Worker, lendo a
  **service role key** do ambiente do Worker (nunca hardcoded). Deixe claro
  em comentário que esse cliente ignora RLS e só deve ser usado nos casos
  sem usuário na ponta (webhooks, cron), conforme o `CLAUDE.md`.
- `src/email/`: um módulo que encapsula o envio via **Resend**, lendo
  `RESEND_API_KEY` do ambiente. Nesta etapa, só a função de envio genérica
  e tipada, sem os e-mails específicos do domínio. Não a chame de lugar
  nenhum ainda.
- `src/webhooks/` e `src/cron/`: deixe as pastas com um arquivo-índice
  comentado explicando o que vai morar ali, sem implementar receptores nem
  tarefas agendadas ainda.

### 5. CORS entre Pages e Workers

O frontend (Pages) e os Workers terão origens diferentes, então o
frontend vai chamar os Workers via `fetch` cross-origin. Configure CORS
nos Workers corretamente desde já:

- Responda às requisições `OPTIONS` (preflight) com os headers adequados.
- Permita a origem do frontend a partir de uma variável de ambiente
  (`ALLOWED_ORIGIN`), com um padrão para desenvolvimento local
  (`http://localhost:5173`). Não use `*` junto com credenciais.
- Deixe isso num middleware/util compartilhado em `src/shared/`, aplicado a
  todas as respostas do Worker, para não espalhar configuração de CORS.

### 6. Design system a partir dos SVGs

Analise os arquivos SVG anexados e **extraia os tokens do design**:

- Paleta de cores completa (fundos, superfícies, bordas, texto em seus
  níveis, cor primária, cores de acento, cores de status, cores usadas em
  gráficos se houver).
- Tipografia (famílias, se identificáveis; pesos; tamanhos de referência).
- Raios de borda, espaçamentos recorrentes, quaisquer gradientes.

Registre tudo na configuração do Tailwind (`tailwind.config`), com nomes
semânticos e um comentário curto indicando de qual tela/SVG cada grupo de
tokens saiu. **Não estime cores a olho e não invente valores** — tire os
valores exatos dos SVGs. Se algum token for ambíguo ou não aparecer nos
SVGs, liste essas dúvidas para mim no final em vez de inventar.

Crie também um punhado de **componentes atômicos** de UI que já dá para
inferir com segurança do design (por exemplo: botão, card, badge, campo de
texto — o que os SVGs claramente contêm), usando os tokens. Mantenha isso
mínimo: o objetivo é validar que o design system funciona, não construir a
biblioteca inteira. As telas de verdade virão depois.

### 7. Variáveis de ambiente e deploy

- Crie um `.env.example` na raiz (ou por app, o que fizer mais sentido)
  listando **todas** as variáveis necessárias, separando claramente as do
  frontend (prefixo `VITE_`, públicas) das dos Workers (secretas):
  - Frontend: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
    `VITE_WORKERS_URL`.
  - Workers: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`,
    `ALLOWED_ORIGIN`.
- **Não** coloque valores reais em lugar nenhum versionado. Garanta que
  `.env` está no `.gitignore`.
- Prepare o deploy para **Cloudflare**:
  - `apps/web` como projeto de **Pages** (configuração de build: comando e
    diretório de saída do Vite).
  - `apps/workers` publicável via **wrangler**.
  - Deixe documentado no README o passo a passo de: conectar o repositório
    ao Cloudflare Pages, configurar as variáveis no painel do Cloudflare, e
    publicar o Worker com `wrangler`. Não tente executar o deploy agora nem
    assumir que estou autenticado no wrangler — apenas deixe pronto e
    documentado.
- Se fizer sentido um workflow de GitHub Actions para build/lint a cada
  push, crie um mínimo, mas **sem** segredos embutidos e sem deploy
  automático nesta etapa (só build e typecheck).

### 8. README

Reescreva o `README.md` da raiz com: o que é o projeto (uma linha), o
stack, como instalar (`pnpm install`), como configurar o `.env` a partir do
`.env.example`, como rodar frontend e workers em desenvolvimento, e o passo
a passo de deploy no Cloudflare. Escreva para alguém do time que está
clonando o projeto pela primeira vez. Em português.

## Regras que valem para tudo

- Siga o `CLAUDE.md`. Vocabulário: "módulo"/"bounded context", nunca
  "microsserviço". Nada de Docker, orquestrador, n8n, ou backend de CRUD em
  Workers.
- TypeScript em tudo. Identificadores de domínio em português; termos
  técnicos consagrados em inglês; comentários em português explicando o
  porquê, não o quê.
- Não coloque segredo nenhum em arquivo versionado.
- Ao final, **rode o build e o typecheck** dos workspaces e garanta que
  passam. Se algo não passar, corrija antes de terminar.

## Ao terminar, me entregue

1. Um resumo do que foi criado, por workspace.
2. A **lista de tokens de design** que você extraiu dos SVGs, e quais
   ficaram ambíguos ou faltando (para eu confirmar).
3. O **checklist do que eu preciso fazer manualmente** antes do primeiro
   deploy: quais variáveis configurar e onde (Supabase, Cloudflare, Resend),
   e os cliques de ligação do repositório ao Cloudflare Pages.
4. Confirmação de que `build` e `typecheck` passam.

Não avance para telas de domínio nem para o schema do banco — pare no
esqueleto e aguarde o próximo prompt.
