# Prompt 03 — MS2 Catálogo Curricular

Você vai construir o **segundo módulo** do Klass: **MS2, Catálogo Curricular**.
Leia o `CLAUDE.md` na raiz antes de começar — ele é a fonte de verdade sobre
arquitetura, stack e regras. Se algo neste prompt contradisser o `CLAUDE.md`,
pare e pergunte.

## Contexto

MS1 já está pronto: schema `identidade`, tabela `profiles`, três papéis
(`aluno`, `professor`, `coordenacao`), RLS aplicada e funcionando, telas de
entrar/cadastrar, três contas de teste no seed. A verificação de e-mail no
Supabase está **ligada** (comportamento seguro); as contas de seed foram
inseridas já verificadas.

MS2 é o próximo em ordem de dependência: MS3 (Motor de Seleção) precisa
saber que trilhas e módulos existem para validar inscrições, então MS2 tem
que vir antes.

## O que o MS2 é

Catálogo Curricular — o módulo que define **o que a instituição oferece**.
Trilhas de aprendizado, seus módulos, carga horária, nível e a relação de
pré-requisitos entre módulos.

Escopo desta etapa:

- Schema `catalogo` com hierarquia completa (Camada A, como discutido):
  trilhas contêm módulos, módulos têm pré-requisitos declarados entre si.
- CRUD completo para a coordenação gerenciar trilhas e módulos.
- Catálogo público para alunos explorarem o que está disponível.
- Seeds de demonstração com trilhas e módulos reais (não placeholder).

Fora de escopo agora:

- Turmas concretas (isso é MS3 — cada turma é uma instância de uma trilha
  num período específico).
- Inscrição em trilhas ou módulos (também MS3).
- Notas, presença, progresso (isso é MS4).
- Certificados (MS5).

## Passo a passo

### 1. Ler os SVGs de referência antes de modelar

Antes de escrever qualquer SQL, abra `docs/design/02-gestor-turmas.svg` e
inspecione o que ele mostra. Também vale abrir `03-aluno-painel.svg`
(catálogo público provavelmente aparece ali) e `01-gestor-visao-geral.svg`
(pode ter métricas de trilha no dashboard).

Extraia:

- **Nomes reais de trilha** que aparecem no design.
- **Nomes reais de módulo** dentro dessas trilhas.
- **Campos que aparecem visualmente** em cada card de trilha ou módulo
  (nome, carga horária, nível, descrição, número de alunos, etc. — anote
  tudo que estiver renderizado).
- **Ordem de exibição** dos módulos numa trilha (numeração, sequência).
- **Como pré-requisitos são visualizados**, se aparecerem.

**Se o SVG tiver conteúdo real** (nomes de trilha e módulo específicos,
não "Trilha 1" ou "Módulo Exemplo"), use esse conteúdo nos seeds.

**Se o SVG tiver placeholder genérico**, pare e me pergunte quais
trilhas você deve usar. Não invente conteúdo por mim.

Documente o que encontrou no início do resumo final da etapa.

### 2. Migration: schema `catalogo` e tabelas

Crie a migration:

```bash
supabase migration new criar_schema_catalogo
```

No arquivo, escreva o SQL para:

**Schema e tipos:**

- `create schema catalogo` com comentário indicando que é o MS2.
- ENUM `catalogo.nivel_modulo` com valores que fizerem sentido a partir
  do design (provavelmente algo como `iniciante`, `intermediario`,
  `avancado`; se o design usar outros nomes, respeite o design).

**Tabela `catalogo.trilhas`:**

- `id uuid primary key default gen_random_uuid()`.
- `slug text not null unique` com `check` de formato (letras minúsculas,
  números, hífen — regex apropriada). O slug vira parte da URL pública
  no catálogo, então precisa ser estável.
- `nome text not null` com `check` de tamanho mínimo (>= 3).
- `descricao text not null` com `check` de tamanho mínimo (>= 10).
- `descricao_curta text` opcional, para os cards do catálogo público
  (limite de tamanho por `check`, tipo 200 caracteres).
- `carga_horaria_total integer generated always as (…)` — se der para
  derivar como coluna computada a partir da soma dos módulos, faça.
  Se for mais simples manter como coluna denormalizada atualizada por
  trigger, faça assim e documente por quê. Coerência é o que importa.
- `publicada boolean not null default false` — coordenação salva rascunho
  antes de expor no catálogo público.
- `criado_em timestamptz not null default now()`.
- `atualizado_em timestamptz not null default now()` com trigger de
  atualização.

**Tabela `catalogo.modulos`:**

- `id uuid primary key default gen_random_uuid()`.
- `trilha_id uuid not null references catalogo.trilhas(id) on delete cascade` —
  se a trilha for apagada, os módulos vão junto.
- `ordem smallint not null` com `check (ordem > 0)`.
- `nome text not null` com `check` de tamanho mínimo.
- `descricao text not null`.
- `nivel catalogo.nivel_modulo not null`.
- `carga_horaria_horas smallint not null` com `check (carga_horaria_horas > 0)`.
- `criado_em`, `atualizado_em` como acima.
- **Constraint única** `unique (trilha_id, ordem)` — não pode ter dois
  módulos com a mesma ordem na mesma trilha.

**Tabela `catalogo.pre_requisitos_modulo`:**

- Modela a relação "para cursar o módulo X, é preciso ter concluído os
  módulos [A, B, C]". É uma tabela associativa.
- Colunas: `modulo_id uuid`, `pre_requisito_id uuid`, ambos com FK para
  `catalogo.modulos(id) on delete cascade`.
- Chave primária composta `(modulo_id, pre_requisito_id)`.
- `check (modulo_id <> pre_requisito_id)` — um módulo não é
  pré-requisito de si mesmo.
- **Trigger anti-ciclo:** antes de inserir uma linha, valida que a
  inclusão não criaria um ciclo no grafo de dependências. Uma função em
  PL/pgSQL que faz uma busca (recursiva ou por CTE `with recursive`) para
  detectar ciclo. Documente que sem essa proteção o MS3 poderia entrar
  em loop ao validar pré-requisitos.
- Também: `pre_requisito_id` só pode apontar para um módulo da **mesma
  trilha** OU de outra trilha? Decisão de negócio.
  **Assuma: mesma trilha apenas**, e crie um trigger que valide isso
  também. Comente por quê: modelar dependências cruzando trilhas é
  complexidade sem retorno claro neste escopo, e o design não mostra
  esse caso.

**Índices:**

- `catalogo.modulos(trilha_id, ordem)` — a listagem sempre vem ordenada.
- `catalogo.trilhas(slug) where publicada` — o catálogo público filtra por
  publicada.

Comente cada bloco em português explicando o **porquê**.

### 3. Migration: RLS do `catalogo`

Nova migration:

```bash
supabase migration new rls_catalogo
```

Nesse arquivo:

**`catalogo.trilhas`:**

- RLS habilitada.
- `SELECT`: qualquer usuário autenticado pode ver trilhas onde
  `publicada = true`. **Coordenação** vê todas (publicadas e não).
- `INSERT`, `UPDATE`, `DELETE`: apenas coordenação. Use a função
  `identidade.usuario_e_coordenacao()` já criada no MS1.
- `DELETE` de trilha publicada deve ser bloqueado — trilhas que já foram
  ao ar podem ter turmas históricas dependendo (MS3 vai referenciar).
  Faça isso com policy ou trigger `before delete`.

**`catalogo.modulos`:**

- RLS habilitada.
- `SELECT`: qualquer autenticado vê módulos de trilhas publicadas;
  coordenação vê todos.
- `INSERT`, `UPDATE`, `DELETE`: apenas coordenação.

**`catalogo.pre_requisitos_modulo`:**

- RLS habilitada.
- `SELECT`: mesma regra dos módulos (público vê os de trilhas publicadas,
  coordenação vê tudo).
- `INSERT`, `UPDATE`, `DELETE`: apenas coordenação.

### 4. Funções auxiliares do `catalogo`

Ainda na mesma migration (ou uma nova, se preferir separar):

- `catalogo.modulos_da_trilha(p_trilha_id uuid)` — retorna a lista de
  módulos de uma trilha ordenada por `ordem`, com nível e carga.
  `SECURITY INVOKER` (respeita RLS de quem chama).
- `catalogo.pre_requisitos_de_modulo(p_modulo_id uuid)` — retorna os
  módulos que são pré-requisito de um módulo específico. O MS3 vai usar
  isso na hora da inscrição.

Documente que essas funções são o **API interno do MS2** — outros módulos
que precisarem dessa informação devem chamá-las, não ler a tabela direto.

### 5. Aplicar as migrations

```bash
supabase db push
```

Depois:

```bash
supabase db diff --linked
```

Não deve mostrar diferença.

### 6. Regerar tipos TypeScript

```bash
supabase gen types typescript --linked > packages/types/src/database.ts
```

Adicione ao `packages/types/src/index.ts` os tipos de domínio nomeados de
MS2:

```ts
export type Trilha = Database['catalogo']['Tables']['trilhas']['Row']
export type Modulo = Database['catalogo']['Tables']['modulos']['Row']
export type NivelModulo = Database['catalogo']['Enums']['nivel_modulo']
export type PreRequisitoModulo = Database['catalogo']['Tables']['pre_requisitos_modulo']['Row']
```

### 7. Seeds

Adicione ao `supabase/seed.sql` (ou crie um `supabase/seed.sql` se ele não
existir; o do MS1 pode estar em outro lugar — respeite a convenção que
ficou).

Use as trilhas e módulos que você extraiu do SVG no passo 1. Cada trilha
deve ter:

- Um slug bem formado.
- Descrição real e descrição curta.
- Ao menos 4 módulos, cada um com nível e carga horária.
- Alguns pré-requisitos entre módulos (ex.: módulo 2 requer módulo 1;
  módulo 4 requer módulos 2 e 3).
- Marque **todas** como `publicada = true`, para o catálogo público não
  ficar vazio nos testes.

Se você não extraiu conteúdo real do SVG (porque o design tinha
placeholder), pare aqui e me pergunte antes de inventar.

Reaplique o seed. Se você usou `supabase/seed.sql`, o `db reset --linked`
reroda o seed junto — cuidado com isso, pois apaga usuários criados
manualmente. Se preferir aplicar só o seed de MS2 sem resetar tudo,
documenta a maneira que usou.

### 8. Frontend: telas de gestão para a coordenação

Rotas novas, todas protegidas por `<Autenticado papel="coordenacao">`:

- **`/coordenacao/trilhas`** — lista todas as trilhas (publicadas e não),
  com badges de status, número de módulos, carga total. Botão "Nova
  trilha" no topo. Cada linha tem ações "Editar", "Publicar/Despublicar"
  e "Apagar" (com confirmação, e Apagar fica desabilitado se
  `publicada = true`).
- **`/coordenacao/trilhas/nova`** — formulário para criar trilha nova
  (nome, slug — sugerido a partir do nome, editável —, descrição,
  descrição curta).
- **`/coordenacao/trilhas/:slug/editar`** — editar dados básicos da
  trilha. Nesta tela também aparece a lista ordenada dos módulos da
  trilha, com opções de adicionar módulo, reordenar (drag-and-drop se
  couber; se não couber no escopo, campos numéricos de ordem com botões
  "subir"/"descer" bastam), editar cada módulo, apagar módulo, e um
  editor visual dos pré-requisitos (uma lista de "este módulo requer:"
  com checkboxes dos outros módulos da trilha).

**Formulários:**

- Use os componentes atômicos existentes (`Card`, `Input`, `Button`,
  `Badge`).
- Validação client-side para dar feedback imediato (slug válido, campos
  obrigatórios), mas confie no banco como garantia final. Se o banco
  responder erro, mostre mensagem em português tratada — nunca a
  mensagem crua do Postgres.
- Ao salvar, otimize para: sem recarregar página, feedback claro do que
  aconteceu (toast, banner, o que fizer sentido no design system).

**Não** invente componentes complexos novos. Se precisar de algo como
select múltiplo (para pré-requisitos) ou drag-and-drop, use a solução
mais simples que resolve — vamos refinar UX em outra etapa.

### 9. Frontend: catálogo público

Rota nova, acessível a **qualquer usuário autenticado** (aluno,
professor, coordenação — todos podem explorar o catálogo):

- **`/catalogo`** — lista todas as trilhas com `publicada = true`. Cada
  card mostra: nome, descrição curta, número de módulos, carga total,
  botão "Ver detalhes".
- **`/catalogo/:slug`** — página de detalhe da trilha. Mostra: nome,
  descrição completa, carga total, lista de módulos em ordem (com
  nome, nível, carga, descrição breve). Em cada módulo, se ele tiver
  pré-requisitos, mostra "Requer: [nome do módulo 1], [nome do módulo 2]".
- **Ainda não tem botão "inscrever-se"** — isso é MS3. Deixe uma nota
  clara ou um placeholder visual indicando que a inscrição virá na
  próxima fase.

O design do catálogo público deve ser derivado do que aparece no
`03-aluno-painel.svg` (se houver referência) ou fiel ao tom geral dos
outros SVGs. Se estiver em dúvida, opte pelo mais simples possível
usando os tokens existentes.

### 10. Menu de navegação

Se ainda não existe um menu/navbar principal, crie um enxuto. Ele muda o
que aparece baseado no papel do usuário logado:

- Todos os papéis: link para `/catalogo`, botão "Sair", nome do usuário
  visível.
- Papel `coordenacao`: adiciona link para `/coordenacao/trilhas`.
- Papel `professor` e `aluno`: só o catálogo por enquanto (os menus
  específicos deles vêm nos módulos seguintes).

Coloque isso num componente `<Cabecalho>` (ou nome equivalente) usado
pelas rotas protegidas. Não polua as telas de entrar/cadastrar com esse
cabeçalho.

### 11. Validação end-to-end

Rode `pnpm dev` e valide, na ordem, com **cada uma das três contas de
teste**:

Como **coordenação**:

1. Acessa `/coordenacao/trilhas` → vê as trilhas do seed.
2. Cria uma trilha nova pelo formulário → aparece na lista, marcada como
   não publicada.
3. Edita a trilha, adiciona 2 módulos com um pré-requisito entre eles →
   salva → confere que os pré-requisitos aparecem.
4. Publica a trilha → status muda.
5. Tenta apagar a trilha publicada → é bloqueado com mensagem clara.
6. Despublica → tenta apagar → funciona.
7. Vai em `/catalogo` → vê a trilha (agora que despublicou, não vê mais).

Como **professor** e **aluno**:

1. Acessa `/catalogo` → vê apenas trilhas publicadas.
2. Entra em uma trilha → vê módulos, ordem, pré-requisitos.
3. Tenta acessar `/coordenacao/trilhas` diretamente na URL → bloqueado
   (a página `<Autenticado papel="coordenacao">` faz o certo — redireciona
   ou mostra acesso negado, o que ficou decidido no MS1).

Se algum passo falhar, corrija.

### 12. Typecheck e build

```bash
pnpm typecheck
pnpm build
```

Ambos limpos antes de terminar.

## Regras que valem para tudo

Reafirmando o `CLAUDE.md`:

- Vocabulário: "módulo" e "bounded context", nunca "microsserviço".
- Nada de Docker, orquestrador, n8n, backend de CRUD em Workers.
- Frontend fala **direto** com o Supabase para os dados do catálogo — não
  crie endpoint no Worker para isso.
- RLS habilitada em toda tabela nova. Se precisar contornar RLS, algo
  está errado — pergunte antes.
- Idempotência nas migrations (`if not exists` etc.).
- Identificadores de domínio em português; termos técnicos em inglês;
  comentários em português explicando o porquê.
- Não coloque segredo nenhum em arquivo versionado. Confira que o `.env`
  continua no `.gitignore`.

## Ao terminar, me entregue

1. **O que você extraiu do SVG** no passo 1 (trilhas e módulos que virou
   seed, ou constatação de que o SVG tinha placeholder e você me
   perguntou).
2. **Resumo do que foi criado**, por caminho: migrations, tipos, telas,
   componentes.
3. **Tabela de RLS**: o que cada papel pode fazer com trilhas, módulos e
   pré-requisitos.
4. **Confirmação de que a validação end-to-end passou** com as três
   contas.
5. **Ambiguidades ou decisões que você tomou sozinho** (se houver).
6. `pnpm typecheck` e `pnpm build` limpos.
7. Um commit por bloco lógico, com mensagem clara. Exemplo mínimo:
   - "MS2: schema catalogo, trilhas e modulos com pre-requisitos"
   - "MS2: RLS de catalogo por papel"
   - "MS2: gestao de trilhas para coordenacao"
   - "MS2: catalogo publico e integracao no cabecalho"

Pare no MS2. Aguarde o próximo prompt para MS3 (Motor de Seleção).
