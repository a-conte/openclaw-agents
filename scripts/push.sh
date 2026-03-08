#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# Check for changes
if git diff --quiet && git diff --cached --quiet && [ -z "$(git ls-files --others --exclude-standard)" ]; then
  echo "Nothing to push — working tree clean."
  exit 0
fi

# Stage all changes
git add -A

# Generate commit message
MSG="${1:-}"
if [ -z "$MSG" ]; then
  # Auto-generate from changed files
  CHANGED=$(git diff --cached --name-only | sed 's|/.*||' | sort -u | tr '\n' ', ' | sed 's/,$//')
  MSG="Update ${CHANGED}"
fi

git commit -m "$MSG"
git push origin main

echo "Pushed to main."
