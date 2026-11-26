# Klass

[![Licença: Apache 2.0](https://img.shields.io/badge/licen%C3%A7a-Apache%202.0-blue.svg)](LICENSE)

ERP educacional **gratuito e de código aberto** que automatiza a jornada
acadêmica, da inscrição em uma trilha até a emissão do certificado em PDF.
Pensado para instituições de ensino de pequeno e médio porte, que hoje
costumam depender de planilhas ou de sistemas pesados.

Trabalho de Conclusão de Curso da Faculdade de Computação e Informática,
Universidade Presbiteriana Mackenzie. As decisões de arquitetura e as
convenções do projeto estão em [`CLAUDE.md`](./CLAUDE.md); leia antes de mexer
em qualquer coisa de domínio ou de infraestrutura.

> **Estágio do projeto.** O Klass é um protótipo. Os três fluxos principais
> (inscrição, notas e frequência, conclusão com certificação) estão
> implementados para os três perfis e foram exercitados pela equipe, com dados
> de teste e testes automatizados locais. Não houve testes de carga, avaliação
> de usabilidade com usuários externos nem auditoria de conformidade com a LGPD.
> Veja "Limitações conhecidas".

## O que o Klass faz

Três perfis, cada um com a sua navegação:

| Perfil | Papel | O que faz |
| --- | --- | --- |
| Aluno | `aluno` | Explora o catálogo, se inscreve em turmas, acompanha notas e frequência em tempo real e baixa o certificado |
| Professor | `professor` | Lança aulas, chamada e avaliações das turmas que leciona |
| Coordenação | `coordenacao` | Administra trilhas, módulos, turmas, docentes e alunos, defere inscrições, encerra turmas e acompanha indicadores |

- **Inscrição com regras no banco:** vaga disponível, matrícula duplicada,
  período da turma e pré-requisitos (inclusive entre trilhas, com checagem de
  ciclo).
- **Notas e frequência:** média ponderada por modelo de avaliações do módulo,
  média mínima por trilha, frequência mínima (padrão de 75%, herdada pela
  turma), prazo de 7 dias para a chamada e trava de edição após o encerramento.
- **Certificação:** certificado por módulo, por trilha ou por ambos, com código
  único consultável sem login (`/verificar/<código>`), revogação com motivo e
  histórico de encerramentos. O registro nasce no banco; o PDF é gerado no
  navegador.
- **Coordenação:** acompanhamento com gráficos (panorama e relatório do
  período) e exportação de listas em CSV e XLSX, sem CPF.
- **Materiais da turma** em bucket privado do Supabase Storage.
- **E-mails** de inscrição recebida, matrícula deferida e certificado emitido,
  enviados pelo Worker via Resend (a confirmação de cadastro é do Supabase Auth).
- **Tema claro e escuro.**

## Arquitetura

Monólito modular sobre BaaS. O Supabase é o núcleo: persistência,
autenticação, regras de acesso, tempo real e a maior parte da lógica, que vive
perto do dado como funções e triggers do Postgres. Os cinco contextos
delimitados (inspirados em Domain-Driven Design) são schemas do mesmo banco e
são publicados juntos. Não são microsserviços.

| Sigla | Contexto | Schema | Responsabilidade |
| --- | --- | --- | --- |
| MS1 | Identidade e Acesso | `identidade` | Perfis, RBAC, autorização |
| MS2 | Catálogo Curricular | `catalogo` | Trilhas, módulos, pré-requisitos |
| MS3 | Motor de Seleção | `selecao` | Inscrição, validação de pré-requisitos, matrícula |
| MS4 | Diário de Classe | `diario` | Notas, frequência, progresso |
| MS5 | Certificação | `certificacao` | Emissão e verificação do certificado |

Um contexto não lê tabela de outro diretamente: chama uma função nomeada do
schema dono do dado. As regras de negócio ficam no banco (`check`, trigger,
função) e o acesso é controlado por Row Level Security, JWT e papel.

O frontend fala direto com o Supabase para tudo que é dado de domínio. Os
Cloudflare Workers existem só para o que o banco não faz sozinho: enviar
e-mail e receber as chamadas dos triggers. Não há tarefa agendada: o Worker não
tem cron trigger nem handler `scheduled`. Quando uma mudança de estado precisa avisar o mundo externo, um
trigger do banco faz uma chamada HTTP assíncrona (`pg_net`) ao Worker.

## Stack

| Camada | Tecnologia |
| --- | --- |
| Frontend | React 18 + TypeScript + Vite + Tailwind, em Cloudflare Pages |
| Leitura de dados | TanStack Query sobre o cliente do Supabase; Realtime invalida o cache |
| Núcleo de dados | Supabase (Postgres, Auth, RLS, PostgREST, Realtime, Storage, Vault) |
| Integrações | Cloudflare Workers (TypeScript, roteador [Hono](https://hono.dev)): e-mail e webhooks |
| E-mail transacional | Resend, acessado só pelos Workers |
| PDF do certificado | `@react-pdf/renderer`, no navegador |
| Tipos compartilhados | `packages/types`, gerados do banco e consumidos por web e workers |
| Testes | pgTAP (SQL) e Playwright, só no banco local; Vitest no Worker, sem rede |

## Estrutura do repositório

```
apps/
  web/                  Frontend React (Cloudflare Pages)
    e2e/                Roteiros Playwright
  workers/              Cloudflare Workers (integrações)
    src/email/          Envio via Resend
    src/webhooks/       Recebedores das chamadas HTTP dos triggers
    src/cron/           Pasta reservada; sem cron trigger nem handler `scheduled`
    src/shared/         Cliente Supabase (service key), CORS, ambiente
packages/
  types/                Tipos de domínio compartilhados
supabase/
  migrations/           Schemas dos cinco contextos, RLS, funções, triggers, views
  tests/database/       Testes SQL (pgTAP)
  seed.sql              Dados de demonstração (só no banco local)
docs/                   Wireframes e SVGs de design (fonte dos tokens do Tailwind)
  ia/                   Prompts do desenvolvimento assistido por IA
diagramas/              Casos de uso, classes, sequência e UI Kit
```

## Pré-requisitos

- Node.js 20 ou superior; o projeto usa a versão 22, fixada em
  [`.nvmrc`](./.nvmrc) e usada pelo CI
- [pnpm](https://pnpm.io) 9 — se não tiver instalado globalmente, use
  `corepack enable` ou `npx pnpm@9` no lugar de `pnpm` nos comandos abaixo
- Para o banco local e os testes: a [CLI do Supabase](https://supabase.com/docs/guides/cli)
  e um runtime de containers na máquina de desenvolvimento (Docker Desktop,
  OrbStack ou Colima). O produto em si não usa containers.

## Instalação

```bash
pnpm install
```

## Configurar variáveis de ambiente

Copie o exemplo e preencha com os valores do seu projeto Supabase/Resend:

```bash
cp .env.example .env
```

- **Frontend** (`VITE_*`, públicas): lidas direto do `.env` pelo Vite. A chave
  publicável do Supabase é pública por design; quem protege os dados é a RLS.
- **Workers** (secretas): não vivem num `.env` consumido em runtime.
  - Em desenvolvimento local, copie as mesmas linhas para
    `apps/workers/.dev.vars` (já no `.gitignore`); o `wrangler dev` lê esse
    arquivo automaticamente.
  - Em produção, configure cada uma com `wrangler secret put <NOME>`
    (passo a passo na seção de publicação).

A **service role key** ignora a RLS: ela fica só nos Workers e nunca entra no
frontend. A API key do Resend também fica só nos Workers.

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

Criados pelo `supabase/seed.sql` **no banco local** (e-mails `@klass.dev` são
reservados, só para teste). Não rode o seed em um ambiente real: ele cria
contas com senha conhecida.

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
nada); servem para testar a visão do professor.

## Build e typecheck

```bash
pnpm typecheck
pnpm build
```

O CI do GitHub roda só essas duas verificações.

## Banco local

Para desenvolver e testar migrations sem tocar no Supabase hospedado, use a
pilha local oficial da CLI do Supabase:

```bash
supabase start -x studio,imgproxy,edge-runtime,logflare,vector,supavisor
supabase db reset          # recria o banco local com todas as migrations + seed
supabase gen types typescript --local \
  --schema public,graphql_public,identidade,catalogo,selecao,diario,certificacao \
  > packages/types/src/database.ts   # depois, formatar com prettier
supabase stop
```

Depois de mudar o schema, regere os tipos como acima e versione o resultado.

Para o app usar o banco local sem mexer no `.env`, passe as variáveis no
comando (a chave publicável local aparece em `supabase status`):

```bash
VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_PUBLISHABLE_KEY=<chave local> pnpm dev
```

Os e-mails do Supabase Auth no banco local (confirmação de cadastro e
redefinição de senha) não saem para a internet: caem no Mailpit, em
`http://127.0.0.1:54324`, com os mesmos modelos de `supabase/templates/`. Depois
de mudar o `config.toml` (modelos, URLs de redirecionamento), rode
`supabase stop` e `supabase start` de novo.

Atenção: os triggers de webhook leem a URL do Worker (`webhook_url`) e o segredo
(`webhook_secret`) do Vault. No banco local não há `webhook_url`: os triggers não
chamam nada e nenhum e-mail sai. Se quiser testar com um Worker, grave os dois
no Vault local (`vault.create_secret(..., 'webhook_url')`). Nunca grave o
`webhook_secret` real no banco local e
nunca rode `supabase link` ou `db push` apontando para um ambiente real a
partir de um teste local.

## Testes automatizados

Os testes rodam **só no banco local** (ver "Banco local" acima), nunca no
Supabase hospedado, onde rodadas simultâneas de teste já contaminaram dados.

**Testes SQL (pgTAP)** — `supabase/tests/database/`, 9 arquivos e 279 asserções:
RLS e privilégios, identidade, catálogo, seleção, diário (chamada e notas,
encerramento, materiais), certificação e relatórios da coordenação. Cada arquivo
é uma transação que termina em `rollback`, monta o próprio cenário e assume os
papéis `authenticated` e `anon` com `request.jwt.claims` forjadas.

```bash
supabase start -x studio,imgproxy,edge-runtime,logflare,vector,supavisor
supabase test db
```

**Roteiros Playwright** — `apps/web/e2e/`, 5 roteiros (9 casos) que percorrem a
interface com os três papéis: inscrição e aprovação, chamada e nota (com a nota
chegando ao aluno em tempo real), encerramento e certificado (com verificação
pública e revogação), relatórios/exports da coordenação e recuperação de senha
(do pedido ao login com a senha nova, lendo o e-mail no Mailpit do banco local,
mais a troca de senha pelo Perfil). O script recria o banco local
(`supabase db reset`), sobe o Vite apontado para ele e roda os roteiros; a
configuração recusa qualquer URL que não seja local.

```bash
apps/web/e2e/rodar.sh          # precisa de psql no PATH (brew install libpq)
```

**Testes do Worker (Vitest)** — `apps/workers/test/`, 9 casos que rodam em Node,
sem banco e sem rede (o `fetch` do Supabase e do Resend é simulado): webhook
recusado sem o cabeçalho, com segredo ausente, vazio, curto ou errado; JSON
inválido (400); caminho feliz com o e-mail montado; erro não tratado vira JSON 500;
CORS só com GET, POST e OPTIONS.

```bash
pnpm --filter @klass/workers test
```

A cobertura não é medida. Os testes não substituem avaliação com usuários.

## Publicação

Cada camada é publicada de um jeito; só o frontend é automático.

| Camada | Como publica |
| --- | --- |
| Frontend (Cloudflare Pages) | Automático: o push na `main` publica. Um commit com `[skip ci]` no início da mensagem não publica |
| Migrations (Supabase) | Manual, com `supabase db push` |
| Worker (Cloudflare Workers) | Manual, com `npx wrangler deploy` em `apps/workers` |

### Migrations

O repositório tem 51 migrations versionadas. Toda alteração de schema é uma
migration; nada é alterado à mão no painel do Supabase. Para aplicar em um
projeto hospedado:

1. Faça backup dos schemas de domínio (`identidade`, `catalogo`, `selecao`,
   `diario`, `certificacao`) com `pg_dump`, schema e dados, e guarde **fora do
   repositório**. O dump não inclui Auth nem Storage.
2. Rode `supabase db push --dry-run` e confira que só aparecem as migrations
   pendentes esperadas.
3. Rode `supabase db push`.

As migrations vão **antes** do frontend que depende delas; a ordem inversa
quebra telas.

### 1. `apps/web` no Cloudflare Pages

1. No dashboard da Cloudflare, **Workers & Pages → Create → Pages →
   Connect to Git** e selecione este repositório.
2. Configuração de build:
   - **Framework preset:** Vite
   - **Build command:** `pnpm --filter @klass/web build`
   - **Build output directory:** `apps/web/dist`
   - **Root directory:** `/` (raiz do monorepo; o comando acima já filtra o
     workspace certo)
3. Em **Settings → Environment variables**, adicione `VITE_SUPABASE_URL`
   e `VITE_SUPABASE_PUBLISHABLE_KEY` para os ambientes de produção e preview.
   O frontend não chama o Worker; só o banco chama.

### 2. `apps/workers` via wrangler

```bash
cd apps/workers
npx wrangler login
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put ALLOWED_ORIGIN   # origem do frontend (ex.: https://seu-dominio), sem barra no final; vai nos links dos e-mails
npx wrangler secret put WEBHOOK_SECRET   # string aleatória longa — ver passo 3
npx wrangler secret put EMAIL_REMETENTE  # opcional: "Klass <no-reply@seu-dominio>"
npx wrangler deploy
```

**Remetente dos e-mails.** Sem `EMAIL_REMETENTE`, o Worker usa
`Klass <onboarding@resend.dev>`, o remetente de teste do Resend, que **só
entrega para o e-mail dono da conta Resend**. Para os alunos receberem os
e-mails, verifique um domínio em resend.com/domains, defina `EMAIL_REMETENTE`
com um endereço desse domínio e publique o Worker de novo. O ambiente da equipe
já usa `Klass <no-reply@klass.digital>`, com o domínio verificado (SPF, DKIM e
DMARC no DNS).

**E-mails de confirmação de cadastro e de redefinição de senha.** Estes não
saem do Worker: são do Supabase Auth. Para saírem do seu domínio, em
Authentication → Emails → SMTP Settings ligue o SMTP próprio com o Resend (host
`smtp.resend.com`, porta `465`, usuário `resend`, senha = uma API key do Resend
só com permissão de envio no seu domínio) e, em Templates, cole o conteúdo de
cada arquivo a partir da linha `<html lang="pt-BR">`, com o assunto indicado:

| Modelo no painel | Arquivo | Assunto |
| --- | --- | --- |
| Confirm signup | [`supabase/templates/confirmacao-cadastro.html`](supabase/templates/confirmacao-cadastro.html) | Confirme seu e-mail no Klass |
| Reset Password | [`supabase/templates/redefinir-senha.html`](supabase/templates/redefinir-senha.html) | Redefina sua senha do Klass |

O link de "Esqueci minha senha" volta para `/redefinir-senha` do site, e esse
endereço precisa estar em Authentication → URL Configuration → Redirect URLs
(`https://klass.digital/**` para o ambiente da equipe); sem isso o link cai na
página inicial em vez de abrir a tela da nova senha. SMTP, modelos e Redirect
URLs ficam só no painel; o `config.toml` só vale para o banco local.

A URL que o `wrangler deploy` imprimir vai para o Vault do banco
(`webhook_url`, passo 3), não para o Pages.

### 3. Webhooks do banco para o Worker (`pg_net` + Vault)

Três eventos saem do banco para o Worker, por triggers versionados nas migrations
`20260917001912_webhooks_via_pg_net.sql` e
`20261124120000_webhook_inscricao_recebida.sql`:

| Trigger | Quando dispara | Endpoint do Worker |
| --- | --- | --- |
| `matriculas_notifica_inscricao` | matrícula é criada como `inscrita` | `/webhooks/inscricao-recebida` |
| `matriculas_notifica_deferimento` | matrícula passa de `inscrita` para `matriculada` | `/webhooks/matricula-deferida` |
| `certificados_notifica_emissao` | certificado é inserido | `/webhooks/certificado-emitido` |

Em vez dos "Database Webhooks" do painel do Supabase, o projeto faz o mesmo
padrão (trigger → HTTP → Worker) com `net.http_post`, porque o schema interno
`supabase_functions` nunca foi provisionado no projeto da equipe e o recurso do
painel falhava. A chamada leva `Authorization: Bearer <segredo>`, lido do
Supabase Vault. Para a sua instalação:

1. **Gere o segredo** (ex.: `openssl rand -hex 32`) e configure no Worker com
   `npx wrangler secret put WEBHOOK_SECRET` (passo 2).
2. **Guarde o mesmo valor no Vault**, uma única vez, no SQL Editor do Supabase,
   com o nome exato `webhook_secret`:
   ```sql
   select vault.create_secret('<mesmo valor do WEBHOOK_SECRET>', 'webhook_secret');
   ```
   O segredo nunca entra em migration.
3. **Grave a URL do seu Worker no Vault**, com o nome exato `webhook_url` (URL
   base, sem barra no final; cada função monta `<webhook_url>/webhooks/<rota>`):
   ```sql
   select vault.create_secret('<URL do Worker>', 'webhook_url');
   ```
   Não edite migration. Sem `webhook_url`, os três triggers não chamam nada e
   nenhum e-mail sai.

   **Banco hospedado que já usava as versões antigas dos triggers** (URL fixa
   na função): antes do `supabase db push` da migration
   `20261125120000_webhook_url_no_vault.sql`, grave a `webhook_url` no Vault (SQL
   Editor ou `supabase db query --linked`); senão os três e-mails (inscrição
   recebida, matrícula deferida, certificado emitido) deixam de sair. No
   ambiente da equipe isso já foi feito em 25/11/2026.

Limite conhecido: a chamada `pg_net` é assíncrona e **não é reenviada**; se o
Worker ou o Resend falharem, o e-mail pode se perder. As respostas ficam por
algumas horas em `net._http_response`. Para ver as falhas (status fora de 2xx ou
erro de rede), rode no SQL Editor:

```sql
select id, created, status_code, error_msg, content
from net._http_response
where status_code is null or status_code not between 200 and 299
order by created desc;
```

**Testando o Worker localmente.** O Supabase hospedado não alcança `localhost`.
Duas opções:

- `npx wrangler dev --remote` roda o Worker num endereço `*.workers.dev` de
  verdade, que o banco consegue chamar.
- Ou chame o endpoint direto com `curl`, simulando o payload, para testar só a
  lógica do Worker:
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
- Para ver os logs do Worker publicado em tempo real, use `npx wrangler tail`.

## Ambiente de teste da equipe

Usado só pela equipe, com dados de teste; nenhuma instituição o adotou até aqui.

- **Site:** https://klass.digital (também em https://klass-91y.pages.dev)
- **Worker (integrações):** https://klass-workers.nicolasbr56.workers.dev

No plano gratuito do Supabase, o projeto é pausado depois de um período de
inatividade e só volta pelo painel ("Restore project").

## Limitações conhecidas

- Sistema monolocatário: cada instalação atende a uma instituição.
- Sem testes de carga; o comportamento com muitos usuários simultâneos é
  desconhecido. O plano gratuito do Supabase tem limites de escala.
- Sem avaliação de usabilidade com usuários externos e sem auditoria formal de
  conformidade com a LGPD ou com a ISO/IEC 27001. O projeto não declara
  conformidade.
- A restauração do backup fora do Supabase não foi testada (autenticação,
  Realtime, Storage e Vault são recursos do Supabase).
- O envio de e-mail a destinatários externos depende de um domínio verificado no
  Resend (o da equipe, `klass.digital`, está verificado, mas por ser novo pode
  cair no lixo eletrônico de alguns provedores no início), e a chamada do banco
  ao Worker não é reenviada em caso de falha. A matrícula rejeitada não gera
  e-mail.
- O cadastro é aberto: qualquer pessoa cria uma conta de aluno. Não há convite,
  nem lista prévia de alunos, nem vínculo do aluno com uma instituição além da
  própria instalação.
- A publicação do Worker e a aplicação das migrations são manuais. Não há tarefa
  agendada: o Worker não tem cron trigger nem handler `scheduled` (a pasta
  `src/cron` só fica reservada).
- A recuperação de senha depende do e-mail do Supabase Auth: sem SMTP próprio, o
  limite de envio do Supabase é baixo, e a mensagem pode cair no lixo eletrônico
  como a de confirmação de cadastro. Não há outro caminho para quem perdeu o
  acesso ao e-mail da conta.
- Não há aviso de privacidade, termos de uso nem exclusão da própria conta
  (pedidos da LGPD ficam sem fluxo no sistema).
- A instância hospedada da equipe é só de demonstração, com dados de teste; não
  deve receber dados reais de alunos.
- O sistema não registra quem exporta uma lista.
- Não há módulo financeiro nem ambiente virtual de aprendizagem.

## Design system

Os tokens em `apps/web/tailwind.config.ts` foram extraídos diretamente dos SVGs
em `docs/design/`; cada grupo de tokens tem um comentário indicando de qual tela
ele veio. As cores são variáveis CSS em `apps/web/src/index.css`, nos temas
claro e escuro.

## Equipe

Gabriel Neman Silva, Nicolas Gonçalves, Erik Salomão Almeida e Ricardo Carvalho
Paixão Brandão, sob orientação do Prof. MSc. Thiago Graziani Traue.

O desenvolvimento contou com assistentes de IA generativa, sob supervisão da
equipe, que definiu a arquitetura, o escopo e as regras de negócio e revisou
cada entrega. Os prompts numerados que foram preservados estão em
[`docs/ia`](docs/ia) (faltam o 02 e o 04, e as respostas do agente não foram
guardadas).

Novidades do projeto no Instagram:
[@klasserpacademico](https://www.instagram.com/klasserpacademico/).

## Licença

O Klass é distribuído sob a **[Apache License 2.0](LICENSE)**. Os avisos de
autoria estão em [NOTICE](NOTICE), e o campo `license` dos `package.json` é
`Apache-2.0`.

Em resumo, você pode usar, modificar e redistribuir o código, inclusive em uso
comercial, desde que:

- mantenha o aviso de copyright, o arquivo `LICENSE` e o `NOTICE` nas cópias
  que distribuir;
- indique as alterações que fizer nos arquivos modificados.

A licença inclui a concessão de patentes dos contribuidores e **não dá garantia
de nenhum tipo**: o software é fornecido "como está". Este resumo não substitui
o texto da licença.

Salvo declaração em contrário, contribuições enviadas ao repositório são
licenciadas sob os mesmos termos (seção 5 da licença). Fontes, ícones, imagens
e dependências de terceiros mantêm as licenças originais; antes de incluir um
novo recurso, confira se a licença permite redistribuição.

Copyright 2026 Gabriel Neman Silva, Nicolas Gonçalves, Erik Salomão Almeida e
Ricardo Carvalho Paixão Brandão.
