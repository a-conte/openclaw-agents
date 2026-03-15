#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

required=(
  "apps/dashboard/package.json"
  "apps/dashboard/src/app"
  "apps/dashboard/src/components"
)

for path in "${required[@]}"; do
  if [ ! -e "$ROOT/$path" ]; then
    echo "Missing required path: $path"
    exit 1
  fi
done

for file in \
  "$ROOT/Makefile" \
  "$ROOT/.gitignore" \
  "$ROOT/.github/workflows/ci.yml" \
  "$ROOT/.githooks/pre-push" \
  "$ROOT/dev/MEMORY.md" \
  "$ROOT/apps/dashboard/README.md" \
  "$ROOT/apps/dashboard/TROUBLESHOOTING.md"
do
  if \
    rg -n -P '(?<!apps/)dashboard/' "$file" >/dev/null || \
    rg -n 'cd[[:space:]]+dashboard([[:space:]]|$)' "$file" >/dev/null || \
    rg -n 'working-directory:[[:space:]]*dashboard([[:space:]]|$)' "$file" >/dev/null
  then
    echo "Found stale dashboard path reference in: ${file#$ROOT/}"
    exit 1
  fi
done

echo "Dashboard path references look correct."
