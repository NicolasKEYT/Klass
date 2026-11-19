# Prompt 05 — MS3 Motor de Seleção

Você vai construir o **terceiro módulo** do Klass: **MS3, Motor de Seleção**.
Leia o `CLAUDE.md` na raiz antes de começar — ele é a fonte de verdade sobre
arquitetura, stack e regras. Se algo neste prompt contradisser o `CLAUDE.md`,
pare e pergunte.

## Contexto

MS1 (Identidade) e MS2 (Catálogo) já estão prontos e funcionando. O que
existe no repo:

- Schema `identidade` com `profiles` e três papéis (`aluno`, `professor`,
  `coordenacao`).
- Funções auxiliares `identidade.papel_do_usuario_atual()` e
  `identidade.usuario_e_coordenacao()`, usadas por policies dos outros
  módulos.
- Schema `catalogo` com `trilhas`, `modulos`, `pre_requisitos_modulo` (esse
  último modela dependências **entre módulos dentro da mesma trilha** —
  não confundir com pré-requisitos entre trilhas que este prompt vai
  criar).
- Trilha de seed "Ciência de Dados Aplicada" publicada, com 4 módulos.
- Design system, botão voltar, padrão "Salvar e voltar" nos formulários,
  feedback inline como padrão de UX.
- Workers com uma rota `/health`, cliente Supabase admin (service role
  key), módulo de e-mail via Resend pronto mas nunca chamado.
- CORS configurado, CI verde.

## O que o MS3 é

Motor de Seleção — o módulo que transforma **interesse do aluno em
matrícula oficial**, validando pré-requisitos e ocupando vagas de forma
transacional.

O artigo do TCC 1 é explícito: MS3 "encapsula as regras de inscrição e
atua de forma transacional, validando pré-requisitos e convertendo o
interesse do candidato em matrícula oficial na base de dados". E o
Fluxo 1 da avaliação é: "Inscrição Nativa com validação automática de
pré-requisitos e envio de e-mail de aceite".

Este módulo implementa esse fluxo ponta a ponta.

## Modelo de domínio (decidido antes deste prompt)

**Turmas.** Uma turma é uma oferta concreta de uma trilha num período
específico, com professor(es) e vagas. Aluno se inscreve na turma inteira
(não módulo por módulo). Ao concluir, ganha um certificado da trilha.

**Múltiplas trilhas em paralelo.** Um aluno pode estar matriculado em
várias trilhas ao mesmo tempo, desde que sejam trilhas diferentes. Não
pode estar em duas turmas ativas da mesma trilha simultaneamente (não
faz sentido cursar "Ciência de Dados I" em duas turmas paralelas).

**Pré-requisitos entre trilhas.** Uma trilha pode exigir que o aluno tenha
concluído outras trilhas antes de se inscrever. Exemplo: "Ciência de
Dados II" exige "Ciência de Dados I" concluída. Esse tipo de
pré-requisito é **entre trilhas**, e é diferente dos pré-requisitos entre
módulos que o MS2 já modela.

**Vagas fixas.** Cada turma tem um número máximo de vagas. Quando enche,
inscrições novas são bloqueadas. Sem lista de espera nesta versão.

**Fluxo de aprovação em duas etapas.** O aluno se inscreve (status
`inscrita`), coordenação avalia e aprova (status vira `matriculada`) ou
rejeita (status `rejeitada`). Aluno pode cancelar a própria inscrição
antes da aprovação (status `cancelada`). E o MS4 fechará matrículas com
status `concluida` quando o aluno terminar a trilha (futuro).

**E-mail de aceite.** Quando o status muda para `matriculada`, um
Database Webhook chama um Worker, que envia e-mail via Resend informando
o aluno.

## Passo a passo

### 1. Ler os SVGs de referência

Antes de modelar, abra os SVGs que provavelmente mostram partes do MS3:

- `docs/design/02-gestor-turmas.svg` — gestão de turmas da coordenação
  (possivelmente inclui deferimento de inscrições)
- `docs/design/03-aluno-painel.svg` — painel do aluno (pode mostrar
  matrículas ativas)
- `docs/design/05-professor-diario.svg` — diário do professor (mostra
  turmas do professor, o que também é MS3)

Extraia:

- **Nomes reais de turma** que aparecem no design (códigos tipo
  "Turma 2026.3 - HTML & CSS", nomes de professor).
- **Campos visíveis** em cada card de turma e em cada linha de
  inscrição/matrícula (código, disciplina, professor, status, vagas
  ocupadas, período, etc.).
- **Fluxos de deferimento** que aparecem (botões, estados visuais).
- **Visualização da lista de alunos** por turma (na visão do professor).

Se o design mostrar códigos e nomes que fazem sentido, use nos seeds.
Se for placeholder genérico, use os seeds inventando conteúdo coerente
com a trilha "Ciência de Dados Aplicada" que já existe (a próxima seção
detalha os seeds).

Documente o que encontrou no início do resumo final.

### 2. Migration: schema `selecao` e tabelas

Crie a migration:

```bash
supabase migration new criar_schema_selecao
```

**Schema e tipos:**

- `create schema selecao` com comentário indicando que é o MS3.
- ENUM `selecao.status_matricula` com valores: `inscrita`, `matriculada`,
  `rejeitada`, `cancelada`, `concluida`.

**Tabela `selecao.turmas`:**

- `id uuid primary key default gen_random_uuid()`.
- `trilha_id uuid not null references catalogo.trilhas(id) on delete restrict` —
  turma não pode existir sem a trilha. Se coordenação tentar apagar uma
  trilha com turmas, o banco bloqueia (o MS2 já bloqueia deletar trilha
  publicada, mas essa restrição adicional protege contra apagar trilha
  não publicada que tenha ganhado turma).
- `codigo text not null unique` com `check` de formato (uma expressão
  regular apropriada tipo `^[A-Z0-9\-]{4,20}$`, se o design usar padrão
  como "26MAR01M", respeita).
- `professor_id uuid not null references identidade.profiles(id) on delete restrict` —
  bloqueia deletar profile que tem turma ativa. Deve ser um profile com
  `papel = 'professor'` (valide isso via trigger `before insert/update`,
  porque a FK sozinha não sabe do papel).
- `periodo_inicio date not null`.
- `periodo_fim date not null` com `check (periodo_fim > periodo_inicio)`.
- `vagas_total smallint not null` com `check (vagas_total > 0)`.
- `criado_em`, `atualizado_em` com trigger de atualização já padrão do
  projeto.

**Índices:**

- `selecao.turmas(trilha_id)`.
- `selecao.turmas(professor_id)`.
- `selecao.turmas(periodo_inicio)` para ordenar por data.

**Tabela `selecao.pre_requisitos_trilha`:**

Modela "para se inscrever na trilha X, é preciso ter concluído as trilhas
[A, B, C]". Tabela associativa.

- `trilha_id uuid` — a trilha que exige o requisito.
- `trilha_requisito_id uuid` — a trilha que é pré-requisito.
- Ambos com FK para `catalogo.trilhas(id) on delete cascade`.
- Chave primária composta `(trilha_id, trilha_requisito_id)`.
- `check (trilha_id <> trilha_requisito_id)` — trilha não é
  pré-requisito de si mesma.
- **Trigger anti-ciclo** (mesma técnica do MS2 para
  `pre_requisitos_modulo`): valida via `with recursive` que a inserção
  não cria ciclo no grafo. Use `security definer` para evitar recursão
  em RLS.

**Tabela `selecao.matriculas`:**

- `id uuid primary key default gen_random_uuid()`.
- `aluno_id uuid not null references identidade.profiles(id) on delete cascade`
  (o profile deve ter `papel = 'aluno'`, valide via trigger).
- `turma_id uuid not null references selecao.turmas(id) on delete restrict` —
  não pode apagar turma que já tem matrícula, ainda que rejeitada
  (histórico é importante).
- `status selecao.status_matricula not null default 'inscrita'`.
- `criado_em timestamptz not null default now()`.
- `atualizado_em timestamptz not null default now()`.
- `deferido_em timestamptz` — preenchido quando status vira `matriculada`
  ou `rejeitada`.
- `deferido_por uuid references identidade.profiles(id)` — quem
  aprovou/rejeitou (profile com papel `coordenacao`).
- `motivo_rejeicao text` — obrigatório quando status é `rejeitada`
  (valide via `check`).
- **Constraint única parcial:** `unique (aluno_id, turma_id)` —
  aluno não pode ter duas linhas para a mesma turma (uma inscrição por
  vez; se rejeitada, poderia se re-inscrever, mas isso complica —
  mantenha simples: uma linha por (aluno, turma), status final é o que
  vale).

**Índices:**

- `selecao.matriculas(aluno_id, status)` — buscas do painel do aluno.
- `selecao.matriculas(turma_id, status)` — listagem da coordenação e
  visão do professor.

### 3. Triggers e funções do `selecao`

Continuar na mesma migration ou criar outra (`funcoes_selecao`), o que
ficar mais claro. Comente cada função com o **porquê**.

**Função `selecao.professor_da_turma(p_profile_id uuid) returns boolean`:**

Valida que o `profile_id` referenciado tem `papel = 'professor'`. Usada
pelo trigger de validação da tabela `turmas`. `security definer`,
`stable`.

**Função `selecao.aluno_da_matricula(p_profile_id uuid) returns boolean`:**

Mesma coisa para aluno. Usada pelo trigger de validação de `matriculas`.

**Trigger `selecao.turmas_valida_professor` (before insert or update on selecao.turmas):**

Chama `professor_da_turma`; se retornar false, `raise exception` com
mensagem clara em português.

**Trigger `selecao.matriculas_valida_aluno` (before insert on selecao.matriculas):**

Chama `aluno_da_matricula`; erro se não for aluno.

**Função `selecao.validar_pre_requisitos_trilha(p_aluno_id uuid, p_trilha_id uuid) returns void`:**

O coração do MS3. Verifica se o aluno concluiu todas as trilhas que são
pré-requisito de `p_trilha_id`. Se faltar alguma, `raise exception` com
mensagem específica ("Você precisa concluir a trilha X antes de se
inscrever nesta").

Implementação:

- Busca em `selecao.pre_requisitos_trilha` as trilhas que são pré para
  `p_trilha_id`.
- Para cada uma, verifica se existe linha em `selecao.matriculas` com
  `aluno_id = p_aluno_id`, trilha correspondente (via join com `turmas`),
  e `status = 'concluida'`.
- Se alguma faltar, monta a mensagem listando as trilhas faltantes e
  levanta a exceção.

`security definer`, para poder ler os dados do aluno mesmo dentro do
trigger de outro contexto.

**Função `selecao.checar_vaga_disponivel(p_turma_id uuid) returns void`:**

Conta matrículas ativas da turma (status `inscrita` ou `matriculada`) e
compara com `turmas.vagas_total`. Se cheio, `raise exception "Turma sem
vagas disponíveis"`.

**Função `selecao.checar_matricula_ativa_na_trilha(p_aluno_id uuid, p_trilha_id uuid) returns void`:**

Verifica se o aluno já tem matrícula ativa (status `inscrita` ou
`matriculada`) em outra turma da mesma trilha. Se sim, `raise exception`
com mensagem clara.

**Trigger `selecao.matriculas_valida_regras_negocio` (before insert on selecao.matriculas):**

Chama, em ordem:

1. `selecao.aluno_da_matricula(NEW.aluno_id)` — já feito pelo trigger
   anterior; pode compor ou separar.
2. `selecao.checar_vaga_disponivel(NEW.turma_id)`
3. `selecao.checar_matricula_ativa_na_trilha(NEW.aluno_id, (select trilha_id from selecao.turmas where id = NEW.turma_id))`
4. `selecao.validar_pre_requisitos_trilha(NEW.aluno_id, (select trilha_id from selecao.turmas where id = NEW.turma_id))`

Se qualquer uma falhar, a matrícula não é inserida. O aluno vê a mensagem
no frontend (que precisa tratar erros do banco em português).

**Trigger `selecao.matriculas_registra_deferimento` (before update on selecao.matriculas):**

Quando `status` muda de `inscrita` para `matriculada` ou `rejeitada`:

- Preenche `NEW.deferido_em = now()`.
- Verifica que `NEW.deferido_por` foi informado (não pode ser null nesse
  caso).
- Se `NEW.status = 'rejeitada'`, exige `NEW.motivo_rejeicao is not null`
  e com tamanho mínimo.

### 4. Funções auxiliares expostas ao frontend (RPC)

Duas funções que o frontend vai chamar via `.rpc()`:

**`selecao.inscrever_aluno(p_turma_id uuid) returns uuid`:**

- Lê `auth.uid()` (o próprio usuário logado — não aceita `aluno_id` como
  argumento, para não permitir "inscrever outro aluno via API").
- Insere em `selecao.matriculas` com `status = 'inscrita'`.
- Todos os triggers de validação disparam automaticamente.
- Retorna o `id` da matrícula criada.
- Se qualquer validação falhar, o erro do banco propaga.

`security invoker` (respeita RLS).

**`selecao.cancelar_inscricao(p_matricula_id uuid) returns void`:**

- Lê `auth.uid()`.
- Verifica que a matrícula pertence a esse usuário.
- Verifica que o status atual é `inscrita` (não pode cancelar matrícula
  já aprovada; para isso a coordenação teria que reverter).
- Atualiza status para `cancelada`.

### 5. Migration: RLS do `selecao`

Nova migration:

```bash
supabase migration new rls_selecao
```

**`selecao.turmas`:**

- `SELECT`: qualquer autenticado vê turmas de trilhas publicadas.
  Coordenação vê todas.
- `INSERT`, `UPDATE`, `DELETE`: apenas coordenação
  (`identidade.usuario_e_coordenacao()`).

**`selecao.pre_requisitos_trilha`:**

- `SELECT`: qualquer autenticado.
- `INSERT`, `UPDATE`, `DELETE`: apenas coordenação.

**`selecao.matriculas`:**

- `SELECT`:
  - Aluno vê apenas as próprias matrículas.
  - Professor vê matrículas de turmas onde é o professor.
  - Coordenação vê todas.
- `INSERT`: usuários autenticados podem inserir matrícula própria (via
  função `selecao.inscrever_aluno`, que internamente força `aluno_id =
  auth.uid()`). Alternativa: policy que exige `aluno_id = auth.uid()`.
- `UPDATE`:
  - Aluno pode atualizar apenas para status `cancelada`, apenas suas
    próprias, apenas se atual for `inscrita` (via
    `cancelar_inscricao` ou diretamente).
  - Coordenação pode mudar status entre os valores válidos, com
    preenchimento de `deferido_por` e (se rejeitada) `motivo_rejeicao`.
- `DELETE`: ninguém deleta matrícula pelo app. É histórico.

### 6. Aplicar as migrations e regenerar tipos

```bash
supabase db push
supabase gen types typescript --linked > packages/types/src/database.ts
```

Adicionar ao `packages/types/src/index.ts` os tipos nomeados de MS3:

```ts
export type Turma = Database['selecao']['Tables']['turmas']['Row']
export type Matricula = Database['selecao']['Tables']['matriculas']['Row']
export type StatusMatricula = Database['selecao']['Enums']['status_matricula']
export type PreRequisitoTrilha = Database['selecao']['Tables']['pre_requisitos_trilha']['Row']
```

### 7. Worker: enviar e-mail de aceite

Este é o **primeiro caso real** de Worker sendo chamado por Database
Webhook. Faz isso com cuidado — vira o padrão para MS4 e MS5 depois.

**No Worker (`apps/workers/src/webhooks/`):**

Criar um endpoint `POST /webhooks/matricula-deferida` que:

1. Valida o header `Authorization` contra um secret compartilhado
   (`WEBHOOK_SECRET`) — não deixa qualquer um chamar essa rota da
   internet. O Database Webhook do Supabase vai mandar esse header.
2. Recebe payload JSON no formato do Supabase Database Webhook (com
   `type`, `table`, `record`, `old_record`).
3. Verifica que é um UPDATE em `selecao.matriculas` e que o `status`
   mudou de `inscrita` para `matriculada`. Se não for isso, retorna 200
   OK sem fazer nada (o webhook está bem configurado para filtrar
   antes, mas defensivo é melhor).
4. Usa o cliente Supabase admin (service role) para buscar os dados que
   o e-mail precisa: nome do aluno, e-mail do aluno, nome da trilha,
   código da turma, período.
5. Chama o módulo de e-mail (já existe em `apps/workers/src/email/`)
   com um template específico para "matrícula aprovada".

O corpo do e-mail deve ser simples, em português, com os dados da
matrícula e uma frase de acolhimento. Sem HTML pomposo — texto claro,
uma ou duas linhas de layout.

Se o e-mail falhar, retorne 500 para que o webhook do Supabase possa
tentar de novo (ele tem retry). Loga o erro claramente.

**No Supabase:**

Documente no README como configurar o Database Webhook:

1. Ir no painel do Supabase → Database → Webhooks
2. Criar novo webhook para `UPDATE` na tabela `selecao.matriculas`
3. Apontar para a URL do Worker (produção ou dev via `wrangler tail`)
4. Adicionar header `Authorization: Bearer <WEBHOOK_SECRET>` (o mesmo
   valor do secret do Worker)

Não tente configurar isso automaticamente — o painel do Supabase não
tem API pública para webhooks. É configuração manual, uma vez.

**Variáveis de ambiente novas do Worker:**

- `WEBHOOK_SECRET` (secret via `wrangler secret put`)

Adicionar ao `.env.example` e ao README.

### 8. Frontend: telas da coordenação

Todas em `apps/web/src/pages/coordenacao/`:

**`/coordenacao/turmas`:**

- Lista todas as turmas. Colunas: código, trilha, professor, período,
  vagas (ocupadas / total), inscrições pendentes (contagem de status
  `inscrita`).
- Botão "Nova turma" no topo.
- Cada linha tem "Detalhes" (leva para a próxima tela).

**`/coordenacao/turmas/nova`:**

- Formulário: selecionar trilha (dropdown das publicadas), código,
  professor (dropdown dos profiles com `papel='professor'`),
  período_inicio, período_fim, vagas_total.
- Dois botões: "Salvar e voltar", "Salvar" (padrão estabelecido no MS2).

**`/coordenacao/turmas/:id`:**

- Detalhes da turma.
- Duas seções principais:
  - **Inscrições pendentes** (status `inscrita`): lista os alunos, com
    botões "Aprovar" (vira `matriculada`) e "Rejeitar" (abre um modal
    perguntando o motivo, obrigatório).
  - **Matriculados** (status `matriculada`): lista simples.
- Opcionalmente: outras seções para `rejeitada`, `cancelada`, `concluida`
  para consultar histórico.

**`/coordenacao/trilhas/:slug/editar`** (tela do MS2 já existente):

- Adicionar uma seção "Pré-requisitos" onde a coordenação escolhe quais
  outras trilhas são pré-requisito desta. Usa um select múltiplo com
  todas as outras trilhas publicadas.
- Ao salvar, insere/deleta em `selecao.pre_requisitos_trilha`.

### 9. Frontend: telas do aluno

**`/catalogo/:slug`** (já existe do MS2):

- Adicionar uma seção "Turmas disponíveis" no rodapé, listando as turmas
  ativas dessa trilha (período_inicio no futuro ou em andamento, com
  vagas disponíveis).
- Para cada turma, mostrar professor, período, vagas restantes, e um
  botão "Inscrever-se".
- Se o aluno já está matriculado ou inscrito nessa trilha, mostrar
  status em vez do botão.
- Se pré-requisitos não cumpridos, mostrar aviso explicativo em vez do
  botão (opcional, mas ajuda UX — se não implementar, o clique falha
  com a mensagem do banco, o que também é aceitável).

**`/aluno/matriculas`:**

- Lista todas as matrículas do aluno logado, agrupadas ou filtradas por
  status.
- Para cada uma: trilha, código da turma, professor, período, status
  (badge colorido).
- Botão "Cancelar inscrição" visível apenas para status `inscrita`.
- Adicionar link para essa página no cabeçalho quando papel = `aluno`.

### 10. Frontend: telas do professor

**`/professor/turmas`:**

- Lista as turmas onde o profile logado é o professor.
- Colunas: código, trilha, período, alunos matriculados (contagem).
- Botão "Detalhes" leva para a próxima.

**`/professor/turmas/:id`:**

- Lista os alunos matriculados na turma (status `matriculada`).
- Mostra nome, e-mail (opcional, pode ser privacidade).
- Nesta fase, só leitura. O diário de classe (lançamento de notas) é MS4.

Adicionar link no cabeçalho quando papel = `professor`.

### 11. Seeds

Adicionar ao seed:

- **Uma segunda trilha** para demonstrar pré-requisitos entre trilhas.
  Exemplo: "Ciência de Dados Aplicada — Nível 2" com 3-4 módulos mais
  avançados. Marca como publicada. Adiciona uma linha em
  `selecao.pre_requisitos_trilha` dizendo que Nível 2 depende de Nível 1
  concluída.
- **Duas turmas** da trilha "Ciência de Dados Aplicada" (Nível 1), com
  vagas e datas distintas. Professora `professor.teste` como docente.
- **Uma turma** da trilha "Nível 2", também com Prof. teste.
- **Matrícula concluída simulada:** insere uma linha em
  `selecao.matriculas` com `aluno.teste` e uma turma da trilha Nível 1,
  status `concluida`, com data no passado. Isso permite testar
  imediatamente o fluxo "aluno já concluiu Nível 1, pode se inscrever em
  Nível 2".
- **Uma matrícula em análise:** insere uma linha com `aluno.teste`
  inscrito em uma turma nova do Nível 1, status `inscrita`. Isso dá à
  coordenação algo para aprovar no primeiro teste.

Os seeds devem rodar de forma idempotente. Aplica com `db reset --linked`
(cuidado: apaga tudo antes de reaplicar; se preferir aplicar só o novo
seed, use script alternativo — documenta a decisão).

### 12. Validação end-to-end

Com `pnpm dev` rodando, valida na ordem:

**Como aluno (`aluno.teste`):**

1. Vai em `/catalogo`, entra na trilha "Ciência de Dados Nível 1", vê as
   turmas disponíveis, clica "Inscrever-se" em uma → aparece com status
   `inscrita` em `/aluno/matriculas`.
2. Tenta se inscrever na trilha "Nível 2" antes de concluir Nível 1 → o
   sistema rejeita com mensagem clara sobre pré-requisito.
3. (Simule concluir Nível 1 mudando manualmente o status no banco, ou
   usando o seed que já tem uma matrícula `concluida`.) Tenta se
   inscrever em uma turma do Nível 2 → deve funcionar.
4. Tenta se inscrever em duas turmas da mesma trilha → segunda é
   rejeitada.
5. Tenta cancelar uma inscrição própria → funciona (status vira
   `cancelada`).

**Como coordenação:**

1. Cria uma turma nova para uma trilha existente.
2. Adiciona pré-requisitos a uma trilha editando-a.
3. Vai em `/coordenacao/turmas/:id`, aprova uma inscrição → o e-mail é
   disparado (se webhook configurado; senão, ao menos o status muda).
4. Rejeita outra com motivo → status vira `rejeitada`, motivo salvo.
5. Tenta apagar uma turma com matrículas → banco bloqueia com mensagem
   apropriada.

**Como professor:**

1. Vai em `/professor/turmas`, vê apenas suas turmas.
2. Entra em uma → vê os alunos matriculados. Não vê alunos de outras
   turmas.

Verifica que RLS bloqueia acessos indevidos: aluno tentando ler
matrícula de outro aluno pela URL, professor tentando ler turma que não
é sua, etc. Se algum falhar, corrige antes de continuar.

### 13. Typecheck e build

```bash
pnpm typecheck
pnpm build
```

Ambos limpos.

## Regras que valem para tudo

Reafirmando o `CLAUDE.md`:

- Vocabulário: "módulo" e "bounded context", nunca "microsserviço".
- Nada de Docker, orquestrador (o webhook do Supabase → Worker é
  coreografia, não orquestração), n8n, backend de CRUD em Workers.
- Workers só para o que sai do banco (aqui, e-mail). Toda leitura e
  escrita de dados de domínio é direto do frontend com o Supabase, via
  função RPC ou SELECT/INSERT/UPDATE com RLS aplicando.
- RLS habilitada em toda tabela nova.
- Idempotência nas migrations.
- Identificadores de domínio em português; termos técnicos em inglês;
  comentários em português explicando o porquê.
- Padrão de UX: botão voltar em telas internas, "Salvar" e "Salvar e
  voltar" nos formulários, feedback inline.
- Segredos: `WEBHOOK_SECRET` só nos workers (via `wrangler secret put`),
  nunca em arquivo versionado.

## Ao terminar, me entregue

1. **O que você extraiu do SVG** no passo 1.
2. **Resumo do que foi criado**, por caminho: migrations, tipos,
   endpoints do worker, telas.
3. **Tabela de RLS** — o que cada papel pode fazer com turmas,
   pré-requisitos, matrículas.
4. **Fluxo do e-mail de aceite documentado** — como configurar o webhook
   no painel do Supabase, e como testar localmente (ex.: `wrangler tail`
   ou stub).
5. **Confirmação da validação end-to-end** com as três contas.
6. **Ambiguidades ou decisões que você tomou sozinho.**
7. `pnpm typecheck` e `pnpm build` limpos, CI verde.
8. Um commit por bloco lógico. Exemplo mínimo:
   - "MS3: schema selecao, turmas e matriculas"
   - "MS3: triggers de validacao e funcoes RPC"
   - "MS3: RLS de selecao por papel"
   - "MS3: worker de e-mail de aceite via Resend"
   - "MS3: telas de coordenacao (turmas, deferimento)"
   - "MS3: telas de aluno (inscricao, matriculas)"
   - "MS3: telas de professor (visao das turmas)"
   - "MS3: seeds com trilha Nivel 2 e pre-requisitos"

Pare no MS3. Aguarde o próximo prompt para MS4 (Diário de Classe).
