# Prompt 09 — Ajustes de UX/UI e correções pós-teste

Você vai corrigir uma lista de problemas encontrados por um colega da
equipe que testou o sistema (o teste foi feito antes do MS4 estar
completo — parte disso pode já ter sido corrigido nos prompts de MS4,
MS5 e deploy). Leia o `CLAUDE.md` na raiz antes de começar.

## Contexto

MS1 a MS5 estão completos e em produção
(`https://klass-91y.pages.dev`). Um colega da equipe testou o sistema e
levantou uma lista de problemas de usabilidade, bugs de performance e
pequenas lacunas de feature. Este prompt não adiciona módulo novo — é
uma rodada de polimento.

**Antes de mexer em qualquer item:** verifique o comportamento atual no
navegador. Se algo já foi corrigido num prompt anterior (MS4, MS5 ou
deploy), **não refaça** — apenas confirme no relatório final que já
estava certo e siga para o próximo item.

## 1. Bug de performance — recarregamento ao trocar de aba

**Sintoma relatado:** toda vez que o usuário troca de aba do navegador
(sai e volta) ou navega para outra página, aparece um carregamento de
1 a 2 segundos, consistentemente, como se nada fosse cacheado.

Investigue a causa raiz antes de corrigir — não assuma. Hipóteses a
verificar:

- O `AuthProvider` pode estar re-executando `getSession()` ou refazendo
  fetch do profile a cada evento de `visibilitychange` da aba, mesmo
  quando o usuário não mudou.
- Algum `useEffect` com dependência instável disparando refetch
  desnecessário.
- Falta de cache entre navegações client-side que deveriam reusar dados
  já carregados na sessão.

Reproduza no navegador, use React DevTools ou logging temporário pra
identificar exatamente o que dispara a cada troca de aba, documente a
causa real encontrada, e corrija na raiz — não só sintomaticamente.

## 2. Sistema de design — hierarquia tipográfica

**Problema:** títulos e subtítulos às vezes aparecem **menores** que o
texto normal do corpo, de forma inconsistente entre telas.

Faça uma auditoria dos componentes de texto usados no projeto (verifique
se existe um componente `Heading`/`Titulo` centralizado, ou se cada tela
aplica classes Tailwind manualmente — se for o segundo caso, esse é o
problema raiz).

Corrija criando (ou consolidando) uma escala tipográfica clara e
aplicando consistentemente:

- Título de página (maior, mais peso)
- Subtítulo de seção
- Corpo de texto
- Legenda/metadado (menor)

Cada nível deve ser visivelmente maior que o nível abaixo dele, sem
exceção. Aplique a correção em todas as telas existentes, não só nas
citadas neste prompt.

## 3. Layout desktop — desperdício de espaço

**Problema:** em telas de desktop, o conteúdo ocupa cerca de 30% da
largura, como se fosse um layout mobile esticado. Professor e
coordenação usam o sistema majoritariamente no computador — isso
precisa ser confortável lá.

Ajuste os containers principais das telas autenticadas para usar uma
largura máxima maior em viewports largos (ex.: `max-w-6xl` ou `max-w-7xl`
do Tailwind, ajuste conforme o que ficar visualmente equilibrado), com
padding lateral adequado. Não precisa virar um layout de múltiplas
colunas complexas — só parar de desperdiçar a tela.

## 4. Cabeçalho — reorganização

**Problema:** todos os itens (exceto a logo) estão colados à direita do
cabeçalho, fazendo tudo parecer clicável/botão, sem hierarquia visual.

Reorganize:

- **Esquerda:** logo/nome do sistema.
- **Centro ou logo após a esquerda:** links de navegação clicáveis
  (Catálogo, Trilhas, Turmas, Certificados — o que for relevante pro
  papel logado).
- **Direita:** nome do usuário, badge do papel, botão "Sair".

Mantenha os tokens de design já estabelecidos. Teste visualmente nas
larguras de desktop e mobile antes de considerar concluído.

## 5. Responsividade mobile

**Problema:** o cabeçalho quebra mal no celular, e alguns blocos de
conteúdo não ocupam a largura total da tela (sobra espaço vazio nas
laterais de forma inconsistente).

Revise os breakpoints do Tailwind aplicados no cabeçalho (provavelmente
precisa de um menu hambúrguer ou versão compacta em telas estreitas) e
nos containers de conteúdo principal (garanta `w-full` ou equivalente
onde blocos estão encolhendo sem motivo).

Teste em pelo menos duas larguras: ~375px (celular comum) e ~768px
(tablet).

## 6. Hierarquia de cores

**Problema:** no mobile principalmente, blocos diferentes de conteúdo
se misturam visualmente — parece tudo a mesma coisa por falta de
contraste entre seções.

Reforce o uso de `background`, `surface` e `surface-subtle` (tokens já
existentes no design system) para criar separação visual clara entre
blocos de conteúdo adjacentes. Adicione bordas sutis (`border` token)
onde fizer sentido.

## 7. Erro de pré-requisito não cumprido — modal em vez de banner

**Problema:** hoje, ao tentar se inscrever em um módulo sem ter
concluído o pré-requisito, o erro aparece como banner no topo da
página. Isso deve virar um modal.

Novo comportamento:

- Modal com mensagem clara: "Você precisa concluir [módulo(s)] antes de
  se inscrever neste módulo."
- Se houver mais de um módulo pré-requisito faltando, lista todos, cada
  um como item clicável que leva à página de detalhe daquele módulo
  (onde o aluno pode se inscrever nele, se quiser).
- Botão "Cancelar" fecha o modal sem ação.
- **Cuidado com dependência transitiva:** se um módulo pré-requisito em
  si também depende de outro que o aluno não cursou, a mensagem deve
  deixar isso claro ou pelo menos não confundir — liste os
  pré-requisitos diretos que faltam (não precisa expandir a árvore
  inteira nesta iteração; se for simples adicionar uma nota tipo "este
  módulo também tem pré-requisitos próprios", inclua, mas não é
  obrigatório resolver navegação em cascata agora).

## 8. Home autenticada — resumo por papel

**Problema:** a página inicial não mostra nenhuma informação útil, é
praticamente vazia para todos os papéis.

Adicione um resumo contextual simples por papel:

- **Aluno:** matrículas ativas (quantidade), próxima aula (se houver
  dado disponível), certificados emitidos recentemente.
- **Professor:** turmas ativas, avaliações/aulas sem lançamento
  completo, se fizer sentido buscar isso facilmente.
- **Coordenação:** número de inscrições pendentes de aprovação (com
  link direto), trilhas publicadas, matrículas recentes.

Não precisa ser elaborado — 2-4 cards com números e um link para a
página relevante já resolve o problema de "página vazia".

## 9. Aluno — tela "Minhas Matrículas"

- Corrige a hierarquia de título/subtítulo (mesmo problema do item 2,
  mas confirme especificamente nesta tela).
- Troca o link de texto "Ver boletim" por um componente `Button`
  (variante secundária ou outline, o que já existir no design system).
  Hoje o texto quebra de forma feia ("Ver" numa linha, "Boletim" na
  outra) — como botão, isso deixa de ser problema porque o botão tem
  padding e não deveria quebrar da mesma forma; garanta que não quebra
  mesmo assim em telas estreitas (usa `whitespace-nowrap` se precisar).

## 10. Professor — clareza sobre peso das avaliações

**Problema:** não há limite de peso total das avaliações (isso é
intencional — mantém flexibilidade), mas isso pode confundir o
professor no dia a dia (ex.: pesos somando 15 sem ele perceber o que
isso significa na prática).

**Não adicione limite.** Em vez disso, adicione clareza visual: ao lado
de cada avaliação (na lista e no formulário de criar/editar), mostra
"representa X% da média final", calculado como
`peso_da_avaliacao / soma_de_todos_os_pesos_da_turma * 100`,
recalculado dinamicamente conforme avaliações são adicionadas, editadas
ou removidas.

## 11. Seeds — mais dados para testar telas do professor

O colega relatou dificuldade em testar a visão do professor por falta
de alunos matriculados nas turmas de teste. Revise os seeds atuais e
garanta que ao menos uma turma de cada módulo principal tenha 3-4
alunos matriculados com dados variados (alguns com notas parciais,
alguns sem, para exercitar os estados intermediários da tela do
professor).

Se precisar criar mais usuários de teste com papel `aluno` para isso,
siga o padrão de nomenclatura já usado (`@klass.dev`), documentando
quem são no `README.md`.

## 12. Coordenação — renomear "Despublicar"

Troca o texto do botão/ação "Despublicar" para **"Voltar para
rascunho"**, mais alinhado com o vocabulário comum de sistemas de
publicação de conteúdo. Ajusta em todos os lugares onde esse texto
aparece (lista de trilhas, tela de edição, mensagens de confirmação).

## 13. Coordenação — reordenar módulos por arrastar (drag-and-drop)

**Problema:** hoje reordenar módulos usa botões "subir"/"descer", que
fica inviável com muitos módulos (precisa clicar repetidas vezes para
mover um item do fim para o início).

Implemente drag-and-drop na lista de módulos dentro da tela de edição
de trilha. Bibliotecas leves compatíveis com React 18 e o restante do
stack (ex.: `@dnd-kit/core` — verifique compatibilidade antes de
instalar). Ao soltar, persiste a nova ordem chamando o RPC de
reordenação já existente (`catalogo.trocar_ordem_modulos` ou
equivalente, verifique o nome exato no código).

Mantenha os botões subir/descer como alternativa acessível (nem todo
usuário consegue arrastar com precisão, e leitores de tela não lidam
bem com drag-and-drop sem esses botões).

## 14. Coordenação — slug mais compreensível e editável

**Problema:** o campo "Slug" confunde coordenadores não-técnicos, e
hoje não é editável após a criação da trilha.

**Esclarecimento técnico para você (não é bug):** o vínculo entre
tabelas no banco é feito por UUID, nunca por slug — o slug é usado
apenas para compor a URL pública amigável
(`/catalogo/nome-da-trilha`). Editar o slug não quebra nenhuma
referência interna do sistema; o único efeito é que um link externo
antigo (se alguém salvou/compartilhou aquela URL) para de funcionar.

Ajustes:

- Renomeia o rótulo do campo de "Slug" para **"Endereço da página"**
  (ou nome equivalente mais claro).
- Adiciona um texto de ajuda pequeno abaixo do campo explicando em
  linguagem simples: "Esse texto aparece no link da trilha. Evite
  espaços e acentos. Mudar depois de publicado pode quebrar links já
  compartilhados."
- Torna o campo editável na tela de edição (hoje só é editável na
  criação). Ao editar, mostra um aviso inline (não bloqueante) alertando
  sobre o risco de quebrar links existentes — mas permite salvar mesmo
  assim, é decisão do coordenador.
- Mantém o botão "sincronizar com o nome" que já existe, como atalho.

## 15. Coordenação — ícone para trilha e módulo

**Problema:** o colega sentiu falta de elemento visual para reconhecer
trilhas/módulos rapidamente, sem precisar ler todo o texto.

Implemente com ícones (não upload de imagem — mantém escopo simples e
evita configurar Supabase Storage agora):

- Adiciona coluna `icone text` em `catalogo.trilhas` e
  `catalogo.modulos` (nome do ícone da biblioteca `lucide-react`, que já
  está no projeto).
- No formulário de criar/editar trilha e módulo, adiciona um seletor de
  ícone (uma grade pequena com uns 20-30 ícones relevantes ao domínio
  educacional — livro, gráfico, código, calculadora, etc. — não precisa
  cobrir a biblioteca inteira).
- Exibe o ícone escolhido nos cards de listagem (catálogo público,
  lista de trilhas da coordenação, cards de módulo).
- Se nenhum ícone for escolhido, usa um ícone padrão neutro.

Migration necessária para as duas colunas novas — lembre de regenerar
tipos depois.

## 16. Coordenação — texto de ajuda sobre as descrições

**Problema:** existem dois campos de descrição (curta e completa), mas
não fica claro pra quem preenche onde cada uma aparece.

Adiciona um texto de ajuda pequeno abaixo de cada campo no formulário:

- Descrição curta: "Aparece nos cards do catálogo, onde o aluno navega
  entre várias trilhas. Seja breve (até ~150 caracteres)."
- Descrição completa: "Aparece na página de detalhe da trilha, quando o
  aluno já demonstrou interesse. Pode ser mais detalhada."

## 17. Coordenação — remover aluno de uma turma

**Feature nova, pequena e bem delimitada.** Hoje só existe cancelamento
pelo próprio aluno (antes da aprovação) ou rejeição pela coordenação
(também antes da aprovação). Não existe forma de desligar um aluno já
**matriculado**.

Adiciona:

- Na tela `/coordenacao/turmas/:id`, na lista de alunos matriculados,
  um botão "Remover da turma" por aluno.
- Ao clicar, confirmação inline (padrão já estabelecido no projeto,
  nunca `window.confirm()`) pedindo motivo (texto livre, obrigatório,
  igual ao padrão de rejeição de matrícula).
- Ação transiciona a matrícula para status `cancelada`, preenchendo o
  motivo e os campos de auditoria disponíveis (reaproveite os campos
  que já existem para encerramento se fizer sentido semântico; se não
  fizer, adicione campos próprios — decida pelo que for mais coerente
  com o schema atual e documente a escolha).
- RLS: só coordenação pode executar essa ação.
- Aluno vê, na própria tela de matrículas, que foi removido e o motivo.

## Fora de escopo (não implementar neste prompt)

Os itens abaixo foram considerados e **propositalmente adiados**:

- **Pré-requisito entre módulos de trilhas diferentes.** Hoje o sistema
  só permite pré-requisito dentro da mesma trilha (decisão do MS2, com
  trigger anti-ciclo que assume esse limite). Permitir cruzamento exige
  detecção de ciclo bem mais complexa entre trilhas. Fica para uma
  decisão futura caso apareça necessidade curricular real.
- Página dedicada por módulo com mais informações e imagens, ou redesign
  da listagem de turmas na página da trilha (expandir em vez de navegar).
- Modo escuro.
- Painel de administrador para configurar cores, imagens, favicon do
  sistema.
- Home page para usuário deslogado.
- Sistema de template de trilha (coordenação cria, professor herda) com
  fluxo de solicitação de liberação por e-mail.
- Bloqueio de edição de chamada já registrada (regra de negócio que
  merece discussão própria antes de implementar).

Se durante o trabalho você achar que algum desses é trivial de incluir
de forma isolada sem inflar escopo, pode sinalizar no relatório final,
mas não implemente sem confirmação.

## Regras que valem para tudo

Reafirmando o `CLAUDE.md`:

- Vocabulário: "módulo" e "bounded context", nunca "microsserviço".
- RLS habilitada em qualquer tabela/coluna nova.
- Nenhuma confirmação destrutiva via `window.confirm()` — sempre inline.
- Comentários em português explicando o porquê.
- Antes de cada correção, **verifique o estado atual no navegador** —
  não assuma que o bug ainda existe só porque está nesta lista.
- Ícones vêm de `lucide-react` (já instalado). Novas bibliotecas (como
  `@dnd-kit`) devem ser leves e compatíveis com React 18 — confirme
  antes de instalar.

## Ao terminar, me entregue

1. **Para cada item numerado (1-17):** confirmação do que foi feito, ou
   nota de que já estava correto e foi pulado.
2. **Causa raiz do bug de performance** (item 1) — não só a correção,
   mas o diagnóstico.
3. **Descrição visual** das mudanças de layout mais significativas
   (cabeçalho, home com resumo, modal de pré-requisito).
4. **Migrations novas**, se houver (ícones, remoção de aluno).
5. **Qualquer ambiguidade ou decisão própria** que tenha tomado.
6. `pnpm typecheck` e `pnpm build` limpos, CI verde.
7. Commits organizados por tema (não precisa ser um por item — agrupe
   por área: "fix: performance de navegacao", "design: hierarquia
   tipografica e layout desktop", "ux: cabecalho reorganizado",
   "feat: modal de pre-requisito", "feat: home com resumo por papel",
   "ux: slug editavel e paginas de trilha/modulo com icone",
   "feat: drag-and-drop de modulos", "feat: remover aluno de turma",
   etc — a critério de quem estiver organizando, mas mantenha lógico).
8. `git push` ao final, já que isso vai para produção via Cloudflare
   Pages automaticamente.

Não é preciso "parar" em nenhum módulo novo — esta é uma rodada de
ajuste sobre o que já existe.
