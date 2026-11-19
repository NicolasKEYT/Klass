# Prompt 10 — Reforma visual (flat / modern design)

Você vai atualizar a "pele" visual do Klass inteiro. Leia o `CLAUDE.md`
na raiz antes de começar. Este prompt **não** muda arquitetura, schema,
lógica de negócio, nem a estrutura das telas — é reforma puramente
visual.

## Contexto

O sistema está funcionalmente completo (MS1-MS5, em produção) e passou
por uma rodada de polimento de UX recente (hierarquia tipográfica,
layout desktop, cabeçalho reorganizado, ícones). Apesar disso, o visual
geral ainda passa uma impressão datada — "parece tema de WordPress
genérico" foi o feedback recebido. O objetivo agora é uma reforma de
estilo visual para um padrão flat/moderno (referência de estilo:
produtos como Linear, Stripe Dashboard, Vercel — superfícies lisas,
sombras sutis, tipografia como elemento central, espaçamento generoso).

## O que NÃO muda

- **Paleta de cores** — mantém os tokens semânticos já definidos em
  `tailwind.config.ts` (`primary`, `background`, `surface`, `success`,
  `danger`, etc.). Isso é reforma de "textura", não de cor.
- **Estrutura das telas** — nenhuma tela ganha ou perde seção, nenhum
  fluxo muda. O que está em cada tela continua lá, só com aparência
  diferente.
- **Comportamento e lógica** — nenhuma regra de negócio, validação ou
  fluxo de dados é alterado.

## O que muda: diagnóstico e correção

Antes de editar qualquer componente, faça uma auditoria visual rápida
abrindo as telas principais no navegador (home, catálogo, uma tela de
formulário da coordenação, o boletim do aluno) e documente no início do
seu resumo final quais dos sintomas abaixo você encontrou de fato —
não assuma que todos estão presentes, confirme visualmente.

Sintomas típicos de "visual datado" a caçar e corrigir:

### 1. Sombras

Sombras de `box-shadow` genéricas do navegador ou padrão do Tailwind
sem calibração (`shadow-md`, `shadow-lg` usados sem critério) tendem a
ficar pesadas e cinzentas, com aparência de "card flutuando errado".

Corrija com uma escala de sombra própria, sutil, calibrada
especificamente para este projeto — normalmente 2-3 níveis bastam
(repouso, hover, elevado/modal). Prefira sombras com blur maior e
opacidade baixa (ex.: `0 1px 2px rgba(0,0,0,0.04), 0 2px 8px
rgba(0,0,0,0.04)`) em vez dos defaults do Tailwind. Registre essa
escala como tokens novos no `tailwind.config.ts` (ex.:
`shadow-card`, `shadow-elevated`), não como valores soltos espalhados
pelo código.

### 2. Bordas

Bordas grossas (`border-2`, cores escuras demais) em cards, inputs e
containers são um dos maiores culpados da aparência antiga.

Corrija: prefira bordas finas (`border` = 1px) com cor bem próxima do
fundo (o token `border` já existente, calibre se necessário para ficar
mais sutil), ou elimine borda em favor de diferença de tom entre
`surface` e `background` onde fizer sentido (deixa o componente "flutuar"
por contraste de superfície em vez de contorno).

### 3. Raio de borda (border-radius)

Verifique consistência entre os tokens `klass-badge`, `klass-control`,
`klass-card`, `klass-pill` já existentes — confirme que estão sendo
aplicados de fato, e não sobrescritos manualmente em componentes
específicos. Se algum componente estiver com raio 0 (quadrado) ou raio
exagerado (pill em lugar errado) fora do padrão, corrija para usar o
token correto.

### 4. Botões

Verifique se algum botão tem gradiente, sombra interna, ou efeito de
"relevo 3D" (comum em temas antigos). Botões devem ser cor sólida flat,
com no máximo uma sombra sutil de elevação (se o token de sombra do
item 1 pedir), e uma transição suave de cor no hover/active (sem
efeito de "afundar" ou brilho).

Revise os estados: repouso, hover, active/pressed, disabled, loading.
Cada um deve ter uma diferença visual clara mas sutil (ex.: hover
escurece levemente a cor de fundo, disabled reduz opacidade).

### 5. Espaçamento interno (padding) e entre elementos (gap)

Se cards, formulários e listas estiverem com padding apertado (visual
"espremido"), aumente para dar mais respiro. Já existe o token de
padding de card do sistema de design (verifique o valor atual em
`tailwind.config.ts` — algo em torno de 22px foi estabelecido no MS2);
confirme que está sendo aplicado consistentemente e considere se vale
aumentar ligeiramente para reforçar a sensação de espaço.

Entre seções de uma página (não dentro de um componente, mas entre
blocos), garanta espaçamento vertical generoso e consistente — evite
blocos colados um no outro.

### 6. Tipografia

Reforce a hierarquia de peso de fonte (não só tamanho, que já foi
ajustado na rodada anterior): títulos devem usar peso mais alto
(semibold ou bold) claramente distinto do peso do corpo (regular ou
medium). Verifique se a família tipográfica (`IBM Plex Sans`) está
sendo aplicada consistentemente ou se algum componente caiu no
fallback do navegador.

Considere reduzir levemente o peso de textos secundários/metadados
(usar `text-secondary`/`text-muted`, tokens já existentes) para reforçar
contraste com o texto principal.

### 7. Inputs e formulários

Campos de formulário com aparência "antiga" costumam ter: borda grossa,
fundo cinza escuro, estado de foco pouco visível ou com o azul padrão
do navegador (não o token do projeto).

Corrija: fundo `surface` ou branco, borda fina, e um estado de foco
claro e intencional (ex.: anel de foco usando a cor `primary` com
opacidade, `ring-2 ring-primary/20` ou equivalente, mais borda
`primary` sólida). Isso deve ser feito no componente `Input` atômico,
propagando para todos os formulários automaticamente.

### 8. Ícones

Confirme que todos os ícones usados são da biblioteca `lucide-react`
(estilo linear, traço fino, consistente) e que o tamanho é padronizado
entre contextos semelhantes (ex.: ícone dentro de botão sempre no mesmo
tamanho, ícone de card sempre no mesmo tamanho). Ícones de tamanhos
soltos e inconsistentes contribuem para a sensação de falta de cuidado
visual.

### 9. Cards e superfícies

Revise o componente `Card` atômico como a peça central desta reforma —
ele é usado em quase toda tela. Aplique ali as correções de sombra
(item 1), borda (item 2), raio (item 3) e padding (item 5) de forma
centralizada, para que a mudança se propague para o sistema inteiro sem
precisar editar cada tela individualmente.

### 10. Estados vazios e de carregamento

Se algum estado vazio ("nenhuma trilha encontrada", "nenhuma matrícula
ainda") ou de carregamento estiver com aparência crua (texto simples
sem estilo, ou spinner genérico do navegador), padronize com um
componente visual consistente com o resto do sistema — não precisa ser
elaborado, só coerente com a nova linguagem visual.

## Ordem de execução recomendada

1. **Componentes atômicos primeiro** (`Button`, `Card`, `Badge`,
   `Input`, e qualquer outro em `apps/web/src/components/`). Como são
   reusados em praticamente toda tela, corrigir aqui propaga a mudança
   automaticamente para a maior parte do sistema.
2. **Tokens do `tailwind.config.ts`** — ajuste ou adicione os tokens de
   sombra, e confirme que os já existentes (raio, cor, espaçamento)
   estão calibrados como descrito acima.
3. **Cabeçalho e navegação** — é o elemento mais visível em toda tela
   autenticada, vale atenção extra para não ficar destoante do resto.
4. **Varredura tela por tela** — depois dos componentes atômicos
   corrigidos, percorra as telas principais (home, catálogo, detalhe de
   trilha, formulários de coordenação, boletim do aluno, diário do
   professor) e corrija qualquer elemento que não esteja usando os
   componentes atômicos (ex.: um botão feito na mão em vez do
   componente `Button`, um card customizado fora do padrão).

## Validação

Depois das mudanças, percorra visualmente (screenshot ou navegação
direta) pelo menos estas telas, em desktop e em mobile (~375px):

- Home autenticada (todos os três papéis, se o conteúdo mudar por
  papel)
- `/catalogo` e detalhe de uma trilha
- Um formulário da coordenação (nova trilha ou editar trilha)
- `/aluno/matriculas` e o boletim de uma matrícula
- Diário do professor (abas de avaliações/aulas/alunos)
- Tela de login/cadastro

Para cada uma, confirme visualmente que sombras, bordas, espaçamento e
tipografia estão consistentes com a nova linguagem, e que nada quebrou
funcionalmente (cliques, formulários, navegação continuam funcionando
como antes — isso é reforma de estilo, não retrabalho de lógica).

Rode `pnpm typecheck` e `pnpm build` ao final. Devem passar limpos —
mudanças de classe CSS/Tailwind não deveriam gerar erro de tipo, mas
confirme mesmo assim.

## Regras que valem para tudo

Reafirmando o `CLAUDE.md`:

- Não altere paleta de cores, apenas a aplicação visual dela (sombra,
  borda, espaçamento, peso tipográfico).
- Não altere estrutura de nenhuma tela, fluxo ou lógica de negócio.
- Centralize mudanças nos componentes atômicos sempre que possível, em
  vez de editar estilo repetido em cada tela.
- Documente qualquer token novo adicionado ao `tailwind.config.ts` com
  comentário explicando o uso.
- Se, ao auditar, você achar que algum ajuste exigiria mudar estrutura
  de tela (não só estilo) para ficar bom, **não faça** — sinalize no
  relatório final em vez de expandir escopo por conta própria.

## Ao terminar, me entregue

1. **Diagnóstico**: quais dos 10 sintomas listados você de fato
   encontrou no sistema atual (pode não ser todos).
2. **Resumo do que foi mudado**, por componente/arquivo — com foco nos
   componentes atômicos primeiro.
3. **Tokens novos ou recalibrados** no `tailwind.config.ts`, com os
   valores antes/depois se relevante.
4. **Descrição visual** do antes/depois nas telas mais impactadas
   (cabeçalho, cards, formulários).
5. Qualquer coisa que você sinalizou como "precisaria mudar estrutura,
   fora de escopo deste prompt" — não implementada, só listada.
6. `pnpm typecheck` e `pnpm build` limpos, CI verde.
7. Commits organizados por tema (ex.: "design: tokens de sombra e
   componentes atomicos", "design: cabecalho e navegacao",
   "design: formularios e inputs", "design: varredura final de telas").
8. `git push` ao final — vai para produção via Cloudflare Pages
   automaticamente.
