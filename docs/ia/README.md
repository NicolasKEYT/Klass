# Desenvolvimento assistido por IA: prompts do projeto

Esta pasta reúne os prompts numerados usados para construir o Klass com apoio
de IA generativa. Eles são o registro de **como o trabalho foi especificado**;
não são a documentação atual do sistema (para isso, veja o
[README](../../README.md) e o [`CLAUDE.md`](../../CLAUDE.md)).

## Como o processo funcionou

1. A **equipe** definiu a arquitetura, o escopo e as regras de negócio.
2. Um **assistente em conversa** apoiou o planejamento e a redação das
   especificações.
3. Cada especificação virou um **prompt numerado**, entregue a um **agente de
   código** (Claude Code), que executou as alterações no repositório.
4. A **equipe revisou cada entrega** antes do commit.

O que foi de fato alterado está no histórico de commits do repositório; três
commits citam o número do prompt na mensagem (Prompt 15 e Prompt 17).

## Índice

| Arquivo | Assunto (título original do prompt) |
| --- | --- |
| [prompt-01-bootstrap](prompts/prompt-01-bootstrap.md) | Bootstrap do repositório |
| [prompt-03-ms2-catalogo](prompts/prompt-03-ms2-catalogo.md) | MS2 Catálogo Curricular |
| [prompt-05-ms3-selecao](prompts/prompt-05-ms3-selecao.md) | MS3 Motor de Seleção |
| [prompt-06-ms4-diario](prompts/prompt-06-ms4-diario.md) | MS4 Diário de Classe |
| [prompt-07-deploy-cloudflare](prompts/prompt-07-deploy-cloudflare.md) | Deploy no Cloudflare (Workers + Pages) |
| [prompt-08-ms5-certificacao](prompts/prompt-08-ms5-certificacao.md) | MS5 Certificação |
| [prompt-09-ajustes-ux](prompts/prompt-09-ajustes-ux.md) | Ajustes de UX/UI e correções pós-teste |
| [prompt-10-reforma-visual](prompts/prompt-10-reforma-visual.md) | Reforma visual (flat / modern design) |
| [prompt-11-qa-regressao](prompts/prompt-11-qa-regressao.md) | QA de regressão completa (o título cita uma avaliação SUS, que não foi realizada) |
| [prompt-12-revisao-feedback](prompts/prompt-12-revisao-feedback.md) | Revisão completa do feedback original (segunda rodada) |
| [prompt-13-correcoes-coordenacao](prompts/prompt-13-correcoes-coordenacao.md) | Correções de coordenação (trilhas, turmas, formulários) |
| [prompt-14-certificacao-media-lote](prompts/prompt-14-certificacao-media-lote.md) | Certificação configurável, média mínima e encerramento em lote |
| [prompt-15-ajustes-professor](prompts/prompt-15-ajustes-professor.md) | Ajustes de fluxo do professor (aulas, notas, avaliações) |
| [prompt-16-uikit-reforma](prompts/prompt-16-uikit-reforma.md) | Reforma visual e de navegação (UI Kit) |
| [prompt-17-fidelidade-visual](prompts/prompt-17-fidelidade-visual.md) | Fidelidade visual estrita ao UI Kit (correção) |
| [prompt-setup-colaborador](prompts/prompt-setup-colaborador.md) | Configurar o ambiente local, para um colaborador novo |
| [checklist-testes](checklist-testes.md) | Checklist de testes manuais usado pela equipe |

## O que este registro não tem

- Os **prompts 02 e 04 não foram preservados**, então a numeração tem lacunas.
- As **respostas e os relatos de execução do agente não foram preservados**: só
  os prompts.
- Ele **não permite medir produtividade** nem atribuir à IA o ritmo do
  desenvolvimento. Registra apenas o que foi pedido.
- Algumas instruções ficaram **obsoletas** com a evolução do projeto. Por
  exemplo, o prompt 07 manda configurar Database Webhooks pelo painel do
  Supabase, e depois eles foram substituídos por triggers com `pg_net` (veja o
  README); e os testes passaram a rodar em banco local, não mais "em produção".

## Dados sensíveis

Os originais foram revisados antes da publicação. Nenhum deles continha chave
secreta (os prompts, ao contrário, mandam nunca versionar segredos). Mesmo assim,
alguns trechos foram substituídos por `[REDIGIDO: ...]`:

- identificador do projeto Supabase e chave publicável do ambiente hospedado;
- um e-mail pessoal de teste;
- senhas das contas de demonstração;
- o identificador da conta Cloudflare no endereço do Worker.

Fora isso, os arquivos estão como foram escritos.
