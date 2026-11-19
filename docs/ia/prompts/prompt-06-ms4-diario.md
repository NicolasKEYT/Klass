# Prompt 06 — MS4 Diário de Classe

Você vai construir o **quarto módulo** do Klass: **MS4, Diário de Classe**.
Leia o `CLAUDE.md` na raiz antes de começar — é a fonte de verdade sobre
arquitetura, stack e regras. Se algo neste prompt contradisser o `CLAUDE.md`,
pare e pergunte.

## Contexto

MS1, MS2 e MS3 já estão prontos e funcionando. O que existe:

- Schema `identidade` com `profiles` e três papéis, funções auxiliares
  `identidade.papel_do_usuario_atual()` e `identidade.usuario_e_coordenacao()`.
- Schema `catalogo` com `trilhas`, `modulos`, `pre_requisitos_modulo`.
- Schema `selecao` com `turmas` e `matriculas` (status atuais: `inscrita`,
  `matriculada`, `rejeitada`, `cancelada`, `concluida`).
- Coluna `selecao.turmas.frequencia_minima_percentual` (default 75).
- Worker + Resend para e-mail de aceite de matrícula, disparado por Database
  Webhook.
- Padrões estabelecidos: RLS-first, formulários com "Salvar" e "Salvar e
  voltar", feedback inline, botão voltar, seeds ricos por módulo.

MS4 é o próximo em ordem de dependência: MS5 (Certificação) precisa que
matrículas cheguem em `concluida`, o que só acontece com MS4 implementado.

## O que o MS4 é

Diário de Classe — o módulo que o **professor** usa para lançar notas e
presença, e onde o sistema calcula automaticamente se o aluno **passou ou
reprovou** ao final do período.

O artigo do TCC 1 associa MS4 a dois dos três Fluxos da avaliação:

- **Fluxo 2** — "Atualização de Notas Híbrida, contemplando o lançamento
  manual pelo professor".
- **Fluxo 3** — quando o aluno atinge a conclusão, o Supabase notifica o
  frontend via Realtime.

Este prompt implementa o lançamento manual (Fluxo 2) e prepara o gatilho
de conclusão (Fluxo 3), que o MS5 vai consumir depois.

**A parte de sincronização automática via n8n/Moodle que o artigo cita não
faz parte deste projeto** (o desvio já está documentado no `CLAUDE.md`).

## Modelo de domínio (decidido antes deste prompt)

**Avaliações por turma, definidas pelo professor.** Cada professor cria as
avaliações da própria turma (Prova 1, Trabalho, Seminário, o que ele quiser),
com peso associado a cada uma. O sistema calcula média ponderada.

**Chamada por aula individual.** Cada aula tem data, horário e descrição
opcional. Professor cria as aulas das próprias turmas e, para cada uma,
marca presença/ausência de cada matriculado. Frequência do aluno =
presenças / total de aulas dadas.

**Regra de aprovação:** aluno é aprovado quando **média ponderada ≥ 6.0**
E **frequência ≥ frequencia_minima_percentual da turma** (default 75%,
configurável por turma pela coordenação — campo já existe do MS3).

**Encerramento manual pelo professor.** Aluno vê notas e faltas parciais
durante o período. O resultado final só sai quando o professor clica em
"Encerrar módulo", momento em que o sistema calcula e trava. O botão fica
desabilitado enquanto houver avaliação sem nota ou aula sem chamada.

**Novos estados de matrícula:**

- `concluida` já existe — passa a significar "aprovado".
- Adicionar `reprovada` — aluno não atingiu média ou frequência.
- Motivo detalhado (por nota, por falta, por ambos) fica em coluna
  separada `motivo_conclusao` na tabela `matriculas`.

**Realtime.** Quando o professor lança nota ou faz chamada, o painel do
aluno atualiza sozinho, sem recarregar. É o cumprimento explícito do que
o artigo pede para o Fluxo 3.

## Passo a passo

### 1. Ler os SVGs de referência

Antes de modelar, abra:

- `docs/design/05-professor-diario.svg` — a tela principal do diário
  (deve mostrar como o professor visualiza avaliações e chamada).
- `docs/design/04-aluno-boletim.svg` — o boletim do aluno (deve mostrar
  como o aluno vê notas e frequência).
- `docs/design/03-aluno-painel-turmas.svg` e
  `03-aluno-painel-inicial.svg` — como as matrículas aparecem, se
  progresso é mostrado, etc.

Extraia:

- **Layout das telas** (o professor lança tudo numa tela só? tem abas?
  aulas separadas de avaliações?).
- **Campos visíveis** em cada avaliação e em cada aula.
- **Como o aluno vê o progresso parcial** (barra? porcentagem? tabela?).
- **Botão de "encerrar módulo"** — onde aparece? Como fica quando
  desabilitado?

Se algum ponto do design contradisser este prompt, pare e pergunte antes
de fazer o desvio (a decisão de encerramento manual, por exemplo, veio
de discussão — se o design mostrar cálculo em tempo real sem botão de
encerramento, precisa ser reconsiderado).

Documente o que encontrou no início do resumo final.

### 2. Migration: schema `diario` e tabelas

```bash
supabase migration new criar_schema_diario
```

**Schema:**

- `create schema diario` com comentário indicando que é o MS4.

**Enum atualizado (não é uma tabela, mas vive em `selecao`):**

Este ponto é sutil. O enum `selecao.status_matricula` precisa ganhar o
valor `reprovada`. Isso é uma alteração de MS3, mas motivada por MS4.
Documente o motivo no comentário da migration.

- Adicionar `reprovada` ao enum. Postgres permite adicionar valores a
  enums existentes; use `alter type ... add value if not exists`.

**Migration adicional em `selecao` (mesma migration ou separada):**

- Adicionar coluna `motivo_conclusao text` em `selecao.matriculas`.
  Nullable — só preenchida quando a matrícula é encerrada.
- Adicionar coluna `encerrada_em timestamptz` — quando o professor
  encerrou.
- Adicionar coluna `encerrada_por uuid references identidade.profiles(id)` —
  qual profile encerrou (deve ser o professor da turma; valida via
  trigger).

**Tabela `diario.avaliacoes`:**

- `id uuid primary key default gen_random_uuid()`.
- `turma_id uuid not null references selecao.turmas(id) on delete cascade` —
  se a turma sumir, as avaliações vão junto.
- `titulo text not null` com `check` de tamanho mínimo.
- `descricao text` opcional.
- `peso smallint not null` com `check (peso > 0)` — peso pode ser
  qualquer inteiro positivo; a média ponderada normaliza pelo total.
- `ordem smallint not null` — para exibir na ordem que o professor
  definiu.
- `criado_em`, `atualizado_em`.
- `unique (turma_id, ordem)` — não pode ter duas avaliações na mesma
  ordem.

**Tabela `diario.notas`:**

- `id uuid primary key default gen_random_uuid()`.
- `avaliacao_id uuid not null references diario.avaliacoes(id) on delete cascade`.
- `matricula_id uuid not null references selecao.matriculas(id) on delete cascade`.
- `valor numeric(4,2) not null` com `check (valor between 0 and 10)`.
- `lancada_em timestamptz not null default now()`.
- `lancada_por uuid not null references identidade.profiles(id)` — quem
  lançou (professor).
- `unique (avaliacao_id, matricula_id)` — uma nota por aluno por
  avaliação.

**Tabela `diario.aulas`:**

- `id uuid primary key default gen_random_uuid()`.
- `turma_id uuid not null references selecao.turmas(id) on delete cascade`.
- `data date not null`.
- `horario time`.
- `descricao text` opcional.
- `criada_em`, `atualizada_em`.
- **Sem** constraint única por data — pode haver mais de uma aula no
  mesmo dia (manhã e tarde, por exemplo). Se você achar que faz sentido
  restringir por data + horário, adicione — mas justifique.

**Tabela `diario.presencas`:**

- `id uuid primary key default gen_random_uuid()`.
- `aula_id uuid not null references diario.aulas(id) on delete cascade`.
- `matricula_id uuid not null references selecao.matriculas(id) on delete cascade`.
- `presente boolean not null`.
- `registrada_em timestamptz not null default now()`.
- `registrada_por uuid not null references identidade.profiles(id)`.
- `unique (aula_id, matricula_id)` — uma presença por aluno por aula.

**Índices:**

- `diario.avaliacoes(turma_id, ordem)`.
- `diario.notas(matricula_id)` — para o aluno consultar suas notas.
- `diario.notas(avaliacoes_id)` — para o professor lançar em bloco.
- `diario.aulas(turma_id, data)`.
- `diario.presencas(matricula_id)` — para calcular frequência do aluno.
- `diario.presencas(aula_id)` — para a chamada.

Comente cada bloco em português explicando o **porquê**.

### 3. Triggers e funções do `diario`

Continua na mesma migration ou outra. Use `security definer` onde precisar
evitar recursão em RLS.

**Validações de professor:**

- Trigger `before insert or update on diario.avaliacoes`: valida que
  quem está inserindo é o professor da turma (ou coordenação). Compare
  `auth.uid()` com `selecao.turmas.professor_id`. Coordenação passa
  independente.
- Trigger equivalente para `diario.aulas`.

**Validações de nota e presença:**

- Trigger `before insert or update on diario.notas`: valida que a
  matrícula pertence à turma da avaliação (evita lançar nota do aluno X
  na turma Y por confusão de FK). E que a matrícula tem status
  `matriculada` (não pode lançar nota para inscrição não aprovada ou
  cancelada).
- Trigger equivalente para `diario.presencas`.

**Bloqueio pós-encerramento:**

- Trigger `before insert or update or delete on diario.notas`: se a
  matrícula correspondente tem status `concluida` ou `reprovada`,
  bloqueia com mensagem "Matrícula já encerrada. Não é possível alterar
  notas."
- Mesmo para `diario.presencas`.

**Função `diario.media_ponderada(p_matricula_id uuid) returns numeric`:**

- Busca todas as avaliações da turma da matrícula.
- Para cada uma, busca a nota do aluno em `diario.notas`. Se não houver
  nota, a avaliação **não entra no cálculo** (avaliação sem nota é
  incompleta).
- Retorna: soma(nota × peso) / soma(pesos das avaliações com nota).
- Se nenhuma avaliação tem nota, retorna `null`.

`security definer`, `stable`.

**Função `diario.frequencia_percentual(p_matricula_id uuid) returns numeric`:**

- Conta aulas da turma da matrícula que já têm alguma chamada registrada
  (se a aula existe mas ninguém tem presença gravada, não conta —
  significa que a chamada não foi feita).
- Conta em quantas dessas o aluno está presente.
- Retorna (presenças × 100.0 / total_de_aulas_com_chamada), ou `null`
  se não houver aula com chamada.

`security definer`, `stable`.

**Função `diario.pronto_para_encerrar(p_matricula_id uuid) returns boolean`:**

- Verifica que todas as avaliações da turma têm nota lançada para essa
  matrícula.
- Verifica que todas as aulas da turma têm presença registrada para
  essa matrícula.
- Retorna true se as duas condições forem verdadeiras.

`security definer`, `stable`.

**Função `diario.encerrar_matricula(p_matricula_id uuid) returns void`:**

O coração do MS4. Chamada pelo frontend do professor quando ele clica
"Encerrar módulo".

- Verifica que quem chama é o professor da turma da matrícula (ou
  coordenação). Se não for, `raise exception`.
- Verifica que `diario.pronto_para_encerrar(p_matricula_id)` retorna
  true. Se não, `raise exception` com mensagem clara sobre o que falta.
- Calcula `media = diario.media_ponderada(p_matricula_id)`.
- Calcula `freq = diario.frequencia_percentual(p_matricula_id)`.
- Busca `freq_min = selecao.turmas.frequencia_minima_percentual` da
  turma.
- Decide o status:
  - Se `media >= 6.0 AND freq >= freq_min` → `concluida`.
  - Senão → `reprovada`, com motivo texto descrevendo o que falhou
    (ex.: "Média 5.4 abaixo do mínimo 6.0", "Frequência 65% abaixo do
    mínimo 75%", "Média 5.0 e frequência 60% ambas abaixo do mínimo").
- Atualiza a matrícula: `status`, `motivo_conclusao`, `encerrada_em`,
  `encerrada_por`.

`security invoker` (respeita RLS de quem chamou).

**Função `diario.desfazer_encerramento(p_matricula_id uuid) returns void`:**

Só coordenação pode chamar (verifica via
`identidade.usuario_e_coordenacao()`). Reverte a matrícula de
`concluida`/`reprovada` de volta para `matriculada`, limpa
`motivo_conclusao`, `encerrada_em`, `encerrada_por`. Útil para corrigir
erro do professor.

### 4. Migration: RLS do `diario`

Nova migration:

```bash
supabase migration new rls_diario
```

**`diario.avaliacoes`:**

- `SELECT`: aluno vê avaliações da própria turma matriculada; professor
  vê das próprias turmas; coordenação vê todas.
- `INSERT`, `UPDATE`, `DELETE`: apenas o professor da turma ou
  coordenação.

**`diario.notas`:**

- `SELECT`: aluno vê apenas as próprias notas; professor vê da própria
  turma; coordenação vê todas.
- `INSERT`, `UPDATE`, `DELETE`: apenas o professor da turma ou
  coordenação. Os triggers do passo 3 barram alterações se a matrícula
  estiver encerrada.

**`diario.aulas`:**

- `SELECT`: aluno vê aulas da própria turma; professor vê das próprias
  turmas; coordenação vê todas.
- `INSERT`, `UPDATE`, `DELETE`: apenas o professor da turma ou
  coordenação.

**`diario.presencas`:**

- `SELECT`: aluno vê apenas as próprias presenças; professor vê da
  própria turma; coordenação vê todas.
- `INSERT`, `UPDATE`, `DELETE`: apenas o professor da turma ou
  coordenação. Também barrado pós-encerramento pelo trigger.

### 5. Aplicar migrations e regerar tipos

```bash
supabase db push
supabase gen types typescript --linked > packages/types/src/database.ts
```

Adicionar ao `packages/types/src/index.ts` os tipos de MS4:

```ts
export type Avaliacao = Database['diario']['Tables']['avaliacoes']['Row']
export type Nota = Database['diario']['Tables']['notas']['Row']
export type Aula = Database['diario']['Tables']['aulas']['Row']
export type Presenca = Database['diario']['Tables']['presencas']['Row']
```

### 6. Frontend: telas do professor

**`/professor/turmas/:id`** (já existe do MS3, mas era só leitura):

Reformular para incluir as abas do diário. Layout sugerido (adapte pelo
que o SVG mostra):

- **Aba "Avaliações":** lista as avaliações da turma. Botão "Nova
  avaliação" cria uma nova (título, descrição, peso, ordem). Cada
  avaliação tem link para a tela de lançamento de notas.
- **Aba "Aulas":** lista as aulas da turma em ordem cronológica. Botão
  "Nova aula" (data, horário, descrição). Cada aula tem botão "Fazer
  chamada".
- **Aba "Alunos":** lista os alunos matriculados. Para cada um, mostra
  média parcial, frequência parcial, e status atual. Botão "Encerrar
  módulo" ao lado de cada aluno, desabilitado se
  `diario.pronto_para_encerrar` retornar false, com tooltip explicando
  o que falta.

**`/professor/turmas/:id/avaliacoes/:avaliacao_id`:**

Tela de lançamento de notas em bloco. Lista todos os alunos matriculados
com um campo numérico para a nota. Botão "Salvar todas as notas" faz
upsert em lote. Salvar mostra feedback inline conforme padrão.

**`/professor/turmas/:id/aulas/:aula_id/chamada`:**

Tela de chamada. Lista todos os alunos matriculados com um toggle
presente/ausente para cada. Botão "Salvar chamada" faz upsert em lote.

### 7. Frontend: telas do aluno

**`/aluno/matriculas/:id`** (nova):

Boletim do módulo. Mostra:

- Cabeçalho: nome do módulo, trilha, professor, período.
- Seção "Notas": lista de avaliações com nota do aluno (ou "pendente"
  se ainda não lançada). Média parcial calculada.
- Seção "Frequência": lista de aulas com presença/ausência, ou "chamada
  não feita" para aulas sem registro. Percentual de frequência parcial.
- Status atual da matrícula (`matriculada` = "cursando",
  `concluida` = "aprovado", `reprovada` = "reprovado" com motivo).

**Realtime:** essa tela deve assinar mudanças em `diario.notas` e
`diario.presencas` filtradas por essa matrícula. Quando o professor
lançar algo novo, a tela atualiza sozinha. Também assine mudanças em
`selecao.matriculas` (a mesma matrícula) para que quando o professor
encerrar, o aluno veja o resultado na hora.

Padrão do canal:

```ts
supabase
  .channel(`matricula:${matriculaId}`)
  .on('postgres_changes', { event: '*', schema: 'diario', table: 'notas', filter: `matricula_id=eq.${matriculaId}` }, handler)
  .on('postgres_changes', { event: '*', schema: 'diario', table: 'presencas', filter: `matricula_id=eq.${matriculaId}` }, handler)
  .on('postgres_changes', { event: '*', schema: 'selecao', table: 'matriculas', filter: `id=eq.${matriculaId}` }, handler)
  .subscribe()
```

Testa que o canal fecha corretamente no `useEffect` cleanup (não deixa
zombie subscriptions).

**`/aluno/matriculas`** (já existe do MS3):

Adicionar coluna de progresso parcial (média e frequência) em cada
matrícula. Para status `concluida` e `reprovada`, mostrar resultado
final.

### 8. Frontend: telas da coordenação

Coordenação já vê matrículas via MS3. Adicionar:

**`/coordenacao/turmas/:id`** (já existe):

Nova seção "Diário": vê lista de avaliações, aulas, e status atual de
cada aluno (média, frequência, status). Não edita — só consulta.

**`/coordenacao/matriculas/:id/desfazer`:**

Uma ação (não precisa ser tela cheia, pode ser modal em cima de
`/coordenacao/turmas/:id`): "Desfazer encerramento". Confirma com
motivo textual e chama `diario.desfazer_encerramento`. Auditoria fica
registrada.

### 9. Seeds

Adicionar aos seeds atuais dados de MS4. Não apague o que existe.

Para a matrícula do `aluno.teste` que já está com status `concluida` no
seed (adicionada no MS3 para testar pré-requisitos):

- Crie 3 avaliações fictícias para a turma correspondente (por exemplo:
  "Prova 1", peso 2; "Trabalho", peso 3; "Prova Final", peso 5).
- Lance notas plausíveis que resultem em média ≥ 6 (para bater com o
  status `concluida`).
- Crie 10 aulas com datas passadas.
- Marque presença em 9 delas (90% de frequência, acima dos 75%).
- Preencha `motivo_conclusao` com "Aprovado por média e frequência".

Para uma das turmas ativas (matrícula com status `matriculada`):

- Crie 2-3 avaliações da turma, sem notas ainda (professor vai lançar
  no teste).
- Crie 3-4 aulas com datas próximas, sem chamada (professor vai fazer
  no teste).

Aplica com `db reset --linked` (cuidado, apaga tudo antes) ou aplica só
o novo seed manualmente — o que fizer mais sentido no fluxo já
estabelecido do projeto.

### 10. Validação end-to-end

Rode `pnpm dev` e valide, na ordem:

**Como professor (`professor.teste`):**

1. Vai em `/professor/turmas`, entra numa turma com matriculados.
2. Aba Avaliações: cria "Prova 1" (peso 4), "Trabalho" (peso 6).
3. Aba Aulas: cria 5 aulas com datas passadas.
4. Faz chamada em 4 aulas para o aluno (presente em 4, ausente em 1
   propositalmente).
5. Lança nota 7 em Prova 1, nota 8 em Trabalho para o aluno.
6. Aba Alunos: vê média parcial ≈ 7.6, frequência 80%, botão "Encerrar
   módulo" habilitado.
7. Encerra → status vira `concluida`, motivo "Aprovado".
8. Cria outra situação: lança nota 3 em Prova 1 para outro aluno →
   tenta encerrar → falha porque falta lançar Trabalho para ele.
9. Lança nota 4 em Trabalho → encerra → status vira `reprovada`,
   motivo cita a média baixa.

**Como aluno (`aluno.teste`, na mesma turma):**

1. Vai em `/aluno/matriculas/:id`.
2. **Mantém a aba aberta.** Numa outra aba, loga como professor e
   lança uma nota nova ou faz uma chamada.
3. Volta para a aba do aluno — a tela deve ter atualizado sozinha, sem
   refresh. Se não atualizou, o Realtime não está funcionando; corrija.
4. Depois do encerramento, aluno vê status final e motivo.

**Como coordenação:**

1. Vai numa matrícula encerrada, clica "Desfazer encerramento", confirma.
2. Volta para `matriculada`, professor pode editar de novo.
3. Tenta encerrar como coordenação (via chamada direta na função? ou
   deve ser bloqueado?) — decida se coordenação pode encerrar em nome
   do professor ou só desfazer. **Recomendo: só desfazer.** Encerrar
   é ato pedagógico do professor.

Verifique que RLS bloqueia acessos indevidos: aluno tentando ver nota
de outro aluno via URL manipulada, professor tentando ver turma que
não é dele, etc.

### 11. Typecheck e build

```bash
pnpm typecheck
pnpm build
```

Ambos limpos.

## Regras que valem para tudo

Reafirmando o `CLAUDE.md`:

- Vocabulário: "módulo" e "bounded context", nunca "microsserviço".
- Nada de Docker, orquestrador, n8n (o desvio já está registrado —
  não tente adicionar sincronização com Moodle mesmo que o artigo cite).
- Frontend fala direto com o Supabase para leitura, escrita e Realtime.
  Nada de Worker no meio para essas operações.
- RLS habilitada em toda tabela nova.
- Invariantes no banco (`check`, trigger). Regra de processo (encerrar,
  desfazer, calcular média) em função Postgres nomeada.
- Idempotência nas migrations.
- Identificadores de domínio em português; termos técnicos em inglês;
  comentários em português explicando o porquê.
- Padrão de UX: botão voltar em telas internas, "Salvar" e "Salvar e
  voltar" nos formulários, feedback inline. Formulários de lançamento
  em bloco (notas, chamada) podem ter só "Salvar" — não faz sentido
  "voltar" numa listagem.

## Ao terminar, me entregue

1. **O que você extraiu dos SVGs** no passo 1 (layout das telas,
   contradições com o prompt se houver, decisões que precisou fazer).
2. **Resumo do que foi criado**, por caminho: migrations, tipos,
   telas.
3. **Tabela de RLS** — o que cada papel pode fazer com avaliações,
   notas, aulas, presenças.
4. **Confirmação da validação end-to-end** com as três contas,
   principalmente do Realtime funcionando.
5. **Ambiguidades ou decisões que você tomou sozinho.**
6. `pnpm typecheck` e `pnpm build` limpos, CI verde.
7. Commits por bloco lógico. Sugestão:
   - "MS4: schema diario, avaliacoes, notas, aulas, presencas"
   - "MS4: triggers de validacao e funcoes de calculo"
   - "MS4: RLS de diario por papel"
   - "MS4: telas do professor (avaliacoes, chamada, encerramento)"
   - "MS4: boletim do aluno com Realtime"
   - "MS4: visao da coordenacao e acao de desfazer encerramento"
   - "MS4: seeds com dados historicos e turmas em andamento"

Pare no MS4. Aguarde o próximo prompt para MS5 (Certificação).
