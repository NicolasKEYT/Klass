# Prompt 11 — QA de Regressão Completa (pré-avaliação SUS)

Você vai fazer uma varredura completa de qualidade em todo o sistema Klass,
em **produção**, antes de usuários reais começarem a avaliação de
usabilidade (SUS). Leia o `CLAUDE.md` na raiz antes de começar.

## Contexto

MS1 a MS5 estão implementados, o sistema passou por uma rodada de 17
correções de UX/UI e por uma reforma visual completa (flat/moderno).
Tudo está em produção: `https://klass-91y.pages.dev` (frontend) e
`https://klass-workers.[REDIGIDO: conta].workers.dev` (Workers).

Em breve, pessoas reais (fora da equipe) vão usar o sistema em produção
para responder um questionário SUS. **Um bug encontrado por um
avaliador durante esse teste contamina os dados de usabilidade** — a
pessoa pode dar nota baixa por causa de um erro técnico, não por causa
de um problema genuíno de usabilidade. Este prompt existe para pegar
esses problemas agora, antes que aconteça.

## Objetivo

Não é para adicionar nada novo. É para:

1. Testar cada módulo, cada papel, e os fluxos que já foram validados
   antes — em produção, não local — e confirmar que nada quebrou entre
   as várias rodadas de mudança.
2. Corrigir bugs genuínos que encontrar, seguindo os padrões já
   estabelecidos no projeto.
3. Deixar os dados de demonstração (seeds) em um estado apresentável —
   sem lixo de testes anteriores, com exemplos de cada estado possível
   (matrícula pendente, aprovada, concluída, reprovada, certificado
   emitido) para que qualquer pessoa que for avaliar tenha o que ver em
   cada tela.
4. Reportar tudo, testado item a item.

**Se encontrar algo que exigiria mudança de escopo ou decisão de
arquitetura para corrigir, não corrija sozinho — pare e pergunte.**
Bugs genuínos (algo que deveria funcionar e não funciona) você corrige
seguindo o padrão já estabelecido; ambiguidades de produto, não.

## Checklist de testes — use as três contas de teste em produção

`aluno.teste@klass.dev` / `professor.teste@klass.dev` /
`coordenacao.teste@klass.dev` (mesmas senhas já em uso).

### 1. MS1 — Identidade e Acesso

- Login com as três contas, individualmente. Confirma nome e badge de
  papel corretos em cada uma.
- Logout e confirma redirecionamento para `/entrar`.
- Acesso direto a `/` sem sessão → redireciona corretamente.
- Cadastro de uma conta nova (use um e-mail descartável) → confirma o
  fluxo de verificação de e-mail (está ligado em produção).
- Tenta acessar uma rota exclusiva de outro papel digitando a URL
  diretamente (ex.: aluno acessando `/coordenacao/trilhas`) → confirma
  bloqueio.

### 2. MS2 — Catálogo Curricular

- `/catalogo` como cada papel → só trilhas publicadas aparecem.
- Como coordenação: `/coordenacao/trilhas`, cria uma trilha, adiciona
  módulos, define pré-requisitos entre eles, escolhe ícones, testa o
  drag-and-drop de reordenação (arrasta de verdade, não só verifica o
  RPC).
- Testa o botão "Voltar para rascunho" (renomeado na rodada anterior) e
  confirma que a tela some do catálogo público.
- Edita o "Endereço da página" (slug) de uma trilha existente e confirma
  que o aviso de risco aparece e que salva corretamente.
- Tenta apagar uma trilha publicada → confirma bloqueio com mensagem
  clara.

### 3. MS3 — Motor de Seleção

- Como aluno: tenta se inscrever em um módulo sem pré-requisito
  cumprido → confirma que o **modal** aparece (não mais banner no
  topo), lista os módulos faltantes como links clicáveis, e que o botão
  "Cancelar" fecha sem ação.
- Inscrição bem-sucedida em um módulo elegível.
- Como coordenação: aprova uma inscrição pendente → confirma que o
  status muda para "matriculada".
- **Confirma que o e-mail de aceite dispara de verdade.** Verifica no
  painel do Resend (ou peça as credenciais se precisar) se o envio
  aparece registrado, já que `@klass.dev` é endereço fictício e não
  recebe de verdade.
- Testa "Remover aluno da turma" (feature adicionada na rodada
  anterior) com um aluno já matriculado, confirma que pede motivo, e
  que o aluno vê o motivo na própria tela de matrículas depois.
- Cancela uma inscrição própria como aluno.

### 4. MS4 — Diário de Classe

- Como professor: em uma turma com alunos matriculados, cria uma
  avaliação nova e confirma que o indicador "representa X% da média
  final" aparece e atualiza corretamente ao adicionar uma segunda
  avaliação.
- Lança notas, faz chamada de uma aula.
- Tenta encerrar um módulo sem todas as notas/chamadas lançadas →
  confirma bloqueio com explicação clara do que falta.
- Completa os lançamentos e encerra → confirma resultado (aprovado ou
  reprovado) e o motivo exibido.
- Como aluno, com o boletim aberto em uma aba: confirma que o Realtime
  ainda funciona (lança uma nota em outra aba/sessão como professor e
  observa a tela do aluno atualizar sem recarregar).

### 5. MS5 — Certificação

- Localiza o certificado já existente do `aluno.teste` (deve existir
  dos seeds anteriores) em `/aluno/certificados`.
- Baixa o PDF e confirma que renderiza corretamente, com o hash visível.
- Copia o hash e acessa `/verificar/<hash>` **em uma janela anônima**
  (sem login) → confirma que mostra os dados corretos.
- Tenta um hash inválido → confirma mensagem apropriada de "não
  encontrado".
- Como coordenação, em `/coordenacao/certificados`, confirma que a
  listagem e os filtros funcionam.

### 6. Home, cabeçalho e navegação

- Home autenticada de cada papel → confirma que os cards de resumo
  mostram números corretos (ex.: coordenação vê contagem real de
  inscrições pendentes).
- Cabeçalho: navegação à esquerda/centro, usuário e "Sair" à direita,
  em desktop.
- Redimensiona para largura de celular (~375px): confirma menu
  hambúrguer funcionando, sem conteúdo cortado ou sobreposto.

### 7. Performance e regressão

- Navega entre pelo menos 5 páginas diferentes usando os links do
  cabeçalho (não recarregando manualmente) e confirma que **não volta**
  o bug de recarregamento de 1-2 segundos a cada navegação (corrigido
  numa rodada anterior).
- Troca de aba do navegador (sai e volta) repetidas vezes em uma tela
  autenticada, confirma que não trava nem pisca.

### 8. Visual e consistência

- Percorre visualmente as principais telas (home, catálogo, formulário
  de trilha, diário do professor, boletim do aluno) e confirma que a
  reforma visual (sombras, bordas finas, foco de campos) está aplicada
  de forma consistente — nenhuma tela "esquecida" com o visual antigo.
- Confirma que não há erros no console do navegador em nenhum dos
  fluxos testados acima.

## Limpeza de dados de demonstração

Depois dos testes, revise os seeds/dados atuais em produção:

- Remove qualquer conta ou trilha de teste avulsa que tenha sobrado de
  sessões anteriores (ex.: trilhas de teste, alunos temporários) —
  confirme antes o que é seed oficial vs. lixo de teste manual.
- Garanta que existe, para demonstração, pelo menos: uma matrícula
  pendente de aprovação, uma matrícula ativa em andamento (com notas
  parciais), uma matrícula concluída com certificado emitido, e uma
  matrícula reprovada — para que um avaliador em qualquer papel tenha
  algo relevante para ver, independentemente de qual conta usar.
- Se precisar recriar algum desses estados, siga o padrão já
  estabelecido nos seeds anteriores (reabrir matrícula, lançar dados,
  encerrar via função, etc.).

## Regras que valem para tudo

- Teste em **produção**, não em `localhost` — é isso que os avaliadores
  do SUS vão usar.
- Corrija bugs genuínos seguindo os padrões já estabelecidos
  (confirmação inline, nunca `window.confirm()`; RLS em qualquer coisa
  nova; comentários em português explicando o porquê).
- Não adicione funcionalidade nova. Se sentir vontade de "melhorar"
  algo que não é bug, anota como sugestão no relatório final em vez de
  implementar.
- Qualquer correção que exigir migration nova, siga o processo
  normal (migration versionada, tipos regenerados, `pnpm typecheck` e
  `pnpm build` limpos).
- Ao final, faça commit e push das correções (isso já vai para produção
  via Cloudflare Pages automaticamente).

## Ao terminar, me entregue

1. **Checklist item a item** (as 8 seções acima) com ✅/❌ e nota do que
   encontrou em cada um.
2. **Bugs encontrados e corrigidos**, com causa raiz — mesmo padrão dos
   relatórios anteriores.
3. **Qualquer coisa que ficou pendente ou que precisou da minha decisão**
   em vez de ser corrigida direto.
4. **Confirmação do estado dos dados de demonstração** — quais contas
   e trilhas estão prontas para os avaliadores usarem, com qual estado
   cada uma representa.
5. `pnpm typecheck` e `pnpm build` limpos, CI verde, confirmação de que
   o deploy em produção refletiu as correções.
6. Uma frase de fechamento: o sistema está, na sua avaliação, pronto
   para receber avaliadores externos sem risco de bug atrapalhar a
   percepção de usabilidade?

Este prompt não tem "próximo módulo" — é uma parada de qualidade antes
da coleta de dados do SUS.
