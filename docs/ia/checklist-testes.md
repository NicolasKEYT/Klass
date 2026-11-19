# Checklist de testes — Klass

Use as três contas de teste (`aluno.teste@klass.dev`,
`professor.teste@klass.dev`, `coordenacao.teste@klass.dev`) e teste em
produção. Se criar algum dado de teste extra (aula, trilha, matrícula),
apague ou reverta ao final — o banco é compartilhado com o time e com
quem for avaliar depois.

Se encontrar algo errado, anote: a tela, o passo exato que causou, e um
print. Para mensagens de erro, copie o texto exato.

---

## 1. Tempo real (fazer primeiro — é o mais crítico)

- [ ] Abra o Klass em **duas janelas realmente separadas** (uma normal
      e uma anônima/privada, ou dois navegadores diferentes — não duas
      abas do mesmo navegador, porque elas compartilham sessão).
- [ ] Em uma, logue como professor. Na outra, como aluno, na tela do
      boletim de uma matrícula ativa.
- [ ] Como professor, lance uma nota nova para esse aluno.
- [ ] Confirme que a nota aparece na tela do aluno **na hora, sem
      recarregar a página**.

## 2. Navegação e troca de aba (sem recarregamento falso)

- [ ] Troque de aba do navegador várias vezes seguidas, inclusive
      enquanto uma tela ainda está carregando, nas seguintes telas:
      Boletim do aluno, Início do aluno, Hoje do professor, Turmas do
      professor.
- [ ] Confirme que não aparece recarregamento visível nem mensagens de
      "vazio" incorretas (como "você não está cursando nenhum módulo"
      quando na verdade está).
- [ ] Como aluno (Ana), no Boletim, clique no link de um módulo
      marcado como "Disponível" (ex.: Programação para Dados). Deve
      abrir a tela de detalhe do módulo corretamente, nunca "Módulo não
      encontrado".

## 3. Visual — comparar cada tela com o design oficial

Abra cada tela ao lado da imagem de referência correspondente. Teste em
desktop **e** em largura de celular (~375px).

- [ ] **Cores:** botões e badges de destaque (ex.: "Concluído",
      "Chamada feita", botão principal de cada tela) em preto sólido.
      Nenhum azul em lugar nenhum, **exceto** o círculo de seleção de
      turma na tela de inscrição em módulo.
- [ ] **Cards:** borda visível em todos, nenhuma sombra.
- [ ] **Badges de status:**
  - [ ] "Chamada pendente" e "Concluído" preenchidos de preto.
  - [ ] "Cursando" com contorno (não preenchido).
  - [ ] "Bloqueado" com borda tracejada.
  - [ ] Badges de alerta (ex.: "Abaixo da média") com contorno e ícone
        de alerta — nunca vermelho ou amarelo.
- [ ] **Formas:**
  - [ ] Barra de progresso do aluno (Início) segmentada em blocos, um
        por módulo — não uma barra contínua.
  - [ ] Toggle Presente/Falta na chamada como um único controle, as
        duas opções coladas, sem espaço entre elas.
  - [ ] Avatares com iniciais do nome.
  - [ ] Barras de frequência/meta com um traço vertical marcando o
        mínimo exigido.
- [ ] **Navegação:** barra lateral (não cabeçalho no topo), item ativo
      destacado em preto. No celular, aluno e professor têm barra
      inferior fixa; coordenação **não tem** barra inferior nenhuma —
      no celular, coordenação só vê a tela "Início".
- [ ] Nenhum círculo numerado ("D1", "D2" etc.) aparece em tela nenhuma
      — isso é só anotação de documento, não deve aparecer no produto.
- [ ] Telas específicas para conferir visualmente: Hoje (professor),
      Início do aluno no celular, Boletim, Detalhe de módulo, Chamada,
      Avaliações e notas (grade do professor), Início da coordenação.

## 4. Professor — aulas

- [ ] Edite a data de uma aula que **já tem chamada registrada**.
      Confirme que as presenças já marcadas continuam exatamente como
      estavam depois da edição.
- [ ] Reverta a data para o valor original.
- [ ] Use a criação de aulas em lote (recorrência): escolha dois dias
      da semana (ex.: terça e quinta) e um período de datas. Confirme
      que a prévia de quantidade bate com o número real de ocorrências
      no período escolhido.
- [ ] Gere o lote, confirme que as aulas foram criadas nas datas
      certas. Se quiser, edite uma aula do lote individualmente depois.
- [ ] Vá até a aba "Aulas", clique em "Fazer chamada" de uma aula, e
      depois clique em "Voltar". Confirme que volta direto para a aba
      "Aulas" (não para "Avaliações" ou outra aba).
- [ ] Recarregue a página estando na aba "Aulas" (via URL ou F5).
      Confirme que a aba selecionada se mantém após recarregar.

## 5. Professor — notas e avaliações

- [ ] Edite a nota de um aluno com matrícula **ativa** (não encerrada)
      na grade de avaliações. Confirme que salva e atualiza a média.
- [ ] Confirme que as células de notas de alunos **já encerrados**
      (concluído ou reprovado) aparecem bloqueadas/desabilitadas, sem
      permitir edição.
- [ ] Apague uma avaliação **sem nenhuma nota lançada** — deve apagar
      direto, sem aviso de perda de dado.
- [ ] Apague uma avaliação **com notas já lançadas** — deve aparecer um
      aviso claro de que as notas serão perdidas, antes de confirmar.
- [ ] Tente apagar uma avaliação que tem nota de um aluno **já
      encerrado** — deve ser bloqueado. Leia a mensagem de erro: ela
      precisa ser compreensível para um professor, não um erro técnico
      cru do banco de dados.
- [ ] Teste a validação de nota digitando, um de cada vez: `1000`,
      `10,5`, `-1`, e `7,5`. Os três primeiros devem mostrar mensagem
      clara de erro explicando o problema; o último (`7,5`) deve ser
      aceito normalmente.

---

## Ao final

Se tudo passou, o sistema está pronto para receber avaliadores externos
sem risco de bug atrapalhar a avaliação de usabilidade. Se algo falhou,
reúna os prints e mensagens de erro antes de reportar.
