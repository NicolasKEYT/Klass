# Prompt 17 — Fidelidade Visual Estrita ao UI Kit (correção)

O Prompt 16 reconstruiu a estrutura e a navegação corretamente, mas o
resultado **não bate visualmente** com o documento — cores, formatos e
detalhes de layout ficaram diferentes do que as imagens mostram. Este
prompt é uma correção: **comparação direta, tela a tela, entre o que
está em produção e a imagem correspondente no PDF**, ajustando até
bater. Leia o `CLAUDE.md` antes de começar.

## Regra de trabalho para este prompt

Para cada tela abaixo: (1) abra a tela em produção e tire um screenshot;
(2) coloque lado a lado (mentalmente ou de fato) com a imagem
correspondente no PDF; (3) liste toda diferença de cor, formato,
espaçamento ou elemento; (4) corrija; (5) tire novo screenshot e
confirme que bateu antes de passar para a próxima tela. Não avalie por
"ler a especificação em texto de novo" — o texto já foi lido no Prompt
16 e o resultado não bateu. **A imagem é a fonte de verdade desta vez.**

## Escopo: o que ignorar, o que não ignorar

**Ignore a Seção 1 ("Quem vai usar")** — são estatísticas do Brasil que
justificam decisões, não têm instrução de design.

**Todo o resto do documento tem implicação de design e precisa ser
conferido**: Seção 2 (mercado), a tabela de decisões D1–D15 na Seção 3,
o diagnóstico na Seção 4, a página de Fundamentos, e as 7 telas de
alta-fidelidade.

## Esclarecimento sobre cor (importante, evita reler errado)

O documento diz que os wireframes são propositalmente em cinza e que "a
paleta sai depois" (D15). **Isso descreve os wireframes de baixa
fidelidade, não as 7 telas de alta-fidelidade anexadas** — essas já
mostram uma paleta real e específica, e é isso que este prompt pede
para seguir à risca:

- **Fundo de página**: cinza muito claro e quente (não branco puro, não
  cinza frio).
- **Fundo de card**: branco.
- **Texto principal**: preto/quase-preto.
- **Texto secundário/metadado**: cinza médio.
- **Ações e estados primários/ativos** (botão principal, badge de
  "Concluído"/"Matriculado", toggle "Presente" quando ativo, trecho
  preenchido da barra de progresso): **preenchimento preto sólido**,
  texto branco. **Não azul.**
- **Ações e estados secundários/inativos** (botão "Ver", badge
  "Cursando", toggle "Falta" quando inativo): fundo branco, borda preta
  fina, texto preto.
- **Único acento azul do sistema inteiro**: o indicador de seleção
  (círculo de rádio marcado) na tela "Escolha a turma". Em nenhum outro
  lugar aparece azul nas telas de alta-fidelidade. Use o azul que já
  está documentado nos próprios arquivos do projeto como candidato
  (`#0A84FF`, citado no diagnóstico do PDF junto com preto) — não o
  azul atual do Tailwind (`#2563EB`) usado antes da reforma.
- **Badges de atenção** ("Abaixo da média", "Chamada pendente", "Média
  e frequência"): **não são vermelhos nem amarelos**. São brancos com
  borda preta e ícone de alerta (triângulo), mesma família visual dos
  demais badges — só o ícone muda.
- **Os círculos laranja com "D1" a "D15"** são anotação de
  rastreabilidade do próprio documento para a defesa do TCC — **não
  fazem parte da interface do produto**. Não renderize esses círculos
  na aplicação real. A rastreabilidade fica em comentário no código
  (já feito no Prompt 16); se algo colorido "de anotação" vazou para a
  UI de produção, remova.

## Esclarecimento sobre formato (formas dos elementos)

- **Cards**: borda sólida visível (1–2px, tom escuro), cantos
  arredondados moderados. **Sem sombra de elevação** — se a reforma
  visual anterior (a rodada "flat/moderno" de antes do UI Kit) deixou
  sombras nos cards, remova-as aqui; o padrão do UI Kit é borda, não
  sombra.
- **Badges de status**: formato de pílula (cantos totalmente
  arredondados), sempre ícone + texto.
- **Toggle Presente/Falta**: um controle segmentado único, as duas
  opções coladas uma na outra sem espaço entre elas (não dois botões
  separados).
- **Barra de progresso do "próximo passo"** (início do aluno):
  segmentada em blocos distintos (um por módulo da trilha), não uma
  barra contínua de porcentagem.
- **Indicador de meta (bullet chart)**: barra horizontal única, com um
  traço vertical fino marcando o valor mínimo/meta.
- **Botão de rádio** (escolha de turma): círculo verdadeiro, preenchido
  com o azul de acento quando selecionado.
- **Avatares**: círculos com iniciais do nome.

## Esclarecimento sobre layout

- **Barra lateral**: largura fixa por volta de 240–260px, tom de fundo
  levemente diferente da área de conteúdo.
- **"Hoje" (professor)**: duas colunas — esquerda mais larga (aulas do
  dia), direita mais estreita (pendências, depois alunos que pedem
  atenção).
- **Grade de notas**: cabeçalho de cada coluna de avaliação mostra
  nome, peso e status de publicação/lançamento como texto secundário
  abaixo do nome (mesmo sem implementar D7, mantenha esse padrão visual
  de cabeçalho com duas linhas de texto).
- **"Precisa de você" (início da coordenação)**: cards em linha, largura
  igual entre eles, no desktop.
- **Chamada**: avatar + nome à esquerda de cada linha, toggle à direita,
  ocupando a largura total do card.

## Roteiro de verificação, tela a tela

Para cada uma, abra a tela real em produção e compare com a imagem
correspondente no PDF:

1. **Fundamentos** (não é uma tela navegável, mas confira nos
   componentes): tokens de cor da paleta acima aplicados em
   `tailwind.config.ts`; badges de status na cor certa (preto sólido
   para positivo, contorno para os demais, nunca vermelho/amarelo).
2. **Navegação por papel**: barra lateral com a cor de fundo certa;
   item ativo destacado em preto (não azul); rodapé com nome + papel.
3. **Hoje (professor)**: confira cor dos badges "Chamada feita"
   (positivo, preto) vs "Chamada pendente" (alerta, contorno); botões
   "Fazer chamada" (preto sólido) vs "Ver" (contorno).
4. **Início (aluno, mobile)**: card principal com fundo branco e borda
   visível; botão "Ver boletim" preto sólido; barra de progresso
   segmentada (não contínua); barra de frequência com o traço de meta.
5. **Boletim**: badges "Concluído" (preto sólido) vs "Cursando"
   (contorno) vs "Bloqueado" (contorno, tracejado conforme a imagem);
   card do certificado com botão "Baixar PDF" no estilo certo conforme
   o estado (liberado vs. bloqueado).
6. **Detalhe de módulo/inscrição**: pré-requisitos com ícone de check
   (concluído) ou relógio (cursando); rádio de seleção de turma em
   azul quando marcado; botão "Inscrever-se" desabilitado no estilo
   tracejado quando bloqueado, como a imagem mostra.
7. **Chamada**: toggle segmentado Presente/Falta colado, preto quando
   ativo; contadores "presentes"/"faltas" no topo com fundo neutro
   sutil, não card branco com borda.
8. **Avaliações e notas**: cabeçalho de coluna com peso e status;
   badges de situação (Abaixo da média, Média e frequência) no estilo
   de alerta correto (contorno + ícone, não vermelho); inputs de nota
   sem moldura pesada de tabela tradicional.
9. **Início (coordenação)**: cards "Precisa de você" em linha igual;
   indicadores com barra e traço de meta (não velocímetro, não pizza);
   tabela "Turmas em andamento" com barra de ocupação no formato
   certo.
10. **Turmas/Inscrições**: confira que os botões de ação (Aprovar/
    Rejeitar) seguem o padrão preto sólido/contorno; se o painel lateral
    de detalhe do aluno foi implementado, confira o estilo; se não foi
    (decisão já tomada no Prompt 16), sem problema, não é objeto desta
    correção.

## O que não mexer

Isso é correção visual, não mudança de comportamento. Não altere
lógica de negócio, RLS, ou dados. Se, ao comparar uma tela, encontrar
uma diferença que pareça ser de **conteúdo/comportamento** (não visual),
não mude — anote e pergunte.

Continua valendo a exclusão do D7 (não implementar lançar/publicar
separado) e das demais exclusões já definidas no Prompt 16 (Pessoas,
lote de aprovação, exportar CSV, "avise-me", aulas automáticas).

## Regras que valem para tudo

- Ajuste os tokens centrais (`tailwind.config.ts`, componentes
  atômicos como `Button`, `Card`, `StatusBadge`) sempre que a correção
  for a mesma em várias telas — não corrija tela por tela o que devia
  ser corrigido uma vez no componente compartilhado.
- Teste em produção ao final, nos três papéis, desktop e mobile.
- `pnpm typecheck` e `pnpm build` limpos.

## Ao terminar, me entregue

1. Para cada uma das 10 telas do roteiro: o que estava diferente e o
   que foi corrigido (ou confirmação de que já batia).
2. A paleta final de cores aplicada, com os valores hexadecimais.
3. Screenshots (ou descrição visual detalhada) do antes/depois nas
   telas que mais mudaram.
4. Confirmação de que os círculos de rastreabilidade D1-D15 não
   aparecem na interface real, só em comentário de código.
5. `pnpm typecheck` e `pnpm build` limpos, CI verde.
6. Commits organizados, `git push` ao final.
