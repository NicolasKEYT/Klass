#!/usr/bin/env bash
# Roda os roteiros Playwright contra o banco local, recriado do zero.
# Pré-requisito: `supabase start` (ver "Banco local" no README).
set -euo pipefail
cd "$(dirname "$0")/../../.."

if ! supabase status >/dev/null 2>&1; then
  echo "O banco local não está no ar. Rode: supabase start -x studio,imgproxy,edge-runtime,logflare,vector,supavisor" >&2
  exit 1
fi

# `db reset` é sempre local; recria o banco com todas as migrations e o seed de demonstração.
supabase db reset >/dev/null 2>&1

# Só a chave publicável do banco local entra no ambiente; nada vai para o repositório.
eval "$(supabase status -o env | grep -E '^(API_URL|PUBLISHABLE_KEY)=')"
export KLASS_E2E_SUPABASE_URL="$API_URL"
export KLASS_E2E_PUBLISHABLE_KEY="$PUBLISHABLE_KEY"

cd apps/web
exec pnpm exec playwright test "$@"
