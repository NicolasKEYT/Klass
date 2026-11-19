# Prompt 16 — Reforma Visual e de Navegação (UI Kit)

Você vai reconstruir a camada visual e de navegação do Klass inteiro,
seguindo um UI Kit formal que a equipe desenvolveu (pesquisa de UX,
benchmark de 12 produtos, dados do contexto brasileiro, heurísticas e
normas, com cada decisão rastreável por código D1-D15). Leia o
`CLAUDE.md` antes de começar.

## Passo 0 — leia o documento fonte primeiro

O documento está na pasta de diagramas do projeto, junto com os casos
de uso (procure por algo como `klass-uikit.pdf` — use `find`/`grep` se
o nome exato não bater). **Leia o PDF inteiro antes de tocar em
qualquer código.** Ele contém, em ordem:

1. Contexto (benchmark, dados do Brasil, pesquisa de UX, normas)
2. "Quem vai usar" — estatísticas sobre professores/escolas no Brasil
3. "O que o mercado já faz" — padrões recorrentes e reclamações reais
4. Decisões de desenho D1 a D15, cada uma com fonte e telas onde se
   aplica
5. Diagnóstico do que manter e do que mudar no código atual
6. Página de Fundamentos (escala tipográfica, alvos de toque,
   densidade, vocabulário de status)
7. Sete telas de wireframe em alta fidelidade: Hoje (professor), Início
   do aluno (mobile), Boletim do aluno, Detalhe de módulo/inscrição,
   Navegação por papel, Chamada (mobile), Avaliações e notas
   (desktop), Início da coordenação, Turmas/Inscrições

**O PDF é a fonte de verdade para qualquer valor pixel a pixel.** O
resumo abaixo cobre o essencial para orientar o trabalho, mas não
substitui a leitura do documento original.

## O que este prompt cobre — e o que não cobre

**Cobre:** fundamentos visuais (tipografia, espaçamento, alvos de
toque, vocabulário de status), navegação por barra lateral substituindo
o cabeçalho atual, e a reconstrução das telas específicas mostradas no
kit, reutilizando os dados e a lógica de negócio que já existem — isso
é reforma de camada de apresentação, não reescrita de backend.

**Não cobre** (decisão consciente, aguardando confirmação ou prompt
futuro):

- **D7 (separar lançar de publicar nota):** o próprio documento marca
  essa decisão como "EM ABERTO" e nota que ela conflita com o Realtime
  já implementado e documentado no artigo do TCC (Fluxo 3). **Mantenha
  o comportamento atual** — aluno vê a nota instantaneamente via
  Realtime assim que lançada. Não adicione estado de
  publicada/não-publicada, não adicione botão "Publicar", não mude a
  RLS de `diario.notas`. Se encontrar menção a isso nas telas do PDF
  (ex.: bordas grossas indicando "não publicada", botão "Publicar N
  notas"), **omita esses elementos específicos** e mantenha a
  visualização atual de notas sempre visíveis ao aluno.
- Tela "Pessoas" (gestão de usuários) da coordenação — não existe
  ainda, fica para prompt futuro.
- Aprovar/rejeitar inscrições em lote — mantenha a ação individual que
  já existe; não implemente seleção múltipla nem os checkboxes de lote
  mostrados no wireframe de Turmas/Inscrições.
- Exportar tabelas para CSV/XLSX.
- "Avise-me quando liberar" (lista de espera para pré-requisito não
  cumprido).
- Aulas geradas automaticamente a partir do horário recorrente da
  turma — mantenha a criação manual de aula que já existe (ou a que
  estiver em desenvolvimento em outro prompt).

Para cada um desses itens, se a tela que você está reconstruindo
depender visualmente dele, simplifique de forma honesta (por exemplo:
oculte o checkbox de seleção em lote e mantenha só os botões
individuais de aprovar/rejeitar que já existem) em vez de construir uma
aparência de funcionalidade que não existe por trás.

## 1. Fundamentos — aplicar globalmente primeiro

Antes de mexer em qualquer tela específica, atualize os tokens base em
`tailwind.config.ts`, porque várias telas dependem deles.

**Escala tipográfica** (base 16, razão ~1,25) — substitui os tokens
atuais abaixo de 14px:

- 32px — título de página
- 24px — título de seção
- 20px — título de card
- 16px — corpo, célula de tabela, botão
- 14px — metadado, legenda, rótulo (mínimo absoluto — nada no sistema
  fica abaixo disso)

Os tokens atuais `klass-2xs`, `text-caption`, `text-label`,
`text-body-sm` (9,5/11/12/13px) saem de circulação — remapeie os usos
existentes para o token de 14px mais próximo, e ajuste o design system
para não ter mais nenhum tamanho abaixo de 14px em lugar nenhum do
código.

**Alvos de toque e clique:**

- 48px de altura mínima em controles interativos no mobile
- 40px no desktop
- 24px como mínimo absoluto (WCAG 2.5.8)

Aplique isso a botões, itens de lista clicáveis, e especialmente ao
toggle de presença/falta da chamada (ver seção 5).

**Densidade:**

- Grade de espaçamento: múltiplos de 8px
- Linha de tabela no desktop: 52px de altura
- Linha de lista no mobile: 64px de altura
- Padding de card: 24px

**Vocabulário de status** — todo status no sistema passa a ter ícone +
texto + cor (nunca só cor, por acessibilidade). Consulte o PDF para o
conjunto completo (matrícula: em análise/matriculado/concluído/
reprovado/rejeitada/cancelada; aula e avaliação: chamada feita/chamada
pendente/abaixo da média). Centralize isso em um componente de Badge de
status reutilizável, não repita a lógica em cada tela.

**Números** (notas, faltas, vagas) em IBM Plex Mono com algarismos
tabulares, para alinhar em coluna — confirme que já está assim
consistentemente; se não, aplique.

**Indicador de sincronização**, sempre visível no topo das telas
autenticadas: quatro estados — tempo real / salvando / salvo às HH:MM /
sem conexão. Hoje provavelmente só existe algo parecido com "tempo
real" fixo; estenda para refletir o estado real da última operação de
salvamento quando fizer sentido na tela.

## 2. Navegação — barra lateral substitui o cabeçalho atual

O código atual usa navegação no topo (cabeçalho horizontal); o novo
padrão é **barra lateral**, diferente por papel, no máximo 5 itens:

- **Aluno:** Início, Catálogo, Boletim, Certificados
- **Professor:** Hoje, Minhas turmas, Catálogo
- **Coordenação:** Início, Turmas, Trilhas, Certificados (deixe espaço
  reservado para "Pessoas" entrar depois, mas não a implemente agora)

Rodapé da barra lateral: nome do usuário + papel, seguido de "Sair".

**No mobile:**

- Aluno e professor recebem barra inferior fixa (64px, rótulo sempre
  visível): Início/Catálogo/Boletim/Certificados para aluno;
  Hoje/Turmas/Perfil para professor.
- **Coordenação não recebe barra inferior nenhuma.** No mobile, a
  coordenação vê apenas a tela "Início" com as pendências — gestão de
  turmas e trilhas é tarefa de desktop. Redirecione ou adapte a
  experiência mobile da coordenação de acordo.

Reescreva o layout compartilhado das rotas autenticadas para usar esse
novo shell (barra lateral no desktop, barra inferior condicional no
mobile) em vez do cabeçalho horizontal atual. Preserve todas as rotas e
funcionalidades existentes — isso é mudança de chrome, não de conteúdo.

Renomeie a entrada de menu/rota do aluno que hoje é "Minhas matrículas"
para **"Boletim"** — é como o aluno de fato procura essa informação,
segundo a pesquisa.

## 3. Tela "Hoje" do professor (nova)

Substitui (ou complementa, se fizer mais sentido manter as duas) a
home atual do professor. Consulte o PDF para o layout exato. Estrutura
geral:

- Cabeçalho com data por extenso, "Tempo real".
- Card "Aulas de hoje": lista as aulas do professor programadas para
  hoje (aula, horário, turma, sala se houver, contagem de alunos),
  cada uma com status de chamada (feita/pendente) e ação
  correspondente ("Ver" ou "Fazer chamada").
- Card "Pendências": itens acionáveis — avaliações sem nota completa,
  chamadas atrasadas, turmas próximas do fim (linke para a ação
  relevante). Construa a partir de dados reais já existentes (turmas,
  aulas, avaliações do professor) — não invente dado que não existe.
- Card "Alunos que pedem atenção": alunos do professor com frequência
  abaixo de 75% ou média parcial abaixo do mínimo da trilha.

Se o cálculo de algum desses itens exigir uma consulta que não existe
ainda, implemente a consulta (é leitura, não muda schema) em vez de
pular o card.

## 4. Área do aluno

**Início (mobile-first):** card principal "Seu próximo passo" —
mostra a trilha mais avançada em andamento, progresso em barra
segmentada (módulos concluídos vs. total), módulo atual, botão "Ver
boletim". Card de frequência do módulo atual com barra contra a meta de
75% (ver seção sobre indicadores abaixo). Card "Novidades" — feed
recente de eventos relevantes (nota publicada, matrícula confirmada) —
pode derivar dos mesmos dados que já alimentam o Realtime.

**Boletim** (era "Minhas matrículas"): lista de módulos da trilha atual
como cards, cada um com média, frequência, e status (concluído/
cursando/bloqueado). Módulo em andamento expande mostrando cada
avaliação com peso e nota (ou "—" se não lançada), e uma frase
explicando o critério de aprovação com os valores reais da trilha
("Para ser aprovado: média X e frequência de Y%. Você já
atingiu/ainda não atingiu os dois."). Card de certificado da trilha ao
final, com estado bloqueado/liberado condizente com o progresso real.

**Detalhe de módulo/inscrição** (dentro do catálogo): antes do botão de
inscrição, mostra os pré-requisitos com status individual (concluído
com data, cursando com previsão, ou pendente). Ao lado, "Escolha a
turma" com as opções disponíveis (período, professor, vagas) em
formato de seleção única. Botão de inscrição desabilitado com o motivo
explícito quando pré-requisito não cumprido (sem o link "avise-me",
que fica fora de escopo).

## 5. Chamada (mobile-first)

Reconstrua a tela de fazer chamada seguindo o padrão: todos os alunos
começam como "presente" por default; um toque muda para "falta". Use
o alvo de toque de 48px (seção 1), com o botão afastado do nome do
aluno para evitar toque errado. Mostra contagem de presentes/faltas no
topo. Indicador de "alterações não salvas" até confirmar. Botão de
salvar grande, no rodapé.

## 6. Avaliações e notas (desktop)

Reconstrua como uma grade: alunos nas linhas, avaliações nas colunas,
células editáveis com navegação por Enter (salva e desce) e Tab (vai
para a próxima avaliação), Esc desfaz a edição da célula. Mostra
média parcial e frequência calculadas por linha, e uma coluna de
situação usando o vocabulário de status da seção 1. Toolbar acima da
grade mostra, como informação (não editável aqui — isso é definido na
trilha, conforme já decidido em outro prompt): média mínima da trilha,
frequência mínima da turma, e o indicador de que o cálculo é por média
ponderada.

**Não implemente** o botão "Publicar N notas" nem o estado visual de
"não publicada" (bordas grossas) — ver a exclusão do D7 no topo deste
prompt. Notas lançadas continuam visíveis ao aluno instantaneamente.

## 7. Início da coordenação (novo painel)

Antes de construir esta tela, crie as duas views que faltam:

```sql
create view catalogo.vw_desempenho_por_trilha as ...
create view catalogo.vw_taxa_evasao as ...
```

Modele-as com base no que os cards do PDF precisam mostrar:
`vw_desempenho_por_trilha` — taxa de aprovação nos módulos já
encerrados, por trilha; `vw_taxa_evasao` — proporção de matrículas
canceladas/reprovadas por período. Use os nomes exatos citados no PDF
(são os mesmos do artigo original do TCC1). Aplique RLS ou grants
apropriados (leitura só para coordenação).

Construa a tela com:

- Busca global (aluno, turma ou trilha) — pode ser busca simples por
  nome/código, sem necessidade de índice de busca sofisticado nesta
  passada.
- Seção "Precisa de você": cards de ação para inscrições pendentes de
  aprovação, chamadas atrasadas, turmas sem professor vinculado, e
  certificados prontos — cada card levando à tela relevante.
- Três indicadores com barra contra meta (não velocímetro nem pizza —
  ver a próxima seção): frequência média, aprovação nos módulos
  encerrados (usando a view nova), evasão no semestre (usando a view
  nova).
- Tabela "Turmas em andamento" com ocupação, frequência média e
  situação.

## 8. Componente de indicador (barra contra meta)

Vários lugares (frequência do aluno, painel da coordenação) usam o
mesmo padrão visual: uma barra horizontal mostrando o valor atual,
com uma marca vertical indicando a meta/mínimo. Construa isso como um
componente reutilizável único, não repita a implementação.

## 9. Turmas / Inscrições (coordenação)

Mantenha a aprovação/rejeição **individual** (sem seleção em lote —
ver exclusões no topo). Pode manter ou adaptar o padrão de painel
lateral não-modal para ver detalhe do aluno (histórico na trilha,
frequência) ao lado da lista, se achar que cabe bem com o que já
existe; se a tela atual usa modal, avalie se vale a pena migrar para
painel lateral nesta passada ou se fica para depois — decisão sua,
documente.

Garanta que a tela de detalhe da turma tem o botão "Editar turma"
visível no cabeçalho, apontando para a tela de edição (se já existir de
outro prompt; se não, apenas garanta que o botão está presente e
navega para onde a edição de turma deve estar).

## 10. Traceability D1-D15

O documento original existe para que cada decisão de design seja
rastreável na defesa do TCC. Preserve isso no código: adicione um
comentário citando o código da decisão (ex.: `// D5 — chamada
mobile-first, ver docs/diagramas/klass-uikit.pdf`) nos componentes ou
trechos de estilo que implementam cada decisão específica. Não precisa
ser exaustivo em todo lugar, mas cubra pelo menos os componentes
centrais de cada decisão (Fundamentos, navegação, chamada, grade de
notas, indicadores).

## Regras que valem para tudo

- Isso é reforma de apresentação. Reutilize os dados e a lógica de
  negócio que já existem — não mude regra de negócio, RLS existente ou
  fluxo de dados, exceto as duas views novas do passo 7 (que são
  aditivas, só leitura).
- RLS nas views novas.
- Teste em produção ao final, nos três papéis, desktop e mobile.
- Siga os padrões já estabelecidos que não conflitam com o kit
  (confirmação inline, nunca `window.confirm()`; "Salvar"/"Salvar e
  voltar"; comentários em português).
- Se encontrar, ao ler o PDF, algo que pareça contradizer as exclusões
  de escopo deste prompt, pare e pergunte antes de implementar.

## Ao terminar, me entregue

1. Confirmação de que leu o PDF completo antes de começar.
2. Resumo do que foi reconstruído, tela por tela.
3. As duas views novas (`vw_desempenho_por_trilha`, `vw_taxa_evasao`) —
   definição exata e de onde vêm os números.
4. Screenshots ou descrição visual das telas mais transformadas (Hoje
   do professor, navegação por papel, grade de notas, painel da
   coordenação).
5. Qualquer decisão própria tomada (ex.: painel lateral vs. modal na
   seção 9).
6. Confirmação explícita de que D7 não foi implementado e o Realtime
   instantâneo continua funcionando como antes.
7. `pnpm typecheck` e `pnpm build` limpos, CI verde.
8. Commits organizados por tema (fundamentos, navegação, cada tela
   maior), `git push` ao final.

Este prompt é grande e toca quase toda tela do sistema — não é hora de
adicionar nada além do que está aqui. Pare no que está descrito.
