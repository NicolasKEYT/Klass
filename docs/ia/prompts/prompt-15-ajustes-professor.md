# Prompt 15 — Ajustes de Fluxo do Professor (aulas, notas, avaliações)

Você vai corrigir e melhorar o fluxo de trabalho do professor no Diário
de Classe. Leia o `CLAUDE.md` antes de começar. Teste tudo em produção
ao final.

## Contexto

Feedback direto de quem usa a tela do professor no dia a dia. São
correções e pequenas melhorias, não mudança de arquitetura — mas alguns
itens têm nuance (edição pós-lançamento precisa respeitar o bloqueio já
existente após encerramento do módulo).

## 1. Não é possível editar uma aula depois de criada

**Problema:** se o professor errar a data ao criar uma aula, não há
como corrigir.

**Correção:** adicione capacidade de editar uma aula existente (data,
horário, descrição) — na lista de aulas da turma, cada uma ganha uma
ação de editar, seguindo o padrão visual já usado em outras edições do
projeto. Editar a data de uma aula não deve apagar nem alterar as
presenças já registradas para ela.

## 2. Templates/recorrência para criação de aulas

**Problema:** professor cria aulas uma por uma. Na prática, a maioria
das turmas tem um padrão fixo (ex.: toda terça e quinta, das X às Y,
por um período), com exceções pontuais.

**Correção:** ao lado da criação manual de uma aula por vez (mantenha
essa opção para exceções), adicione um modo de criação em lote:
professor escolhe dia(s) da semana, horário, data de início e data de
fim, e o sistema gera automaticamente uma aula para cada ocorrência
naquele intervalo. Depois de geradas, cada aula continua editável
individualmente (item 1) para tratar exceções (feriado, mudança de sala,
etc.) sem precisar recriar tudo.

Não precisa ser elaborado: um formulário simples com "dias da semana"
(checkboxes: seg/ter/qua/qui/sex/sáb/dom), horário, data de início, data
de fim, e um botão "Gerar aulas" que insere todas de uma vez. Mostre uma
prévia da quantidade de aulas que serão criadas antes de confirmar.

## 3. Chamada retorna para a aba errada

**Problema:** ao sair da tela de "Fazer chamada" (que é acessada a
partir da aba "Aulas"), o professor volta para a aba "Avaliações" em
vez de "Aulas".

**Correção:** o retorno (botão voltar ou "Salvar e voltar") da tela de
chamada deve levar de volta para a aba de onde veio (Aulas), não para
uma aba fixa. Aplique o mesmo raciocínio se a tela de lançar notas
tiver o mesmo tipo de problema ao voltar para "Avaliações" (confirme
que já funciona certo; se não, corrija igual).

## 4. Não é possível editar uma nota depois de lançada

**Problema:** uma vez salva, a nota de um aluno numa avaliação não pode
ser corrigida.

**Correção:** permita reabrir e editar uma nota já lançada, **desde que
a matrícula correspondente ainda não esteja encerrada** (status
`matriculada`, não `concluida`/`reprovada` — o bloqueio pós-encerramento
já existe no banco via trigger; a tela só precisa parar de esconder a
opção de editar). Reutilize a tela de lançamento em bloco já existente,
pré-preenchendo com os valores atuais.

## 5. Não é possível remover uma avaliação criada

**Problema:** o professor não tem como apagar uma avaliação que criou
por engano ou que não faz mais sentido.

**Correção:** adicione ação de apagar avaliação, com confirmação
inline. Trate dois casos:

- **Sem notas lançadas ainda:** apaga direto.
- **Já tem notas lançadas para algum aluno:** ou (a) apaga em cascata
  (remove as notas junto — são dados pré-encerramento, ainda
  corrigíveis) com um aviso claro no texto de confirmação informando
  que as notas lançadas para essa avaliação serão perdidas, ou (b)
  bloqueia e pede para o professor remover as notas manualmente
  primeiro. Escolha a opção mais simples de implementar de forma
  segura — recomendo (a), com o aviso bem visível na confirmação — e
  documente a decisão.

Depois de apagar uma avaliação, o indicador "representa X% da média
final" das avaliações restantes deve recalcular automaticamente (já
deveria funcionar se o cálculo for dinâmico; confirme).

## 6. Validação de nota (0-10) sem explicar o erro

**Problema:** o professor tentou lançar uma nota "1000" e recebeu a
mensagem genérica "Não foi possível salvar. Confira os dados e tente
novamente." — sem indicar que o problema é o valor fora do intervalo
permitido.

**Correção, nas duas camadas:**

1. **Client-side:** o campo de nota deve ter validação de intervalo (0
   a 10) antes mesmo de tentar salvar — via `min`/`max` do input e/ou
   validação explícita com mensagem inline ("A nota deve estar entre 0
   e 10") antes da chamada ao banco.
2. **Mensagem de erro do banco:** se, ainda assim, uma violação do
   `check` de intervalo chegar ao backend (defesa em profundidade),
   mapeie essa constraint específica para uma mensagem clara em
   português, em vez de cair no fallback genérico. Verifique o nome
   exato da constraint em `diario.notas` e adicione ao dicionário de
   mensagens de erro já existente no projeto.

## Regras que valem para tudo

- Teste em produção com a conta de professor real.
- Respeita o bloqueio de edição pós-encerramento já existente — nenhum
  destes itens deve reabrir edição de módulo já concluído/reprovado.
- Confirmação inline para qualquer ação destrutiva, nunca
  `window.confirm()`.
- Comentários em português explicando o porquê.
- Se alguma correção exigir migration (ex.: mensagem de erro de
  constraint, cascata de delete em avaliação), siga o processo normal:
  migration versionada, tipos regenerados, `pnpm typecheck` e `pnpm
  build` limpos.

## Ao terminar, me entregue

1. Para cada item (1-6): o que foi corrigido, com a causa raiz onde
   aplicável (especialmente item 3, que pode ser sintoma de um padrão
   mais amplo de navegação por aba).
2. A decisão tomada no item 5 (cascata vs. bloqueio) e por quê.
3. Confirmação de que o bloqueio pós-encerramento continua funcionando
   (teste: tente editar nota/aula de uma matrícula já encerrada e
   confirme que ainda é bloqueado).
4. `pnpm typecheck` e `pnpm build` limpos, CI verde.
5. Commits por item ou tema, `git push` ao final.
