# Prompt 13 — Correções de Coordenação (trilhas, turmas, formulários)

Você vai corrigir uma lista de bugs e lacunas de UX reportados pela
coordenação ao usar o sistema no dia a dia. Leia o `CLAUDE.md` antes de
começar. Teste tudo em produção (`klass-91y.pages.dev`) ao final.

## Contexto

O sistema já passou por uma rodada de QA de regressão e uma auditoria
completa do feedback anterior — ambas limpas. Este é feedback **novo**,
focado especificamente no fluxo de trabalho da coordenação (criar
trilha, criar turma, editar).

## 1. Fluxo de criação de trilha não permite adicionar módulos direto

**Problema:** ao criar uma trilha nova, não há como adicionar módulos
na mesma sequência — o usuário precisa salvar, sair, e voltar para a
tela de edição para só então adicionar módulos.

**Correção:** após criar a trilha com sucesso, redirecione diretamente
para a tela de edição dela (`/coordenacao/trilhas/:slug/editar`), onde
a seção de módulos já está disponível — em vez de redirecionar para a
listagem. Se já existir um botão "Salvar e ver detalhes" ou equivalente
do padrão estabelecido, verifique se ele já faz isso; se não, ajuste
para que o caminho padrão de criação sempre termine na tela onde dá
para adicionar módulos, sem passo intermediário.

## 2. Ícone duplicado na edição de trilha e de módulo

**Problema:** o ícone aparece duplicado nas telas de edição (tanto de
trilha quanto de módulo).

Investigue a causa antes de corrigir — não assuma. Hipóteses a
verificar: o componente de exibição do ícone está sendo renderizado
duas vezes no mesmo container (por exemplo, um ícone no cabeçalho da
seção E outro dentro do seletor, dando a impressão de duplicidade); ou
o seletor de ícone em si está re-renderizando a opção selecionada de
forma duplicada na grade. Reproduza, identifique a causa exata, e
corrija na raiz.

## 3. Botões que somem e reaparecem ao clicar

**Problema:** em algumas interações, o botão clicado desaparece e
reaparece rapidamente, dando impressão de instabilidade — no uso
corrido do dia a dia isso tende a fazer a pessoa clicar de novo por
reflexo, o que pode disparar ações duplicadas.

Investigue qual(is) botão(ões) especificamente têm esse comportamento
(percorra as telas de coordenação — trilhas, módulos, turmas — e
observe estados de loading/disabled). Causa provável: um estado de
carregamento que troca o conteúdo do botão (texto ↔ spinner ↔ texto) de
forma muito rápida ou com re-render desnecessário no meio do processo.
Corrija a causa raiz — não apenas mascare com CSS.

## 4. Feedback de seleção (check) demora para sumir ao desmarcar

**Problema:** ao desmarcar algo (ex.: um item selecionado em uma lista
ou seletor), a marca de "selecionado" demora para desaparecer
visualmente.

Investigue se isso é o mesmo componente do item 3 (mesma causa raiz,
sintoma parecido) ou algo separado — procure em seletores com estado
de check/seleção na área de coordenação (o seletor de ícone é um
candidato provável, já que foi tocado no item 2; também verifique
listas de pré-requisitos com checkbox). Corrija a raiz do atraso.

## 5. Validação do período da turma permite excesso de dígitos

**Problema:** ao definir o período de início/fim de uma turma, é
possível digitar um ano com mais dígitos do que deveria (ex.: um ano de
5 dígitos).

**Correção:** valide e limite o campo de ano a exatamente 4 dígitos,
tanto no `maxLength` do input quanto na validação antes de salvar (não
confie só no front-end — se o banco não tiver um `check` de faixa
razoável de ano na coluna de período, adicione um).

## 6. Inputs de dia/mês da data têm comportamento de avanço incorreto

**Problema:** ao digitar um valor de dois dígitos no campo de dia (ex.:
"12"), o foco avança prematuramente para o campo de mês antes de
terminar de digitar; o mesmo acontece entre mês e ano.

Investigue a implementação atual do input de data (provavelmente campos
segmentados dia/mês/ano com auto-avanço). Corrija a lógica de auto-avanço
para só mover o foco ao **próximo campo** quando o segmento atual
atingir seu número máximo de dígitos **e** o valor digitado até aquele
ponto ainda permitir complementação válida — ou, mais simples e
robusto: considere substituir por um input de data nativo do navegador
(`<input type="date">`) estilizado com os tokens do design system, o
que elimina essa classe inteira de bug de foco/máscara. Escolha a opção
mais simples de manter; documente a decisão.

## 7. Não é possível editar uma turma depois de criada

**Problema:** hoje só existe criação de turma; não há tela para editar
código, professor responsável, período, vagas ou frequência mínima
depois que a turma já foi criada. Isso também bloqueia corrigir a
frequência mínima depois do fato, hoje só definível na criação.

**Correção:** adicione uma tela `/coordenacao/turmas/:id/editar` (ou
incorpore a edição na tela de detalhe já existente, o que for mais
coerente com o padrão do projeto) permitindo editar: código, professor,
período de início/fim, vagas totais e frequência mínima. Segue o padrão
já estabelecido: "Salvar" e "Salvar e voltar", validação client-side,
mensagens de erro do banco tratadas em português. Considere se algum
desses campos deveria ficar bloqueado após haver matrículas ativas na
turma (por exemplo, reduzir vagas abaixo do número de matriculados
deveria ser impedido pelo banco) — se o `check`/trigger relevante não
existir ainda, adicione.

## 8. Código da turma: validação e mensagem de erro confusas

**Problema:** o usuário tentou o código `MOD2TEST1-2026-1` e recebeu um
erro genérico de "não segue o padrão", sem indicação clara de qual é o
padrão esperado nem exemplo de um código válido.

Duas correções:

1. **Mensagem de erro melhor:** quando a validação de formato falhar
   (seja no banco via `check` ou no client), a mensagem deve explicar o
   padrão esperado com um exemplo concreto (ex.: "Use o formato
   SIGLA-ANO-SEQUÊNCIA, como CDA-2026-1").
2. **Revise o padrão em si.** Confirme qual regex está de fato em vigor
   na constraint do banco (`selecao.turmas.codigo`) e avalie se é
   razoável. Se o padrão for mais restritivo do que o necessário (por
   exemplo, não aceitar números dentro da sigla, ou limitar demais o
   tamanho), amplie para algo como letras e números livres separados
   por hífen em 2 a 3 segmentos, mantendo alguma validação básica (não
   vazio, sem espaços, tamanho razoável) em vez de um padrão rígido
   copiado literalmente do design. Documente o padrão final no
   placeholder do campo (ex.: "Ex: CDA-2026-1") para orientar sem
   precisar de erro.

## Regras que valem para tudo

- Teste em produção com a conta de coordenação real.
- RLS já existente não deve ser enfraquecida por nenhuma dessas
  mudanças — se alguma exigir nova coluna ou tabela, aplique RLS desde
  a migração.
- Siga os padrões já estabelecidos: confirmação inline (nunca
  `window.confirm()`), botão voltar em telas internas, "Salvar"/"Salvar
  e voltar" em formulários, comentários em português explicando o
  porquê.
- Não implemente os itens de certificado por módulo ou média mínima
  configurável — esses ficam para um prompt separado, aguardando
  confirmação.

## Ao terminar, me entregue

1. Para cada item (1-8): o que foi corrigido e a causa raiz encontrada
   (principalmente itens 2, 3 e 4, que pedem investigação).
2. Qualquer decisão própria tomada (ex.: escolha entre input de data
   nativo vs. corrigir a máscara atual; onde a tela de editar turma
   ficou).
3. `pnpm typecheck` e `pnpm build` limpos, CI verde.
4. Commits organizados por item ou por tema afim.
5. `git push` ao final.
