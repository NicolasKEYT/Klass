# Klass

ERP educacional open source para automação da jornada acadêmica.
Trabalho de Conclusão de Curso — Faculdade de Computação e Informática,
Universidade Presbiteriana Mackenzie.

**Equipe:** Gabriel Neman Silva, Nicolas Gonçalves, Erik Salomão Almeida,
Ricardo Carvalho Paixão Brandão.
**Orientação:** Prof. MSc. Thiago Graziani Traue.
**Repositório:** https://github.com/NicolasKEYT/Klass
**Licença:** Apache License 2.0 (`LICENSE`, `NOTICE`; campo `license` nos `package.json`).

---

## O que este projeto é

Uma plataforma que cobre o ciclo completo do aluno — da inscrição em uma
trilha até a emissão do certificado em PDF — substituindo planilhas e
processos manuais em instituições de ensino de pequeno e médio porte.

O trabalho tem base acadêmica: existe um artigo aprovado no TCC 1 que
define os fundamentos (DDD, arquitetura orientada a eventos, BaaS,
segurança por RLS/JWT/RBAC, certificação nativa). Esse artigo é a **fonte
de verdade** do projeto. Ver "Fidelidade ao artigo" antes de decidir
qualquer coisa de arquitetura.

O artigo do TCC 2 (versão atualizada de 29/10/2026) descreve o sistema
**como foi implementado**, com os desvios em relação ao TCC 1 e as
limitações assumidas. Ele cita fatos que mudam com o código (contagem de
migrations, paleta e contrastes, modos de certificação, como cada camada é
publicada); ver "Artigo do TCC 2" ao final.

## Arquitetura

**Monólito modular sobre BaaS.** O Supabase é o núcleo do sistema:
persistência, autenticação, regras de acesso, tempo real e a maior parte da
lógica, que vive perto do dado como funções e triggers do Postgres. Os
cinco bounded contexts do domínio existem como schemas isolados nesse
banco.

Não é uma arquitetura de microsserviços distribuídos. O vocabulário do
projeto reflete isso: escreva **"módulo"** ou **"bounded context"**, nunca
"microsserviço". Os cinco contextos compartilham o mesmo banco e fazem
deploy juntos — o que os separa são fronteiras de schema e de código, não
de infraestrutura.

Os **Cloudflare Workers não são um backend na frente do Supabase.** Eles
existem só para o que o Supabase não faz sozinho: enviar e-mail, receber
webhooks, rodar tarefas agendadas, gerar o PDF do certificado. O frontend
fala direto com o Supabase para tudo que é dado de domínio — é o que o
BaaS oferece e o que o artigo defende.

### Os cinco bounded contexts

| Sigla | Contexto | Schema | Responsabilidade |
| --- | --- | --- | --- |
| MS1 | Identidade e Acesso | `identidade` | Perfis, RBAC, autorização |
| MS2 | Catálogo Curricular | `catalogo` | Trilhas, cursos, módulos, pré-requisitos |
| MS3 | Motor de Seleção | `selecao` | Inscrição, validação de pré-requisitos, matrícula |
| MS4 | Diário de Classe | `diario` | Notas, frequência, progresso |
| MS5 | Certificação | `certificacao` | Emissão do certificado em PDF |

A sigla `MS` vem do artigo e é mantida por rastreabilidade, mas significa
**módulo**, não microsserviço.

Um contexto não lê tabela de outro diretamente. Quando precisa de dado
alheio, chama uma função nomeada do schema dono daquele dado. A
comunicação entre contextos é por evento (trigger no banco; quando a
reação sai do banco, chamada HTTP via `pg_net`), não por acoplamento de
tabela.

### Stack

| Camada | Tecnologia | Papel |
| --- | --- | --- |
| Frontend | React + TypeScript, em **Cloudflare Pages** | Interface das três personas |
| Núcleo | **Supabase** | Postgres, Auth, RLS, PostgREST, Realtime, Storage, lógica em funções/triggers |
| Integrações | **Cloudflare Workers** (TypeScript) | E-mail, webhooks, cron, geração de PDF |
| E-mail transacional | **Resend** | Confirmações e avisos de status |
| Repositório e CI | **GitHub** (CI: `typecheck` + `build`) → o push na `main` publica só o frontend (Pages); Worker e migrations são manuais (ver "Operação e publicação") | |

### Onde cada coisa vive

Esta é a regra mais importante do projeto. Antes de escrever qualquer
funcionalidade, decida onde ela mora por esta tabela.

| Necessidade | Onde vive | Como |
| --- | --- | --- |
| Ler/criar/editar trilha, turma, docente, aluno, inscrição | **Supabase, direto do frontend** | PostgREST + RLS |
| Login, cadastro, sessão | **Supabase Auth, direto do frontend** | SDK do Supabase |
| Tela reage a uma nota nova sem recarregar | **Supabase Realtime, direto do frontend** | Assinatura WebSocket |
| Invariante do dado (nota na faixa, matrícula única, vaga ≥ 0) | **Supabase** | `check` constraint, trigger |
| Validar pré-requisitos antes de matricular | **Supabase** | Função Postgres (RPC), chamada do frontend |
| Calcular progresso, frequência, taxa de aprovação | **Supabase** | Função ou view |
| Relatórios e BI em modo leitura | **Supabase** | View / Materialized View |
| Enviar e-mail transacional | **Worker** | Recebe a chamada HTTP do trigger (`pg_net`), chama Resend |
| Reagir a evento fora do banco | **Worker** | Endpoint que recebe a chamada do trigger (hoje: `/webhooks/inscricao-recebida`, `/webhooks/matricula-deferida` e `/webhooks/certificado-emitido`) |
| Tarefa agendada | **Worker** | Cron trigger (declarado, **nenhuma tarefa implementada**) |
| Arquivos (materiais da turma) | **Supabase Storage, direto do frontend** | Bucket privado `materiais` + políticas por turma |
| Gerar o PDF do certificado | **Frontend** (react-pdf) | Ver seção Certificação |

**Regra de ouro:** se o Supabase resolve — com PostgREST, RLS, função,
view ou trigger —, resolva no Supabase. Só use um Worker quando a tarefa
sai do banco (mandar e-mail, falar com serviço externo, gerar arquivo,
rodar no horário). Não crie no Worker uma rota que apenas repassa uma
chamada ao Supabase; isso é código a mais sem ganho, e contradiz o modelo
BaaS do artigo.

### Comunicação entre contextos

Coreografia orientada a eventos, como o artigo define. Triggers nativos do
PostgreSQL detectam mudanças de estado relevantes. Quando a reação é dentro
do banco, o próprio trigger resolve (por exemplo, `matriculas_emitir_certificado`
cria o certificado quando a matrícula é concluída). Quando a reação sai do
banco, o trigger faz uma chamada HTTP com `net.http_post` (extensão `pg_net`)
a um Worker.

**Desvio do artigo do TCC 1:** o artigo fala em Database Webhooks do
painel do Supabase. Neste projeto o schema interno `supabase_functions`
nunca foi provisionado e o recurso falha, então o mesmo padrão
(trigger → HTTP → Worker) é feito por triggers próprios, versionados em
migration (`20260917001912_webhooks_via_pg_net.sql`). Hoje há três:
`matriculas_notifica_inscricao` (matrícula criada como `inscrita`, migration
`20261124120000_webhook_inscricao_recebida.sql`),
`matriculas_notifica_deferimento` (matrícula passa de `inscrita` para
`matriculada`) e `certificados_notifica_emissao` (certificado inserido). A
chamada leva `Authorization: Bearer <segredo>`, lido do Supabase Vault
(nome `webhook_secret`, mesmo valor do `WEBHOOK_SECRET` do Worker). A URL base do
Worker, sem barra final, também vem do Vault (`webhook_url`; cada função monta
`<webhook_url>/webhooks/<rota>`); sem ela os triggers não chamam nada. O
segredo nunca entra em migration.

Os e-mails do aluno são quatro: a confirmação de cadastro (enviada pelo
Supabase Auth, com SMTP do Resend e o modelo de
`supabase/templates/confirmacao-cadastro.html`, que no projeto hospedado fica
colado no painel) e os três acima, enviados pelo Worker. A rejeição de
matrícula não envia e-mail.

Limites conhecidos: a chamada `pg_net` é assíncrona e **não é reenviada**;
se o Worker ou o Resend falharem, o e-mail pode se perder. Os pontos de
integração do Worker são só esses três. Ao criar um webhook novo, publique o
Worker com a rota antes da migration que cria o trigger; senão as chamadas do
intervalo caem numa rota inexistente e se perdem.

O frontend recebe atualizações em tempo real via Supabase Realtime, sem
polling.

Não há orquestrador. Não há fila externa. Não há mensageria.

### Segurança

- A **anon key** do Supabase é pública por design e vai no frontend. Quem
  protege os dados é a RLS. Uma tabela sem policy não é lida por ninguém
  via PostgREST — esse é o padrão seguro, e toda tabela nova nasce com RLS
  habilitada.
- A **service role key** ignora a RLS e **nunca** entra no frontend. Ela
  vive apenas nas variáveis de ambiente dos Workers, e só é usada em
  operações sem usuário na ponta (webhooks, cron).
- A **API key do Resend** vive apenas nos Workers.
- A autorização por papel (RBAC) é aplicada pela RLS, a partir do papel no
  JWT do usuário. É a garantia final e fica no banco, não no cliente.
- Funções `SECURITY DEFINER` (que ignoram a RLS) **verificam quem as
  chama** e não são executáveis por `anon`; as de emissão e revogação de
  certificado e os cálculos internos (`diario.calcular_*`) ficam fechadas à
  API. O status final da matrícula (`concluida`/`reprovada`) só é definido
  pelo encerramento do diário, nunca por UPDATE direto do professor.
- O `service_role` das integrações tem permissão de leitura nos schemas de
  domínio (migration `20260917002613`); sem ela a integração falha em
  silêncio.
- O webhook do banco para o Worker é autenticado por segredo no Vault (ver
  "Comunicação entre contextos").

## Fidelidade ao artigo

O artigo do TCC 1 define o funcionamento do sistema. **Mantenha o que ele
estabelece.** Quando algo precisar mudar por causa do stack atual,
sinalize o desvio em comentário ou no PR — cada desvio precisa ser
justificado na redação final do TCC 2. O artigo pode ser reescrito, mas
nenhuma mudança de arquitetura entra em silêncio: ela é registrada aqui
primeiro.

### O que o artigo estabelece e deve ser mantido

- Cinco bounded contexts derivados do domínio educacional via DDD.
- **BaaS via Supabase:** o PostgREST elimina a codificação manual de rotas
  CRUD. O frontend consome o banco diretamente; não há backend intermediário
  para operações de domínio.
- Arquitetura orientada a eventos: triggers do PostgreSQL detectam
  mudanças relevantes e disparam a chamada ao Worker (no artigo, "Database
  Webhooks"; na implementação, `pg_net` — ver desvio abaixo).
- Segurança por **RLS + JWT + RBAC**, configurada desde o início.
- Realtime via WebSockets para atualizar a interface sem polling —
  especificamente, a tela do aluno reage instantaneamente a uma nota nova.
- Views e Materialized Views no Postgres para relatórios e BI em modo
  leitura (o artigo cita `vw_taxa_evasao` e `vw_desempenho_por_trilha`).
- Modelagem de dados em três níveis (conceitual, lógico, físico),
  minimizando redundância e garantindo integridade referencial.
- Três personas: **Aluno**, **Professor**, **Gestor** (coordenação).
- Certificado gerado nativamente em PDF, **sem** plataformas externas de
  credenciamento (Canvas Credentials, Badgr, Open Badges). Essas
  ferramentas aparecem apenas na fundamentação teórica, nunca na
  implementação.
- Verificação automática de pré-requisitos no momento da inscrição.
- Caráter standalone: o núcleo funciona sem depender de ferramenta
  externa.

### Desvios já decididos

Intencionais e acordados. Não reverta.

| Artigo | Projeto atual | Motivo |
| --- | --- | --- |
| n8n como middleware ETL e e-mail | **Cloudflare Workers + Resend** | O papel de e-mail transacional e integração externa passa para Workers; n8n descartado |
| Vocabulário "microsserviços" | **Monólito modular** | Os contextos compartilham banco e deploy; a nomenclatura anterior não descrevia o sistema com precisão |
| Hospedagem não especificada | **Cloudflare Pages + Workers** | Adição, não conflito |
| Database Webhooks do painel do Supabase | **Triggers com `pg_net` + segredo no Vault** | O schema `supabase_functions` nunca foi provisionado neste projeto; mesmo padrão (trigger → HTTP → Worker), versionado em migration |
| MS5 gera PDF no cliente (react-pdf) | **Cliente (react-pdf), como no artigo** | Decidido: o registro do certificado nasce no banco; o PDF é renderizado no navegador ao baixar. Não há geração no Worker |

### Coisas que NÃO existem neste projeto

Não introduza nenhuma delas, mesmo que pareçam melhorias:

- Docker, containers, `docker-compose`, Dockerfile **no produto** (a CLI do
  Supabase precisa de um runtime de containers só para o banco local de
  desenvolvimento; ver "Banco local" no README)
- Orquestrador de workflow (Camunda, Temporal, implementação própria)
- n8n
- Microsserviços distribuídos, mensageria, filas
- Kubernetes ou qualquer orquestração de containers
- Uma camada de API/backend em Workers na frente do Supabase para CRUD
- Autenticação própria (o Supabase Auth já resolve)
- Plataformas externas de credenciamento no fluxo de certificação

## Personas

| Persona | Papel | O que faz |
| --- | --- | --- |
| **Aluno** | `aluno` | Explora o catálogo, se inscreve, acompanha notas e frequência, baixa o certificado |
| **Professor** | `professor` | Gerencia suas turmas, lança notas e presença |
| **Gestor** | `coordenacao` | Administra trilhas, turmas, corpo docente e base de alunos |

A RLS garante que cada perfil acesse apenas o que lhe cabe: aluno vê
apenas os próprios registros, professor vê apenas as turmas que leciona,
coordenação vê tudo da instituição.

## Certificação (MS5)

Decidido: o PDF é gerado **no cliente**, com react-pdf, como o artigo
especifica. Não há geração no Worker. O certificado é gerado **pelo próprio
sistema**, sem plataforma externa de credenciamento (o Klass não implementa
Open Badges nem ELM).

Como funciona hoje:

- O **registro** do certificado é criado no banco, por trigger
  (`matriculas_emitir_certificado`), quando a matrícula é concluída. O PDF é
  renderizado no navegador quando o aluno o baixa. A emissão não é
  executável por usuário pela API; só o caminho controlado pelo banco.
- O tipo de certificação é configurado por **trilha**
  (`catalogo.tipo_certificacao`): `modulo`, `trilha` ou `modulo_e_trilha`
  (os dois; o da trilha só quando todos os módulos fecham).
- Cada certificado tem **código único** consultável publicamente, sem
  login (`certificacao.verificar_por_hash`, tela `/verificar/<código>`).
- **Revogação:** desfazer um encerramento (ou reativar a turma) exige motivo,
  revoga os certificados da matrícula e fica em `diario.historico_encerramentos`.
  A verificação pública informa o certificado revogado. As unicidades
  (aluno × módulo, aluno × trilha) contam só os não revogados.
- A inserção de um certificado dispara o e-mail de emissão (Worker).

## Convenções de código

- **TypeScript** em todo o projeto — frontend e Workers. Os tipos de
  domínio ficam em um pacote compartilhado, organizados pelos cinco
  bounded contexts, e são a fonte única de verdade sobre a forma dos
  dados.
- **Idioma:** identificadores de domínio em português (`matricula`,
  `turma`, `aluno`, `frequencia`), acompanhando a linguagem ubíqua do DDD.
  Termos técnicos consagrados ficam em inglês (`handler`, `client`,
  `middleware`). Comentários e documentação em português.
- **Comentários** explicam o porquê, não o quê. Documente decisões não
  óbvias e restrições do domínio; não narre o que o código já diz.
- **Tipos gerados do banco:** rode `supabase gen types typescript` e use
  os tipos gerados no cliente Supabase, para que errar o nome de uma
  coluna vire erro de compilação em vez de bug em produção.
- **Leitura de dados pelo cache (TanStack Query).** As telas leem pelos
  hooks de `apps/web/src/lib/consultas/` (um arquivo por bounded context),
  que embrulham as funções de `lib/` — estas continuam sendo a única camada
  que chama o Supabase. Chaves só em `consultas/chaves.ts`, dependendo de
  ids (nunca do objeto `usuario`). Toda gravação passa por `useGravacao` e
  invalida o que mudou (`consultas/invalidar.ts`); eventos do Realtime
  invalidam o cache em vez de recarregar a tela. Não é desvio do artigo: o
  frontend segue falando direto com o Supabase, o cache só evita repetir
  a mesma leitura a cada troca de tela. As assinaturas do Realtime ficam em
  `consultas/realtime.ts` (aluno, turma, professor).
- **Tema claro/escuro.** Cores são variáveis CSS em `apps/web/src/index.css`
  (`:root` e `:root[data-tema="escuro"]`), expostas como tokens em
  `tailwind.config.ts`. Tela nenhuma usa cor literal; cor nova entra nos
  dois temas.
- **Datas e números em pt-BR** só por `apps/web/src/lib/formato.ts`
  (datas do banco são locais, sem fuso — use `paraDataLocal`), e campo de
  data pelo `components/CampoData.tsx`.
- **Prazo da chamada:** o professor faz/altera a chamada até 7 dias depois
  da aula; depois, só com liberação da coordenação. É trigger no banco
  (`diario`), com "hoje" de `diario.hoje()` no fuso da instituição.
- **Materiais** ficam no bucket `materiais` do Storage; o registro em
  `diario.materiais` só entra se o objeto existe. Ao apagar, sai primeiro o
  arquivo e depois o registro.
- **Banco local:** ver "Banco local" no README (`supabase start`, `db reset`
  com o seed de demonstração). Teste nunca no Supabase hospedado (rodadas
  simultâneas de teste já contaminaram dados de produção).
- **Testes automatizados** rodam só no banco local e estão no repositório:
  testes SQL em pgTAP (`supabase/tests/database/`, 279 asserções em 9
  arquivos, `supabase test db`) que assumem os papéis `authenticated` e
  `anon` com `request.jwt.claims` forjadas, cada arquivo dentro de
  `begin … rollback`, e 4 roteiros Playwright (`apps/web/e2e/`, 5 casos,
  `apps/web/e2e/rodar.sh`) para os fluxos da interface. O Worker tem 9
  testes Vitest (`apps/workers/test/`, `pnpm --filter @klass/workers test`),
  em Node e sem rede, para a autorização, o 400, o caminho feliz e o 500 dos
  webhooks (`autorizarWebhook` em `shared/webhook.ts`). Regra nova ou
  alterada no banco ganha asserção no arquivo do contexto; ao mudar um número
  aqui, atualize o artigo. Não há testes de carga nem avaliação de
  usabilidade com usuários externos, e a cobertura não é medida.

- **Relatórios da coordenação** (Exports e Indicadores). As funções
  `*.relatorio_*` (migration `20261010120000`) são só da coordenação: quem
  não é recebe erro `42501`, não lista vazia. Nenhum export traz CPF nem dado
  sensível; o único dado pessoal além do nome é o e-mail do aluno. Filtros
  (período, trilha) vivem na URL (`lib/filtroRelatorio.ts`) e são os mesmos
  nas duas telas. O XLSX é gerado sob demanda (`import()` dinâmico de
  `write-excel-file` em `lib/csv.ts`), fora do carregamento inicial. Mesmo nome,
  mesma regra do Início: frequência média é só de quem está cursando e ocupação é
  matriculadas sobre vagas; outro escopo tem nome próprio
  (`frequencia_media_encerradas`, `frequencia_media_matriculas`,
  `ocupacao_acumulada_percentual`).
- **Menu da coordenação tem 5 itens** (regra D3 do UI Kit: Início, Turmas,
  Trilhas, Pessoas, Certificados). Tela nova da coordenação não ganha item de
  menu: entra por botão do Início. **Acompanhamento é a tela única de gráficos**
  (`/coordenacao/acompanhamento`): panorama D11 (sem filtro) e "Relatório do
  período" (`RelatorioDoPeriodo.tsx`, filtros na URL, só gráficos que o panorama
  não tem). `/coordenacao/indicadores` só redireciona para ele. Gráficos de
  `components/graficos/` são SVG/HTML próprio, com tabela alternativa e CSV;
  rótulo de barra vai em até duas linhas, com o nome completo no `title`.

### Onde a regra de negócio mora

Regra que precisa ser sempre verdadeira, independentemente de quem chama,
vive **no banco** como `check` constraint ou trigger: nota dentro da faixa
válida, matrícula não duplicada, vaga nunca negativa. Hoje também estão no
banco: inscrição recusada em turma com período encerrado; pré-requisito de
módulo (inclusive de outra trilha, com checagem de ciclo); média mínima por
trilha e frequência mínima (padrão de 75% na trilha, herdada pela turma);
encerramento que exige diário completo; trava de edição de nota e presença
após o encerramento; prazo da chamada.

Lógica de domínio que consulta e decide — validar pré-requisitos contra o
histórico, calcular progresso — vive **no banco como função** (RPC),
chamada diretamente pelo frontend. Fica perto do dado, roda numa
transação, e não precisa de servidor intermediário.

Só sai do banco o que o banco não faz: e-mail, arquivos, agendamento,
serviços externos — e isso vive nos **Workers**.

Validação no frontend é conveniência para o usuário. A garantia é do banco.

## Design

O design system vem dos arquivos SVG fornecidos pela equipe (exportados do
Figma). Extraia os tokens — cores, espaçamentos, tipografia, raios,
gradientes — diretamente desses arquivos. Não estime valores a olho e não
invente cores novas; se precisar de um tom que não existe no design, volte
ao SVG de origem.

Centralize os tokens na configuração do Tailwind, para que nenhuma tela
use valor literal espalhado.

## Estrutura do repositório

```
apps/
  web/                  Frontend React + TypeScript (Cloudflare Pages)
  workers/              Cloudflare Workers em TypeScript (integrações)
    src/
      email/            Envio via Resend
      webhooks/         Recebedores das chamadas HTTP dos triggers (pg_net)
      cron/             Tarefas agendadas (ainda sem nenhuma tarefa)
      shared/           Cliente Supabase (service key), utilitários
packages/
  types/                Tipos de domínio compartilhados entre web e workers
supabase/
  migrations/           Schemas dos cinco contextos, RLS, funções, triggers, views
  seed.sql              Dados de demonstração (só no banco local)
docs/, diagramas/       Wireframes, UI Kit e diagramas (caso de uso, classe, sequência)
```

## Operação e publicação

Cada camada é publicada de um jeito; só o frontend é automático.

- **Frontend (Cloudflare Pages):** o push na `main` publica. O CI do GitHub
  só roda `pnpm typecheck` e `pnpm build`. Commit com `[skip ci]` no começo
  da mensagem não publica.
- **Migrations:** aplicadas à mão, por quem tem acesso ao projeto hospedado,
  com `supabase db push` (antes, `--dry-run` e conferência de que só aparecem
  as pendentes esperadas). Antes de aplicar, backup dos cinco schemas com
  `pg_dump` (schema e dados), guardado **fora do repositório**. As migrations
  vão **antes** do frontend que depende delas; o inverso quebra telas. Estado
  em 25/11/2026: 51 migrations no repositório; as 50 primeiras estão aplicadas
  (a `20261124120000_webhook_inscricao_recebida` entrou em 24/11, com backup dos
  cinco schemas e `--dry-run` antes). A `20261125120000_webhook_url_no_vault` ainda
  **não** foi aplicada no hospedado e não exige frontend novo. **Antes do `db push`
  dela, rodar lá `select vault.create_secret('<URL do Worker>', 'webhook_url');`**,
  senão os 3 e-mails (inscrição recebida, matrícula deferida, certificado emitido)
  deixam de sair.
- **Worker (Cloudflare Workers):** `npx wrangler deploy` em `apps/workers`;
  não publica sozinho no push. Variáveis do Worker: service role, API key do
  Resend, `WEBHOOK_SECRET`, `EMAIL_REMETENTE` e `ALLOWED_ORIGIN` (origem do
  frontend, usada nos links dos e-mails; sem barra no final).
- **Domínio e e-mail (Resend):** o domínio `klass.digital` (registrado na
  Hostinger, DNS no Cloudflare, domínio personalizado do Pages) está
  verificado no Resend, com SPF, DKIM e DMARC (`p=none`). O remetente é
  `Klass <no-reply@klass.digital>`. Domínio novo, sem histórico de envio,
  pode cair no lixo eletrônico de alguns provedores no início.
- **Tipos:** depois de mudar o schema, regerar os tipos
  (`supabase gen types typescript`, ver README) e commitar.

## Artigo do TCC 2

A versão atualizada do artigo (29/10/2026) afirma coisas que dependem do
estado do código. **Ao mudar qualquer uma, atualize o artigo:**

- contagem de migrations (51; a última ainda não aplicada no hospedado) e o fluxo "migrations manuais com backup";
- paleta e contrastes (tema claro: texto secundário `#61635C`, discreto
  `#6D6F68`; só o discreto sobre `#E3E4DE` fica abaixo de 4,5:1, em 4,0:1),
  tema escuro, sombras só em modal e dica de gráfico, alvo de toque de 48 px
  no celular e 40 px no computador;
- os três modos de certificação, a revogação e o histórico de encerramentos;
- a publicação (Pages automático; Worker e migrations manuais);
- `pg_net` no lugar de Database Webhooks, com segredo no Vault e sem
  reenvio, e os três pontos de integração (inscrição recebida, matrícula
  deferida, certificado emitido), mais o e-mail de confirmação de cadastro do
  Supabase Auth;
- Storage (`materiais`), views de acompanhamento (`vw_desempenho_por_trilha`,
  `vw_taxa_evasao`) e cache TanStack Query;
- a licença (Apache-2.0), citada em 2.8 e 4.6, com a referência da Apache Software Foundation;
- contagem de testes (279 asserções SQL em 9 arquivos; 4 roteiros Playwright,
  5 casos) e a forma de rodá-los;
- relatórios da coordenação: exports em CSV e XLSX (`write-excel-file`,
  carregado sob demanda), relatório do período no Acompanhamento e as funções
  `*.relatorio_*`, só da coordenação (erro `42501` para os demais), sem CPF nos
  exports; o menu da coordenação continua com 5 itens.

Limitações que o artigo assume, e que o código não deve contradizer em
silêncio: sistema monolocatário; sem testes de carga; sem avaliação de
usabilidade com usuários externos; sem avaliação de conformidade com ISO/IEC
27001 nem LGPD; restauração do backup fora do Supabase não testada (o dump
não inclui Auth nem Storage); decisão D7 do UI Kit (publicar notas após
revisão) não implementada; cron sem tarefas; sem e-mail para matrícula
rejeitada; cadastro aberto (qualquer pessoa cria conta de aluno; não há
convite nem vínculo do aluno com uma instituição além da própria instalação).

## Como trabalhar neste projeto

- **Regra de ouro:** se o Supabase resolve, resolva no Supabase. Worker só
  para o que sai do banco (e-mail, arquivo, cron, serviço externo).
- **Fronteiras de módulo são reais.** Um schema não lê tabela de outro
  diretamente; use função nomeada do dono. A comunicação entre contextos é
  por evento.
- **Toda tabela nasce com RLS habilitada.** Service key nunca no frontend.
- **Invariantes no banco:** `check`, constraint, trigger. Não replique no
  Worker o que o Postgres garante melhor.
- **Mudanças de schema são migrations versionadas**, nunca alteração
  manual no painel do Supabase.
- **Ao desviar do artigo, sinalize.** Um comentário curto com o motivo
  economiza horas na redação final do TCC 2.
- **Não aplique migration em produção nem rode `db push` sem o dono do
  projeto pedir**, e nunca imprima senha, chave ou connection string.
