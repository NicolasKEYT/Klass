# Prompt 12 — Revisão Completa do Feedback Original (segunda rodada)

Você vai revisar, item por item, **todo** o texto de feedback original de
um colega que testou o sistema (o mesmo que gerou o Prompt 09, executado
há algumas rodadas). Isso é uma auditoria, não uma nova rodada de
implementação — para cada ponto, você confirma o estado atual em
produção e reporta. Só implemente algo se for claramente um bug (algo
que deveria funcionar e não funciona) ou uma correção pequena e óbvia;
qualquer coisa maior, reporte e aguarde instrução.

Leia o `CLAUDE.md` antes de começar.

## Por que revisar de novo

O Prompt 09 endereçou a maior parte deste feedback, mas desde então o
sistema passou por: uma rodada de QA de regressão completa, uma reforma
visual inteira, e mais alguns ajustes pontuais. Alguns itens podem ter
regredido, outros podem ter sido resolvidos de forma incompleta (o
colega às vezes descrevia um problema com nuance que o Prompt 09 pode
não ter capturado inteiramente). Além disso, vários itens ficaram
deliberadamente represados como backlog — vale reconfirmar se continuam
fazendo sentido como "não agora" ou se algo mudou.

## O texto original completo (referência)

```
Ajustar/Ideias:
carregamento toda vez que muda de aba no navegador (alem disso aparece
carregando toda vez que muda de aba e demora muito, talvez ja ir
montando a pagina ao inves de montar, mas sinto que o problema é maior
porque esta demorando bastante, talvez esteja sem nenhum cache porque
acontece toda vez, cerca de 1~2 segundos para carregar completamente
tanto quando troca de aba ou quando clica para abrir outra)

UX/UI esta horrivel (a home page nao tem informacao nenhuma das views
(aluno/professor/cordenacao) (talvez trazer as informacoes mais
importantes para o dia e para a semana (trazendo um resumo de algo
voltado para cada view - desenvolver melhor essa ideia), a hierarquia
dos textos e dos botoes esta completamente errada ou estranha (as
vezes o titulo ou subtitulo esta menor que o texto normal - acontece
bastante)

o erro de quando tenta se inscrever em algo que a pessoa nao concluiu
os modulos nescessarios esta aparecendo la em cima da pagina - trocar
por um popup falando do erro e se a pessoa quer ser redirecionado para
a pagina do modulo necessario (se tiver mais de um apresente uma lista
para a pessoa poder clicar para ir para qual ela quer - alem disso nao
esquecer do botao de cancelar para fechar o popup (tomar cuidado
porque as vezes um modulo que a pessoa nao fez tem dependencia de
outro anterior - desenvolver melhor essa ideia para melhorar a UX/UI)

o visual esta muito mobile e no computador esta terrivel, esta tudo em
cerca de 30% da tela, seria mais interessante conseguir espacar mais
as coisas e aproveitar mais a tela do computador tambem (que vai ser o
uso diario pelo menos do professor e da coordenacao)

acho que tudo (menos a logo) estar na direita do header nao ficou bom,
parece que tudo la é um botao clicavel, eu colocaria as opcoes
clicaveis no meio ou para a esquerda e deixaria o nome, titulo e o
sair para a direita, pensar na melhor solucao)

a responsividade para o celular em boa parte das coisas nao esta
funcionando, principalmente o header e algumas vezes os blocos de
informacao da parte principal nao vai ate a direita da tela

a hierarquia de cores tambem esta ruim principalmente no celular fica
parecendo que é tudo a mesma coisa e sao textos diferentes de blocos
diferentes que juntaram por causa do celular


Aluno:
Minhas Matriculas -
Hierarquia dos titulos e subtitulos esta errada aqui tambem
o ver boletim poderia ser um botao ao inves de um texto clicavel e ele
esta quebrado na questao do texto porque na linha de cima esta ver e
na de baixo boletim

Professor: (tem que adicionar alunos nas turmas para conseguir
visualizar melhor e conseguir testar melhor)
Na parte de avaliacoes a parte de pesos esta muito estranha porque tem
como ficar com mais de 10 (adicionei mais uma avaliacao e agora ele
esta com 15 de peso total, pode ate funcionar no final mas pode ficar
complexo para o dia a dia do professor)

Coordenacao:
no trilhas esta escrito despublicar (ficou ruim troque a palavra para
algo mais usual)
dentro da trilha acho que poder arrastar pode fazer mais sentido
porque quando tiver mais de 10 e a pessoa quiser colocar em primeiro
ela teria que clicar e esperar 10 vezes para conseguir colocar no
comeco da lista
nem todo modulo vai depender de outros modulos que estao dentro da
trilha em especifico, pode ser que seja nescessario adicionar um
modulo ou uma trilha inteira para outra parte de outra trilha que nao
tem muito haver as vezes nem na categoria
a parte do slug ficou sem sentido, boa parte das pessoas que vao
utilizar o sistema nao sabem oque é um slug e acho perigoso nao poder
modificar o nome (nao sei se a vinculacao com as outras coisas esta
pelo nome se estiver rever completamente para utilizar somente IDs,
tanto por questao de seguranca quanto por uso no dia a dia se a pessoa
escreve o nome errado ou se precisa modificar algo no nome (que é
completamente normal) ela nao seja bloqueada)
acho interessante conseguir trazer mais de uma descricacao mas ainda
acredito que falta cor e estilizacao/imagens entao talvez trazer a
possibilidade de trazer algum tipo de icone ou imagem para ser o
"avatar" da trilha ou do modulo talvez fosse interessante para
reconhecer tudo de forma mais visual do que ter que ficar lendo tudo
para achar o que precisa, alem disso acho interessante trazer algum
descricacao explicando de forma bem simples e rapida tanto a
descricao curta como a complexa e onde que elas sao utilizadas para a
pessoa conseguir enteder e se mapear melhor


Pensar: (algumas ideias que eu tive)
acho que seria interessante cada modulo tem uma pagina demonstrado e
trazendo mais informacoes sobre o modulo em si porque sinto que seria
mais interessante conseguir colocar mais informacoes e trazer algumas
imagens talvez, alem disso em um uso real talvez fique muito ruim a
listagem de turmas direto na pagina da trilha da forma que esta
porque vai aparecer muita coisa de forma desnecessaria e para quem
esta no celular teria que escrolar muito para conseguir chegar la
embaixo - talvez ao inves de abrir uma pagina separada para cada
modulo fazer algo que expanda quando clica no bloco do modulo em
especifico, no final é para trazer algo visualmente melhor e mais
adequado aos dias atuais (aceito sugetoes)

trazer modo escuro - talvez

talvez trazer mais uma view de administrador de tudo (podendo ter
mais de um) para ter uma pagina de configuracoes do sistema para
poder modificar as cores, as imagens, favicon, e tudo que for
nescessario e que seja funcional e se der no futuro a integracao com
o moodle ou qualquer outra integracao tem que passar pelo usuario
desse cara

uma home page para quando nao esta logado (nao sei se faz sentido nos
desenvolvermos isso porque cada pessoa que for usar o sistema vai
fazer isso de forma diferente mas a gente pode ter um tamplate que se
ajusta conforme o coordenador ou admin (pensar nesse cargo) for
adicionando no futuro de forma automatizada e que seja facilmente
modificada

professor:
existe a parte da turma que quem cuida é o professor mas acredito que
faca sentido pensar em algo que para o coordenador criar um
curso/trilha com os modulos como um template e o professor ja pega
"pronto" e se ele quiser fazer alguma modificacao acredito que faca
sentido ter como clicar em um botao para pedir para o coordenador
liberar por email ou algo parecido (pensar sobre - aceito sugestoes)

trazer algum bloqueio na parte de chamadas para nao poder modificar
toda hora qualquer chamada - pensar (regra de negocio)

coordenador:
poder remover alunos de cursos
```

## O que fazer

Percorra o texto acima **de cima a baixo, item por item** (cada
parágrafo é um item distinto). Para cada um, em produção
(`klass-91y.pages.dev`):

1. **Verifica o estado atual** — reproduz a situação descrita, com a
   conta de papel apropriada.
2. **Classifica** em uma das três categorias:
   - **Resolvido e confirmado** — funciona como o colega pediu, testado
     agora.
   - **Resolvido, mas com ressalva** — foi endereçado, mas ao revisar
     com espírito crítico você percebeu que a solução não cobre
     inteiramente a nuance do que foi pedido. Explique a lacuna
     específica.
   - **Não implementado (backlog)** — item que ficou deliberadamente
     fora de escopo. Confirme que a decisão de adiar continua fazendo
     sentido, ou sinalize se algo mudou.

Preste atenção redobrada nestes pontos, que têm nuance fácil de
escapar:

- **Peso das avaliações.** O colega não pediu limite — ele descreveu
  uma sensação de "complexo para o dia a dia" mesmo com o indicador de
  porcentagem já implementado. Avalie com olhar crítico se o indicador
  atual resolve isso de verdade ou se ainda falta algo (por exemplo, um
  aviso quando o total de pesos está "estranho" sem impedir o
  professor de prosseguir).
- **Slug.** Foi renomeado para "Endereço da página" e tornado editável.
  Mas o comentário original também questionava se a *vinculação interna*
  usa nome ou ID — isso já foi esclarecido como sendo por ID desde
  sempre. Confirme mais uma vez, agora com uma consulta direta ao
  schema, que nenhuma foreign key ou lógica de negócio referencia por
  slug ou por nome em lugar nenhum do sistema.
- **Pré-requisito entre trilhas diferentes.** Esse item ficou como
  decisão consciente de adiar (a explicação já está registrada no
  histórico do projeto). Só confirme que a decisão continua de pé — não
  implemente.
- **Bloqueio de edição de chamada.** Backlog, não implementar. Só
  confirme que o comportamento atual (edição sempre permitida) é
  intencional e não uma regressão de outra coisa.

Para os itens da seção "Pensar" (página dedicada de módulo, modo
escuro, painel de administrador, home pública para deslogado, template
de trilha herdado pelo professor) — **não implemente nada**. Apenas
reafirme que continuam como backlog e, se tiver uma opinião sobre
prioridade relativa entre eles a esta altura do projeto, inclua no
relatório como sugestão.

## Ação de limpeza (condicional)

Se, e somente se, o usuário já tiver confirmado que o restante da
equipe parou de criar dados de teste em produção, execute a limpeza
pendente do QA anterior: remove a trilha "Teste 22/09", a turma
"MODTEST-2026-1", a matrícula extra criada hoje no `aluno.teste`, e as
duas contas avulsas identificadas (`nicolas@teste.com`,
`[REDIGIDO: e-mail pessoal]`). Se não houver confirmação explícita
disso na sua instrução, **não limpe** — apenas relate que a limpeza
continua pendente.

## Regras que valem para tudo

- Isso é revisão, não uma nova rodada de feature. Resista à vontade de
  "aproveitar e melhorar" algo que não está na lista.
- Se corrigir algo (bug genuíno encontrado durante a revisão), siga os
  padrões já estabelecidos e documente causa raiz.
- Teste em produção, com as contas reais.

## Ao terminar, me entregue

Uma tabela ou lista, na mesma ordem do texto original, com: item →
classificação → nota. Ao final, um resumo de quantos itens estão em
cada categoria, e se algum "resolvido com ressalva" merece virar um
prompt de ajuste focado antes de abrirmos a avaliação SUS para pessoas
de fora.
