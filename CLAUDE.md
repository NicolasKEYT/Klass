# Klass

ERP educacional open source para automação da jornada acadêmica.
Trabalho de Conclusão de Curso — Faculdade de Computação e Informática,
Universidade Presbiteriana Mackenzie.

**Equipe:** Gabriel Neman Silva, Nicolas Gonçalves, Erik Salomão Almeida,
Ricardo Carvalho Paixão Brandão.
**Orientação:** Prof. MSc. Thiago Graziani Traue.
**Repositório:** https://github.com/NicolasKEYT/Klass

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
comunicação entre contextos é por evento (trigger + Database Webhook), não
por acoplamento de tabela.

### Stack

| Camada | Tecnologia | Papel |
| --- | --- | --- |
| Frontend | React + TypeScript, em **Cloudflare Pages** | Interface das três personas |
| Núcleo | **Supabase** | Postgres, Auth, RLS, PostgREST, Realtime, Storage, lógica em funções/triggers |
| Integrações | **Cloudflare Workers** (TypeScript) | E-mail, webhooks, cron, geração de PDF |
| E-mail transacional | **Resend** | Confirmações e avisos de status |
| Repositório e CI | **GitHub** → deploy automático para Cloudflare | |

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
| Enviar e-mail transacional | **Worker** | Recebe webhook do Supabase, chama Resend |
| Reagir a evento fora do banco | **Worker** | Endpoint que recebe Database Webhook |
| Tarefa agendada | **Worker** | Cron trigger |
| Gerar o PDF do certificado | **Worker** ou frontend | Ver seção Certificação |

**Regra de ouro:** se o Supabase resolve — com PostgREST, RLS, função,
view ou trigger —, resolva no Supabase. Só use um Worker quando a tarefa
sai do banco (mandar e-mail, falar com serviço externo, gerar arquivo,
rodar no horário). Não crie no Worker uma rota que apenas repassa uma
chamada ao Supabase; isso é código a mais sem ganho, e contradiz o modelo
BaaS do artigo.

### Comunicação entre contextos

Coreografia orientada a eventos, como o artigo define. Triggers nativos do
PostgreSQL detectam mudanças de estado relevantes e disparam Database
Webhooks. Quando a reação é dentro do banco, o próprio trigger resolve.
Quando a reação sai do banco (um e-mail de confirmação de matrícula, por
exemplo), o webhook chama um Worker.

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
  mudanças relevantes e disparam Database Webhooks.
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
| MS5 gera PDF no cliente (react-pdf) | **A definir: cliente ou Worker** | Ver seção Certificação; decisão pendente, não é conflito |

### Coisas que NÃO existem neste projeto

Não introduza nenhuma delas, mesmo que pareçam melhorias:

- Docker, containers, `docker-compose`, Dockerfile
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

O artigo especifica geração do PDF no cliente, com react-pdf, disparada
quando o progresso do aluno atinge 100% (o Supabase avisa via Realtime, o
frontend libera a interface de conclusão). Esse é o comportamento padrão.

Com Cloudflare Workers disponível, existe a alternativa de gerar o PDF em
um Worker — mais robusto para certificados complexos e centraliza o
template no servidor. Qualquer que seja a escolha, o certificado é gerado
**pelo próprio sistema**, sem plataforma externa de credenciamento. A
decisão entre cliente e Worker fica para a fase de certificação; até lá,
siga o artigo (cliente).

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
  a mesma leitura a cada troca de tela.

### Onde a regra de negócio mora

Regra que precisa ser sempre verdadeira, independentemente de quem chama,
vive **no banco** como `check` constraint ou trigger: nota dentro da faixa
válida, matrícula não duplicada, vaga nunca negativa.

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
      email/            Envio via Resend, disparado por webhook
      webhooks/         Recebedores de Database Webhooks do Supabase
      cron/             Tarefas agendadas
      certificado/      Geração de PDF, se optar por gerar no Worker
      shared/           Cliente Supabase (service key), utilitários
packages/
  types/                Tipos de domínio compartilhados entre web e workers
supabase/
  migrations/           Schemas dos cinco contextos, RLS, funções, triggers, views
  seed/                 Dados de demonstração
```

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
