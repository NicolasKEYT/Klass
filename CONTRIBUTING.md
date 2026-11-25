# Como contribuir

Obrigado pelo interesse no Klass. Antes de mudar qualquer coisa de
arquitetura, leia o [CLAUDE.md](CLAUDE.md): ele diz onde cada coisa vive
(banco, frontend ou Worker) e o que não entra no projeto.

## Banco local

Teste só no banco local, nunca no Supabase hospedado. Com a CLI do Supabase:

```bash
supabase start -x studio,imgproxy,edge-runtime,logflare,vector,supavisor
supabase db reset   # recria o banco com todas as migrations e o seed
```

Detalhes na seção "Banco local" do README.

## Testes

```bash
supabase test db                      # testes SQL (pgTAP)
pnpm --filter @klass/workers test     # testes do Worker (Vitest)
apps/web/e2e/rodar.sh                 # roteiros da interface (Playwright)
```

Antes de abrir o pull request, rode também `pnpm typecheck` e `pnpm build`.

## Regras rápidas

- Mudança de schema é sempre migration nova; não edite migration já aplicada.
- Regra nova no banco ganha asserção pgTAP no arquivo do contexto.
- Toda tabela nova nasce com RLS habilitada.
- Identificadores de domínio e comentários em português.
