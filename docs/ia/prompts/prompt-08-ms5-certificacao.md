# Prompt 08 — MS5 Certificação

Você vai construir o **quinto e último módulo** do Klass: **MS5, Certificação**.
Leia o `CLAUDE.md` na raiz antes de começar. É a fonte de verdade sobre
arquitetura, stack e regras. Se algo neste prompt contradisser o
`CLAUDE.md`, pare e pergunte.

## Contexto

MS1, MS2, MS3 e MS4 estão prontos, em produção no Cloudflare
(`https://klass-91y.pages.dev` e `https://klass-workers.[REDIGIDO: conta].workers.dev`),
com CI verde e Database Webhook do MS3 já configurado para o e-mail de
aceite de matrícula.

O que existe:

- Cinco schemas do banco funcionando: `identidade`, `catalogo`, `selecao`,
  `diario`. O quinto (`certificacao`) é o que este prompt cria.
- Enum `selecao.status_matricula` com valor `concluida` (definido pelo
  MS4 quando o aluno passa).
- Padrão consolidado de webhook: Database Webhook do Supabase → Worker →
  Resend. Já implementado pro MS3 (e-mail de aceite).
- Padrão de tela pública: nenhuma até agora, este é o primeiro caso.
- Estrutura de tipos gerados do banco em `packages/types/src/database.ts`.
- Padrões de UX: botão voltar, "Salvar" e "Salvar e voltar", feedback
  inline.

MS5 fecha o ciclo do aluno: ao concluir todos os módulos de uma trilha,
o sistema emite um certificado automaticamente com hash único, disponível
para download em PDF gerado no navegador, e verificável publicamente via
URL sem login.

## O que o MS5 é

**Certificação** — o módulo que reconhece formalmente a conclusão de uma
trilha e emite um documento verificável.

Cinco atributos que definem o módulo:

1. **Emissão automática** — quando o aluno tem `concluida` em todos os
   módulos de uma trilha, o certificado é gerado sem ação humana.
2. **PDF no navegador** — gerado com `react-pdf` no cliente. Aluno baixa
   quantas vezes quiser. Sem custo de execução server-side.
3. **Hash público único** — cada certificado tem um código
   verificável (ex.: `KLASS-2026-XY7Z-3K9A`) impresso no PDF.
4. **Verificação pública** — rota `/verificar/:hash` acessível **sem
   login**, retorna se o certificado existe e mostra dados básicos
   (nome do aluno, trilha, data de emissão).
5. **E-mail de conclusão** — quando emitido, envia e-mail ao aluno
   avisando (mesmo padrão do MS3: trigger → webhook → Worker → Resend).

## Modelo de domínio (decidido antes deste prompt)

**Certificado é da trilha, não da matrícula.** Um aluno completa uma
trilha completando todos os módulos dela — cada módulo é uma matrícula
separada em `selecao.matriculas`. O certificado consolida essas
matrículas em um documento único.

**Dados congelados no momento da emissão.** O PDF precisa ser reprodutível
igual pra sempre. Nome do aluno, nome da trilha, nome dos professores,
período, cargas horárias — tudo isso é copiado pra tabela do certificado
no momento da emissão. Se alguém renomear a trilha depois, o certificado
já emitido continua com o nome original.

**Hash público é gerado no ato de emissão.** Formato sugerido:
`KLASS-<YYYY>-<8 chars alfanuméricos>`. Legível, fácil de digitar, e
único.

**Uma trilha, um certificado por aluno.** Se o aluno reprovar e refizer,
a lógica de "todos módulos concluida" pode disparar de novo, mas a
constraint garante um único certificado válido por (aluno, trilha).
Casos de re-emissão ficam pra extensão futura.

## Passo a passo

### 1. Ler o SVG do certificado

Antes de qualquer código, abra `docs/design/06-certificado.svg` e
extraia:

- **Layout geral** (paisagem ou retrato? proporções?)
- **Elementos textuais** (título, corpo, assinaturas, campos dinâmicos)
- **Área destinada ao hash público** (rodapé, canto?)
- **Fontes e tokens de cor** já registrados em `apps/web/tailwind.config.ts`
- **Elementos decorativos** que precisem virar SVG dentro do PDF
  (bordas, brasões, ornamentos)

O SVG do design é a referência visual. Reproduza o mais fielmente
possível em `react-pdf`, respeitando as limitações da biblioteca
(nem todo recurso CSS ou SVG complexo é suportado). Se algo do design
for inviável em `react-pdf`, simplifique e documente a decisão.

Documente o que encontrou no início do resumo final.

### 2. Migration: schema `certificacao`

```bash
supabase migration new criar_schema_certificacao
```

**Schema:**

- `create schema certificacao` com comentário indicando que é o MS5.

**Tabela `certificacao.certificados`:**

- `id uuid primary key default gen_random_uuid()`.
- `hash_publico text not null unique` — o código verificável. Formato
  restrito por `check`: `KLASS-\d{4}-[A-Z0-9]{8}` (regex).
- `aluno_id uuid not null references identidade.profiles(id) on delete restrict` —
  não pode apagar aluno que tem certificado (histórico).
- `trilha_id uuid not null references catalogo.trilhas(id) on delete restrict` —
  não pode apagar trilha com certificado emitido.
- `emitido_em timestamptz not null default now()`.

**Dados congelados (denormalizados):**

- `aluno_nome text not null` — nome no momento da emissão.
- `trilha_nome text not null`.
- `trilha_carga_horaria_total integer not null` — soma das horas dos
  módulos.
- `metadata jsonb not null default '{}'::jsonb` — estrutura livre pra
  guardar coisas como lista de módulos concluídos, professores, notas
  finais, período. Documenta o schema esperado no comentário da coluna.

**Constraint:**

- `unique (aluno_id, trilha_id)` — um único certificado por (aluno,
  trilha).

**Índices:**

- `certificacao.certificados(hash_publico)` — já é único, cria índice
  automaticamente, mas explicita se for pra facilitar leitura.
- `certificacao.certificados(aluno_id)` — pra o painel do aluno.

Comente cada bloco em português explicando o **porquê**.

### 3. Função e trigger de emissão automática

Nova migration (ou mesma):

**Função `certificacao.gerar_hash_publico() returns text`:**

- Gera código no formato `KLASS-<ano>-<8 chars alfanuméricos>`.
- Loop de retry: se colidir com um hash existente, gera outro.
- `SECURITY DEFINER`, `VOLATILE`.

**Função `certificacao.verificar_e_emitir(p_aluno_id uuid, p_trilha_id uuid) returns uuid`:**

O coração do MS5. Lógica:

1. Verifica se já existe um certificado para esse (aluno, trilha) —
   se sim, retorna o id do existente e sai (idempotente).
2. Busca todos os módulos da trilha em `catalogo.modulos`.
3. Busca todas as matrículas ativas do aluno em turmas dessa trilha,
   com status `concluida`.
4. Se todo módulo da trilha tem uma matrícula `concluida` correspondente,
   emite o certificado. Se falta algum, retorna `null` sem emitir.
5. Ao emitir:
   - Busca `aluno_nome` de `identidade.profiles`.
   - Busca `trilha_nome`, `carga_horaria_total` de `catalogo.trilhas`.
   - Monta o `metadata` com lista de módulos, professores (via
     `selecao.turmas.professor_id` → `identidade.profiles`), notas
     finais (via `diario.encerrar_matricula` — o motivo_conclusao ou
     recalcular), período.
   - Gera hash via `certificacao.gerar_hash_publico()`.
   - Insere na tabela.
   - Retorna o id do certificado.

`SECURITY DEFINER` porque precisa ler de múltiplos schemas
independentemente do papel do usuário. Comente o **por quê** dessa
decisão de segurança.

**Trigger em `selecao.matriculas`:**

- `after update on selecao.matriculas`
- Só executa quando `NEW.status = 'concluida'` e `OLD.status <>
  'concluida'` (evita reprocessar).
- Chama `certificacao.verificar_e_emitir(NEW.aluno_id, <trilha_id da turma>)`.
- Se retornar um id (certificado emitido), tudo bem. Se retornar null
  (faltam módulos), também tudo bem — significa que o aluno ainda não
  completou toda a trilha.

### 4. RLS do `certificacao.certificados`

Nova migration:

```bash
supabase migration new rls_certificacao
```

Regras:

- **`SELECT` autenticado:** aluno vê apenas os próprios certificados;
  coordenação vê todos.
- **`SELECT` público (não autenticado):** por padrão RLS bloqueia acesso
  anônimo. Mas a **verificação pública** precisa funcionar sem login.
  Solução: função `certificacao.verificar_por_hash(p_hash text)` marcada
  como `SECURITY DEFINER` que retorna um registro com dados mínimos
  (aluno_nome, trilha_nome, emitido_em) filtrando por hash. Concede
  `EXECUTE` para o role `anon`. Isso permite consultar sem expor a
  tabela inteira nem permitir enumeração.
- **`INSERT`:** ninguém. Só via função interna `verificar_e_emitir`
  (que roda como `SECURITY DEFINER`).
- **`UPDATE`, `DELETE`:** ninguém. Certificados são imutáveis.

### 5. Aplicar migrations e regerar tipos

```bash
supabase db push
supabase gen types typescript --linked > packages/types/src/database.ts
```

Adicionar ao `packages/types/src/index.ts`:

```ts
export type Certificado = Database['certificacao']['Tables']['certificados']['Row']
```

E o tipo do metadata (documenta como TypeScript interface separada, já
que jsonb não tem esquema forte no gen):

```ts
export interface MetadataCertificado {
  modulos: Array<{
    nome: string
    professor: string
    carga_horaria_horas: number
    nota_final: number | null
    periodo_inicio: string
    periodo_fim: string
  }>
}
```

### 6. Worker: e-mail de conclusão

Novo endpoint `POST /webhooks/certificado-emitido` no Worker, seguindo
exatamente o padrão do `matricula-deferida` já existente.

Fluxo:

1. Recebe o payload do Database Webhook do Supabase.
2. Valida o header `Authorization: Bearer <WEBHOOK_SECRET>` (mesmo secret
   já configurado).
3. Verifica que é INSERT em `certificacao.certificados`.
4. Busca o e-mail do aluno via `auth.users` usando o cliente admin
   (`SUPABASE_SERVICE_ROLE_KEY`).
5. Envia e-mail via Resend com:
   - Assunto: "Parabéns! Seu certificado de [trilha_nome] está pronto"
   - Corpo: mensagem em português com nome do aluno, trilha, hash
     público, e link para `/aluno/certificados` para baixar.

Reutilize a estrutura do `matriculaDeferida.ts` — mesma forma de
autenticação, mesmo padrão de erro, mesmo cliente do Resend.

**Instruções pro usuário configurar o webhook no Supabase:**

Documente no README que o usuário precisa criar um segundo Database
Webhook no painel do Supabase:

```
1. Painel Supabase → Database → Webhooks
2. Create a new hook
3. Nome: certificado_emitido
4. Schema: certificacao
5. Table: certificados
6. Events: só INSERT
7. Type: HTTP Request
8. URL: https://klass-workers.[REDIGIDO: conta].workers.dev/webhooks/certificado-emitido
9. HTTP Headers:
   - Authorization: Bearer <mesmo WEBHOOK_SECRET já configurado>
10. Save
```

Deixe isso claro pra ele fazer manualmente, é a mesma sequência do
webhook do MS3.

### 7. Frontend: geração do PDF com react-pdf

Instalar:

```bash
pnpm --filter web add @react-pdf/renderer
```

Criar `apps/web/src/pdf/CertificadoPDF.tsx`:

- Um componente React que recebe um `Certificado` (com metadata) como
  prop.
- Usa componentes do `@react-pdf/renderer` (`Document`, `Page`, `View`,
  `Text`, `Image`, `Svg`) para reproduzir o layout do
  `06-certificado.svg`.
- Segue os tokens de cor e tipografia do design system, dentro das
  limitações da biblioteca.
- Inclui o hash público impresso em local visível (rodapé, provavelmente,
  conforme o SVG mostrar).
- Legível em A4 paisagem (ou retrato — depende do SVG).

Onde possível, use os componentes `Font.register` para carregar fontes
customizadas se o design pedir. Se as fontes do design forem exóticas
demais, use as padrão do `react-pdf` (Helvetica, Times) e documente.

### 8. Frontend: tela do aluno — `/aluno/certificados`

Rota protegida por `<Autenticado papel="aluno">`.

- Lista todos os certificados do aluno logado.
- Cada certificado é um card com: nome da trilha, data de emissão,
  hash público, e botão "Baixar PDF".
- Botão "Baixar PDF" usa `PDFDownloadLink` do `@react-pdf/renderer` pra
  gerar e baixar o PDF no cliente.
- Se o aluno não tiver certificados, mostra estado vazio explicativo:
  "Você ainda não concluiu nenhuma trilha completa. Continue estudando!"
  ou similar.

Adicionar link "Meus certificados" no cabeçalho quando `papel = 'aluno'`,
seguindo o padrão dos outros links.

### 9. Frontend: rota pública `/verificar/:hash`

Rota **sem** `<Autenticado>` — acessível a qualquer pessoa da internet.

- Layout simples, sem cabeçalho autenticado. Pode ser uma tela
  standalone.
- Chama `certificacao.verificar_por_hash(p_hash)` via RPC.
- Se retornar dados: mostra "Certificado válido" em destaque, com nome
  do aluno, trilha, data de emissão. Não expõe outros dados sensíveis.
- Se retornar vazio: mostra "Certificado não encontrado" — não expõe
  se o hash está errado ou o certificado foi revogado (nem existe
  revogação neste momento, mas mensagem genérica é boa prática).

Estilização: use os componentes existentes (`Card`, `Badge`). Adicione
um pequeno cabeçalho institucional "Klass — Verificação de Certificado"
pra deixar claro onde a pessoa está.

### 10. Frontend: tela da coordenação — `/coordenacao/certificados`

Rota protegida por `<Autenticado papel="coordenacao">`.

- Lista todos os certificados emitidos, com filtros por trilha e por
  aluno.
- Colunas: aluno, trilha, data de emissão, hash público.
- Botão "Ver PDF" abre em nova aba (gera o PDF na hora).
- Sem ação de revogar/apagar por enquanto.

Adicionar link no menu de coordenação.

### 11. Seeds

Adicionar aos seeds atuais:

- O `aluno.teste` já tem uma matrícula com status `concluida` no seed
  do MS3 (criada pra testar pré-requisitos). Aproveite: **complete
  artificialmente** os outros módulos da trilha "Ciência de Dados
  Aplicada" pra ele, criando matrículas em cada turma existente com
  status `concluida` e dados de diário compatíveis (usando o padrão
  que o MS4 estabeleceu — reabrir matrícula, criar avaliações/aulas,
  chamar `diario.encerrar_matricula`).
- Ao final da execução do seed, o trigger de MS5 deve disparar
  automaticamente e emitir um certificado para o `aluno.teste` da
  trilha "Ciência de Dados Aplicada".
- Documente no seed que esse é o comportamento esperado — a emissão
  não é `insert` explícito, é side effect do trigger.

### 12. Validação end-to-end

Com `pnpm dev` rodando (e o webhook do Supabase configurado se possível,
mas o teste pode simular a chamada direta ao Worker se necessário):

**Como aluno (`aluno.teste`):**

1. Vai em `/aluno/certificados` → vê o certificado da trilha "Ciência de
   Dados Aplicada" (emitido pelo seed).
2. Clica "Baixar PDF" → PDF é gerado no cliente, com layout fiel ao SVG,
   contendo nome, trilha, data e hash impresso.
3. Copia o hash do PDF ou do card.
4. Abre uma janela anônima (sem login) e acessa
   `https://klass-91y.pages.dev/verificar/<hash>` → vê a tela pública
   confirmando o certificado.
5. Tenta com hash inválido (`/verificar/KLASS-2026-XXXX-XXXX`) → vê
   "não encontrado".

**Como coordenação:**

1. Vai em `/coordenacao/certificados` → vê todos os certificados
   emitidos.
2. Filtra por trilha e por aluno.
3. Abre um PDF em nova aba pra conferir.

**Fluxo completo (opcional, se todos os dados estiverem alinhados):**

1. Como coordenação, aprova uma nova matrícula fictícia.
2. Como professor, lança notas boas em avaliações e presença suficiente.
3. Encerra o módulo → status vira `concluida`.
4. Se essa era a última pendente do aluno naquela trilha, um certificado
   é emitido automaticamente.
5. Aluno vê em `/aluno/certificados`, e (se o webhook estiver
   configurado) recebe e-mail de aviso.

### 13. Typecheck, build e CI

```bash
pnpm typecheck
pnpm build
```

Ambos limpos. Se CI já subiu com push anterior, confere que a nova push
com MS5 também fica verde.

## Regras que valem para tudo

Reafirmando o `CLAUDE.md`:

- Vocabulário: "módulo" e "bounded context", nunca "microsserviço".
- Nada de Docker, orquestrador, n8n, backend de CRUD em Workers.
- Frontend fala direto com o Supabase (leitura de certificados
  autenticado; verificação pública via função RPC exposta ao `anon`).
- Worker só é usado para o e-mail de conclusão (padrão do MS3).
- PDF é gerado no cliente com `react-pdf`, não em Worker.
- RLS habilitada em toda tabela nova. Verificação pública sai por função
  `SECURITY DEFINER` exposta ao `anon`, não abrindo a tabela.
- Idempotência nas migrations e no `verificar_e_emitir` (chamar duas
  vezes retorna o mesmo id, não cria duplicata).
- Identificadores de domínio em português; termos técnicos em inglês;
  comentários em português explicando o porquê.
- Padrão de UX: botão voltar em telas internas, feedback inline. Tela
  pública pode ter estilo mais standalone.
- Segurança: `WEBHOOK_SECRET` já existe e é reutilizado. Nada de secret
  novo neste módulo.

## Ao terminar, me entregue

1. **O que você extraiu do SVG** `06-certificado.svg` no passo 1 (layout,
   proporções, elementos, ambiguidades ou limitações do react-pdf que
   forçaram simplificação).
2. **Resumo do que foi criado**, por caminho: migrations, tipos, Worker,
   componente PDF, telas.
3. **Tabela de RLS** do `certificacao.certificados` e como a verificação
   pública funciona sem expor a tabela.
4. **Confirmação da validação end-to-end** — emissão automática pelo
   seed, download do PDF, verificação pública, tela da coordenação.
5. **Ambiguidades ou decisões que você tomou sozinho.**
6. `pnpm typecheck` e `pnpm build` limpos, CI verde.
7. Instrução clara pro usuário configurar o segundo Database Webhook no
   painel do Supabase (o do certificado emitido → Worker).
8. Commits por bloco lógico. Sugestão:
   - "MS5: schema certificacao, tabela certificados, hash publico"
   - "MS5: funcao verificar_e_emitir e trigger em matriculas"
   - "MS5: RLS de certificacao e verificacao publica sem exposicao"
   - "MS5: worker de e-mail de certificado emitido"
   - "MS5: componente PDF do certificado com react-pdf"
   - "MS5: tela do aluno com download e tela publica de verificacao"
   - "MS5: tela da coordenacao com listagem e filtros"
   - "MS5: seed completando trilha do aluno.teste para emitir certificado"

Pare no MS5. Sistema completo. Aguarde o próximo prompt para deploy
final da avaliação SUS ou pra ajustes.
