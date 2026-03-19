#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OPENCLAW_REPO="${OPENCLAW_REPO:-$HOME/dev/openclaw}"

section() {
  printf '\n== %s ==\n' "$1"
}

show_git_status() {
  local repo_path="$1"
  local label="$2"
  section "$label"
  if [[ ! -d "$repo_path/.git" ]]; then
    echo "missing repo: $repo_path"
    return
  fi
  git -C "$repo_path" status --short --branch
}

show_openclaw_cli() {
  section "OpenClaw CLI"
  if command -v openclaw >/dev/null 2>&1; then
    which openclaw
    openclaw --version || true
  else
    echo "openclaw not found on PATH"
  fi
}

show_git_identity() {
  section "Git Identity"
  printf 'name: %s\n' "$(git config --global --get user.name || echo '<unset>')"
  printf 'email: %s\n' "$(git config --global --get user.email || echo '<unset>')"
}

show_local_stack() {
  section "Local Stack"
  if [[ -x "$ROOT_DIR/scripts/local-stack.sh" ]]; then
    "$ROOT_DIR/scripts/local-stack.sh" status || true
  else
    echo "local-stack.sh missing"
  fi
}

show_listen_shortcuts() {
  section "Listen Shortcuts Summary"
  if curl --silent --show-error --fail --max-time 5 http://127.0.0.1:7600/shortcuts/summary >/dev/null 2>&1; then
    curl --silent --show-error --fail --max-time 5 http://127.0.0.1:7600/shortcuts/summary | python3 -m json.tool
  else
    echo "listen shortcuts summary unavailable"
  fi
}

show_git_status "$ROOT_DIR" "openclaw-agents repo"
show_git_status "$OPENCLAW_REPO" "openclaw repo"
show_openclaw_cli
show_git_identity
show_local_stack
show_listen_shortcuts
