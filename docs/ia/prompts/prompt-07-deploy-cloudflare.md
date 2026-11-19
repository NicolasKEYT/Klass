# Prompt 07 — Deploy no Cloudflare (Workers + Pages)

Você vai colocar o Klass em produção no Cloudflare. Leia o `CLAUDE.md`
na raiz antes de começar. Este prompt não adiciona features — só publica
o que já existe.

## Contexto

MS1, MS2, MS3 e MS4 estão prontos, testados end-to-end localmente,
commitados e no GitHub. Toda a infraestrutura do bootstrap (Pages + Workers)
foi preparada para deploy, mas nunca subimos. Agora vamos subir.

O usuário já:

- Criou conta no Cloudflare com login Google
- Rodou `npx wrangler login` e autorizou o CLI
- Tem `wrangler whoami` respondendo corretamente com o Account ID
- Tem as chaves do Supabase, Resend e o `WEBHOOK_SECRET` guardados em
  local seguro fora do repositório

O Supabase de produção **é o mesmo** de desenvolvimento (mesma URL, mesmas
chaves) — decisão consciente para simplificar o TCC. Se algum dia
separar dev/prod, será outro momento.

Nome escolhido: `klass` (nas URLs `klass.pages.dev` e
`klass-workers.<account>.workers.dev`). Deploy automático por push na
branch `main`. Sem domínio próprio.

## Objetivo desta etapa

Ao final, um avaliador conseguirá:

1. Abrir `https://klass.pages.dev` no navegador
2. Fazer login com qualquer das três contas de teste
3. Executar todos os fluxos que hoje funcionam em `localhost:5173`
4. Ver o e-mail de aceite chegar quando a coordenação aprovar uma
   matrícula

Nenhum código novo. Nenhuma migration nova. Só deploy + configuração.

## O que **você** (Claude Code) faz vs. o que o **usuário** faz

Nem tudo pode ser feito via CLI. Deixe claro em cada passo quem executa:

- **Você:** roda comandos no terminal, edita arquivos, faz commits e
  push, verifica logs. Tudo que é `wrangler`, `git`, edição de arquivo
  no repo.
- **Usuário:** clica em painéis (Cloudflare Dashboard, Supabase Panel),
  fornece valores que só ele tem, autoriza integrações.

Quando o usuário precisa fazer algo, **pare, escreva as instruções passo a
passo e aguarde**. Não assuma que ele já fez.

## Fase 1 — Deploy dos Workers

### 1.1 — Confirmar autenticação e Account ID

**Você:**

```bash
npx wrangler whoami
```

Deve mostrar o e-mail e o Account ID do usuário. Se não mostrar, pare e
peça pro usuário rodar `npx wrangler login` novamente.

### 1.2 — Configurar secrets no ambiente de produção

Os secrets do Worker vivem no Cloudflare, criptografados. Precisam ser
setados via CLI, um por um. **Não** vão em arquivo versionado.

**Você:** para cada um dos secrets abaixo, rode `wrangler secret put NOME`
na pasta `apps/workers`. Cada comando vai abrir um prompt pedindo o valor
— **pare e peça ao usuário para colar o valor**, esperando ele confirmar
antes de rodar o próximo.

Secrets necessários:

1. `SUPABASE_SERVICE_KEY` — a chave secreta do Supabase (`sb_secret_...`).
   **Aviso ao usuário:** essa é a mesma chave que ele guardou no
   gerenciador de senhas depois da rotação. **Nunca** deve ir para o
   frontend nem para arquivo versionado.

2. `SUPABASE_URL` — a URL do projeto Supabase
   (`https://[REDIGIDO: ref do projeto Supabase].supabase.co`, sem barra final).

3. `RESEND_API_KEY` — a chave do Resend (`re_...`). Se o usuário não
   tem, pede pra ele criar em [resend.com/api-keys](https://resend.com/api-keys)
   e voltar.

4. `WEBHOOK_SECRET` — a string aleatória que autentica o Database Webhook
   → Worker. Se o usuário ainda não gerou, gere no terminal:
   ```bash
   openssl rand -hex 32
   ```
   Copia o valor, cola no `wrangler secret put`, e **guarda em um lugar
   seguro** — vai ser usado de novo no Supabase quando configurar o
   webhook (Fase 4).

5. `ALLOWED_ORIGIN` — deixe **temporariamente** como
   `http://localhost:5173`. Vamos atualizar na Fase 3 depois do Pages
   subir.

### 1.3 — Confirmar `wrangler.toml`

**Você:** verifique que `apps/workers/wrangler.toml` tem:

- `name = "klass-workers"` (não `klass` sozinho, para não colidir com o
  Pages)
- `main` apontando para o entry point correto
- `compatibility_date` recente (últimos 3 meses no mínimo)
- **Sem** `[vars]` com valores reais — vars vão via secret ou pelo painel
  para valores públicos

Se algo estiver errado, ajuste e faça o ajuste virar commit próprio no
final desta fase.

### 1.4 — Deploy

**Você:**

```bash
cd apps/workers
npx wrangler deploy
```

O comando termina com uma URL de produção. **Copie essa URL** — algo como
`https://klass-workers.<subdomain>.workers.dev`.

Testa que o Worker está no ar:

```bash
curl https://klass-workers.<subdomain>.workers.dev/health
```

Deve responder `{"status":"ok"}` ou similar.

Se der 404 ou erro, verifica os logs:

```bash
npx wrangler tail
```

E corrige antes de continuar.

### 1.5 — Registrar a URL do Worker

**Você:** documente a URL do Worker no `README.md` da raiz, numa seção
"Endereços de produção". Faça um commit `docs: registrar URL do Worker de
producao` mas **não faça push ainda** (vamos juntar com os ajustes das
próximas fases).

## Fase 2 — Deploy do Frontend (Pages) — usuário faz no painel

O Cloudflare Pages não é acessível via CLI de forma prática para primeira
configuração. **Pare aqui e escreva instruções para o usuário fazer no
painel.**

### 2.1 — Instruções para o usuário criar o projeto Pages

Escreva algo assim, adaptando conforme necessário:

```
Agora entra no Cloudflare Dashboard para criar o projeto Pages. Passo
a passo:

1. Abre https://dash.cloudflare.com e loga (você já está com a conta
   Google logada).

2. No menu lateral esquerdo, procura "Workers & Pages" ou "Compute" →
   "Workers & Pages". Clica.

3. Clica no botão "Create" (ou "Create application").

4. Escolhe a aba "Pages".

5. Clica em "Connect to Git".

6. Autoriza o Cloudflare a acessar sua conta GitHub. Ele vai pedir
   permissão — aceita.

7. Escolhe o repositório "NicolasKEYT/Klass".

8. Nome do projeto: **klass** (se estiver ocupado, escolhe outro nome
   simples como "klass-tcc" ou "klass-erp" — mas me avise pra
   atualizarmos a URL de produção depois).

9. Production branch: **main**

10. Framework preset: **None** (não escolhe React nem Vite; a gente vai
    configurar manualmente porque é monorepo).

11. Build settings:
    - Build command: `pnpm install && pnpm --filter web build`
    - Build output directory: `apps/web/dist`
    - Root directory: (deixa vazio, é a raiz do repo)

12. Environment variables (importante, tanto para "Production" quanto
    "Preview"):
    - `VITE_SUPABASE_URL` = <mesma URL do teu .env local>
    - `VITE_SUPABASE_ANON_KEY` = <mesma publishable key do teu .env local>
    - `VITE_WORKERS_URL` = <a URL do Worker que a gente subiu na Fase 1,
      terminando em `.workers.dev`, SEM barra final>
    - `NODE_VERSION` = `22`

13. Clica "Save and Deploy".

O primeiro build demora 3-5 minutos. Fica de olho na saída. Se falhar,
copia o erro e me manda.

Quando terminar com sucesso, a URL será mostrada no painel — algo como
"klass.pages.dev". Me avisa qual URL ficou.
```

**Aguarde a resposta do usuário.** Não continue para 2.2 até ele confirmar
a URL do Pages.

### 2.2 — Após confirmação do usuário

Quando o usuário confirmar a URL do Pages (ex.: `https://klass.pages.dev`),
teste que o site carrega:

```bash
curl -I https://klass.pages.dev
```

Deve responder 200 OK.

Abre no navegador (via ferramenta de browser se tiver, senão pede pro
usuário abrir e reportar). O site deve mostrar a tela de login, mas
**as chamadas ao Supabase provavelmente falharão** por CORS/Auth
config — resolvemos nas fases 3 e 4.

## Fase 3 — Ajustar CORS e Supabase Auth

### 3.1 — Atualizar `ALLOWED_ORIGIN` do Worker

**Você:**

```bash
cd apps/workers
npx wrangler secret put ALLOWED_ORIGIN
```

Cole o valor: `https://klass.pages.dev` (ou a URL real que o usuário
confirmou), **sem** barra final. Redeploy é automático.

Se o Worker precisar de restart explícito, faça `npx wrangler deploy` de
novo.

### 3.2 — Adicionar URLs ao Supabase Auth (usuário faz no painel)

O Supabase Auth precisa saber que `https://klass.pages.dev` é um origin
autorizado, senão redirecionamentos pós-login (email de verificação,
recuperação de senha, etc.) vão pra `localhost:5173` e quebrar.

**Instrução para o usuário:**

```
Entra no painel do Supabase:

1. https://supabase.com/dashboard → seu projeto Klass
2. Menu lateral: Authentication → URL Configuration
3. No campo "Site URL", muda de "http://localhost:5173" para
   "https://klass.pages.dev"
4. Em "Redirect URLs", clica "Add URL" e adiciona
   "https://klass.pages.dev/**" (o /** cobre todas as rotas)

   IMPORTANTE: mantém também "http://localhost:5173/**" na lista, porque
   você e o time vão continuar rodando local. As duas convivem sem
   problema.

5. Clica "Save"

Me avisa quando salvou.
```

**Aguarde confirmação do usuário.**

### 3.3 — Testar cadastro/login em produção

Depois que o usuário confirmar:

- Peça pro usuário abrir `https://klass.pages.dev` em uma janela anônima
  (sem cookies pré-existentes de desenvolvimento).
- Peça pra ele logar com `aluno.teste@klass.dev` / `[REDIGIDO: senha de demonstração]`.
- Se logar com sucesso e ver a tela home, CORS e Auth estão OK.
- Se der erro, pede o erro do console do navegador (F12 → Console) e
  ajusta.

## Fase 4 — Reconfigurar o Database Webhook

O webhook do MS3 (que dispara e-mail de aceite) provavelmente aponta pra
localhost ou pra uma URL de dev. Precisa apontar pra produção.

**Instrução para o usuário:**

```
Vamos apontar o webhook para o Worker de produção.

1. https://supabase.com/dashboard → seu projeto → menu lateral:
   Database → Webhooks (ou Integrations → Webhooks, dependendo da versão
   do painel)

2. Você deveria ver o webhook "matricula_deferida" que a gente configurou
   antes. Clica nele.

3. No campo "URL", muda para:
   https://klass-workers.<subdomain>.workers.dev/webhooks/matricula-deferida

   (usa a URL exata que o wrangler retornou na Fase 1)

4. No campo "HTTP Headers", confere que tem o header:
   Authorization: Bearer <WEBHOOK_SECRET>
   ...com o mesmo valor que a gente usou no `wrangler secret put
   WEBHOOK_SECRET`. Se você não tem esse valor mais, gera outro:

     openssl rand -hex 32

   ...atualiza tanto aqui quanto rodando `wrangler secret put
   WEBHOOK_SECRET` novamente na pasta apps/workers.

5. Salva.

6. Me avisa quando salvou.
```

**Aguarde confirmação do usuário.**

### 4.1 — Testar o e-mail em produção

Depois que o usuário confirmar:

Peça pra ele:

1. Logar como `coordenacao.teste@klass.dev` em `https://klass.pages.dev`
2. Ir numa turma com inscrição pendente
3. Aprovar a inscrição
4. Aguardar ~30 segundos e checar o inbox de aluno.teste (que
   provavelmente é fictício — nesse caso, verificar no painel do Resend
   se o e-mail foi enviado)

Se o e-mail não sair, use `npx wrangler tail` para ver logs do Worker em
tempo real enquanto o usuário aprova de novo.

## Fase 5 — Documentar e testar

### 5.1 — Atualizar README

**Você:** atualize `README.md` com uma seção "Ambiente de produção":

- URL do Pages
- URL do Worker
- Nome do projeto no Cloudflare
- Como fazer redeploy manual (se necessário): `git push origin main`
  (automático) ou re-trigger no painel do Cloudflare

Mantenha as instruções de desenvolvimento local intactas — o time
continua desenvolvendo localmente.

### 5.2 — Commits finais

**Você:** organize os commits desta sessão em um ou dois lógicos:

- `deploy: workers em producao no Cloudflare` (incluindo ajustes de
  `wrangler.toml` se houve)
- `docs: enderecos de producao e instrucoes de deploy` (README)

Faça `git push`. O Cloudflare Pages vai auto-deployar o push.

### 5.3 — Smoke test final

Peça ao usuário para, em uma janela anônima em `https://klass.pages.dev`:

1. Cadastrar uma conta nova (verificar que redireciona para verificação
   de email — comportamento normal)
2. Logar com cada uma das três contas de teste
3. Navegar as telas principais de cada papel
4. (Opcional) Testar o fluxo de matrícula ponta a ponta

Se algo quebrar, diagnostica e corrige.

## Regras que valem para tudo

- Nada de segredo em arquivo versionado. Todo secret via `wrangler secret
  put`, todo valor sensível fora do repo.
- Se algum passo do painel do Cloudflare/Supabase mudar de nome (a UI
  deles evolui), adapta a instrução ao que estiver na tela e me avisa.
- Se surgir uma decisão de configuração não trivial (ex.: qual região
  usar, qual plano ativar), **para e pergunta**.
- Preserva o CI existente — o build do Cloudflare Pages não substitui o
  GitHub Actions, os dois convivem.

## Ao terminar, me entregue

1. **Resumo do que ficou onde:**
   - URL do Pages
   - URL do Worker
   - Todos os secrets configurados (só o nome, obviamente, não o valor)
   - Confirmação de que o webhook foi reapontado
2. **O que foi testado end-to-end** em produção, com resultado (login
   OK? cadastro OK? aprovação de matrícula → email OK?).
3. **Qualquer coisa que exige atenção futura** — plano free do
   Cloudflare tem limites, alguma config temporária, algo que ficou como
   dívida.
4. **Instrução clara para o time** — o que o Gabriel, Erik e Ricardo
   precisam saber pra rodar teste em produção. Pode ser um parágrafo no
   README ou uma mensagem que o Nicolas manda no grupo.
5. `pnpm typecheck` e `pnpm build` limpos, CI verde no GitHub Actions.

Pare no deploy. Aguarde o próximo prompt para MS5 (Certificação) ou
para ajustes.
