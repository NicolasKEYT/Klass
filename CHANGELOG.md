# Changelog

Mudanças relevantes do Klass. O formato segue o
[Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e as versões seguem o
[Versionamento Semântico](https://semver.org/lang/pt-BR/).

## 1.0.0 - 2026-11-25

Primeira versão estável, entregue como o trabalho de conclusão de curso.

### Adicionado

- Jornada completa do aluno: cadastro, catálogo de trilhas, inscrição com
  verificação automática de pré-requisitos, boletim com notas e frequência em
  tempo real e certificado em PDF com código de verificação pública.
- Professor: turmas, chamada (com prazo de 7 dias), notas, materiais da turma e
  encerramento do diário.
- Coordenação: trilhas, turmas, pessoas, deferimento de matrículas,
  certificados (com revogação), acompanhamento com gráficos e exports em CSV e
  XLSX.
- E-mails de inscrição recebida, matrícula deferida e certificado emitido,
  enviados pelo Worker via Resend.
- Página "não encontrada" para endereço inexistente e tela "Algo deu errado" no
  lugar de tela branca.
- Headers de segurança no frontend (`_headers` do Cloudflare Pages).
- Testes do Worker (Vitest), além dos testes SQL (pgTAP) e roteiros Playwright.
- Versão do sistema visível na tela de Perfil.
- `CONTRIBUTING.md` e `SECURITY.md`.

### Alterado

- Dependências atualizadas (Hono, Wrangler, supabase-js, React Router, Vite),
  com as auditorias de segurança limpas.
- URL do Worker lida do Supabase Vault (`webhook_url`), fora das migrations.
- Webhooks do Worker com comparação de segredo em tempo constante, resposta 400
  para corpo inválido e erro interno sem detalhes.
- Tipos do banco regerados; um único lockfile (pnpm).
- Documentação alinhada ao código (cron, e-mails, consulta de falhas do
  `pg_net`, logs do Worker ligados).

### Removido

- Chamada do frontend ao Worker (`callWorker`, `VITE_WORKERS_URL`), que não era
  usada.

### Limitações conhecidas

- Sem recuperação nem troca de senha pela interface.
- Sem aviso de privacidade, termos de uso nem exclusão de conta (LGPD).
- A instância hospedada é só de demonstração, com dados de teste.
- Sistema monolocatário, sem testes de carga e sem tarefas agendadas; a chamada
  do banco ao Worker não é reenviada em caso de falha.
