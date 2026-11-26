# Changelog

Todas as mudanças relevantes do Klass ficam neste arquivo. O formato segue o
[Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o versionamento
segue o [Versionamento Semântico](https://semver.org/lang/pt-BR/).

A `main` só recebe versão: cada versão publicada tem uma tag `vX.Y.Z` no commit
da `main` que foi ao ar e uma Release no GitHub.

## [Não lançado]

## [1.0.0] - 2026-11-26

Primeira versão. É a versão do Trabalho de Conclusão de Curso (Faculdade de
Computação e Informática, Universidade Presbiteriana Mackenzie): o sistema
descrito no artigo, com as limitações assumidas listadas abaixo.

### Adicionado

**Aluno**
- Catálogo de trilhas e módulos, e inscrição em turma com verificação
  automática de pré-requisitos (inclusive de outra trilha).
- Boletim com notas, frequência e progresso, atualizado em tempo real, sem
  recarregar a tela (Supabase Realtime).
- Certificado em PDF, com código único e verificação pública sem login
  (`/verificar/<código>`).
- E-mails de inscrição recebida, matrícula deferida e certificado emitido.

**Professor**
- Turmas que leciona, chamada e lançamento de notas. A chamada pode ser feita
  ou alterada até 7 dias depois da aula; depois disso, só com liberação da
  coordenação.
- Materiais da turma (arquivos no Supabase Storage) e encerramento do diário.

**Coordenação**
- Gestão de trilhas, turmas, corpo docente e base de alunos, e deferimento de
  matrículas.
- Acompanhamento com gráficos e relatório do período, e exportação em CSV e
  XLSX. As funções de relatório são só da coordenação (erro `42501` para os
  demais) e nenhum export traz CPF.
- Certificados da instituição e revogação, com motivo e histórico de
  encerramentos.

**Certificação**
- PDF gerado no navegador (react-pdf), sem plataforma externa de credenciamento.
- Três modos por trilha: módulo, trilha, ou módulo e trilha.

**Conta**
- Cadastro com confirmação de e-mail.
- Recuperação de senha (`Esqueci minha senha`, `/redefinir-senha`) e troca de
  senha no Perfil, com e-mail no mesmo estilo dos demais.
- Tema claro e escuro.

**Arquitetura e segurança**
- Monólito modular sobre o Supabase, com os cinco contextos do domínio como
  schemas isolados (`identidade`, `catalogo`, `selecao`, `diario`,
  `certificacao`). Segurança por RLS, JWT e RBAC em todas as tabelas.
- Eventos do banco para o Worker por triggers com `pg_net`, com segredo e URL do
  Worker no Vault, e envio de e-mail pelo Resend.
- Cabeçalhos de segurança no Cloudflare Pages, limite de erro contra tela
  branca e página para rota não encontrada.
- Views de acompanhamento (`vw_taxa_evasao`, `vw_desempenho_por_trilha`).

**Testes** (rodam só no banco local)
- 279 asserções pgTAP em 9 arquivos.
- 9 casos Playwright em 5 roteiros, incluindo a recuperação de senha lendo o
  e-mail no Mailpit local.
- 9 testes Vitest do Worker, sem rede.

### Segurança
- Sem vulnerabilidade conhecida nas dependências de produção
  (`pnpm audit --prod`, 26/11/2026): `hono` 4.13.22 e `react-router-dom` 7.18.7.

### Banco e publicação
- 51 migrations, todas aplicadas no ambiente hospedado. As migrations vão antes
  do frontend que depende delas.
- O frontend publica sozinho no push na `main`. O Worker (`wrangler deploy`) e as
  migrations (`supabase db push`, com backup antes) são manuais.

### Limitações conhecidas
Assumidas na 1.0 e declaradas no artigo; o código não deve contradizê-las em
silêncio.
- Sistema monolocatário e cadastro aberto: qualquer pessoa cria conta de aluno,
  sem convite nem vínculo com uma instituição além da própria instalação.
- Sem aviso de privacidade, termos de uso nem exclusão da própria conta, e sem
  avaliação de conformidade com a LGPD ou a ISO/IEC 27001.
- A chamada do banco ao Worker não é reenviada: se o Worker ou o Resend falharem,
  o e-mail pode se perder. A matrícula rejeitada não gera e-mail, e não há tarefa
  agendada.
- Senha com mínimo de 6 caracteres. A recuperação de senha depende do e-mail da
  conta.
- Decisão D7 do UI Kit (publicar notas só após revisão) não implementada.
- Sem testes de carga nem avaliação de usabilidade com usuários externos.
- A restauração do backup fora do Supabase não foi testada (o dump não inclui
  Auth nem Storage).
- A instância hospedada da equipe é só de demonstração e não deve receber dados
  reais de alunos.

[Não lançado]: https://github.com/NicolasKEYT/Klass/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/NicolasKEYT/Klass/releases/tag/v1.0.0
