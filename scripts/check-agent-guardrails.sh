#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CODEX_RULES="${HOME}/.codex/rules/default.rules"
CLAUDE_SETTINGS="${HOME}/.claude/settings.json"
CLAUDE_HOOKS_REPO="${ROOT_DIR}"
PROTECTED_FILE="${ROOT_DIR}/main/USER.md"

log() {
  printf '\n[%s] %s\n' "$(date '+%H:%M:%S')" "$1"
}

require_command() {
  local command_name="$1"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing required command: $command_name" >&2
    exit 1
  fi
}

check_codex_rules() {
  log "Codex guardrails"
  if [ ! -f "$CODEX_RULES" ]; then
    echo "  [fail] missing $CODEX_RULES"
    return 1
  fi

  local required_patterns=(
    'prefix_rule(pattern=["git", "push", "-f"], decision="deny")'
    'prefix_rule(pattern=["git", "push", "--force"], decision="deny")'
    'prefix_rule(pattern=["git", "reset", "--hard"], decision="deny")'
    'prefix_rule(pattern=["git", "clean", "-fdx"], decision="deny")'
  )

  local failed=0
  for pattern in "${required_patterns[@]}"; do
    if rg -F "$pattern" "$CODEX_RULES" >/dev/null; then
      echo "  [ok] $pattern"
    else
      echo "  [fail] missing Codex rule: $pattern"
      failed=1
    fi
  done

  if codex features list >/dev/null 2>&1; then
    echo "  [ok] codex CLI can load current config"
  else
    echo "  [fail] codex CLI failed to load current config"
    failed=1
  fi

  return "$failed"
}

check_claude_settings() {
  log "Claude hook registration"
  if [ ! -f "$CLAUDE_SETTINGS" ]; then
    echo "  [fail] missing $CLAUDE_SETTINGS"
    return 1
  fi

  local required_patterns=(
    "\"PreToolUse\""
    "\"PermissionRequest\""
    "${CLAUDE_HOOKS_REPO}/.claude/hooks/pre_tool_use.py"
    "${CLAUDE_HOOKS_REPO}/.claude/hooks/permission_request.py --log-only"
  )

  local failed=0
  for pattern in "${required_patterns[@]}"; do
    if rg -F "$pattern" "$CLAUDE_SETTINGS" >/dev/null; then
      echo "  [ok] $pattern"
    else
      echo "  [fail] missing Claude config entry: $pattern"
      failed=1
    fi
  done

  python3 -m json.tool "$CLAUDE_SETTINGS" >/dev/null
  echo "  [ok] Claude settings JSON is valid"

  return "$failed"
}

check_claude_hook_behavior() {
  log "Claude hook behavior"
  local pre_tool_hook="${CLAUDE_HOOKS_REPO}/.claude/hooks/pre_tool_use.py"
  local permission_hook="${CLAUDE_HOOKS_REPO}/.claude/hooks/permission_request.py"
  local failed=0

  local pre_output
  pre_output="$(printf '%s' "{\"tool_name\":\"Edit\",\"tool_input\":{\"file_path\":\"${PROTECTED_FILE}\"}}" | uv run "$pre_tool_hook" 2>&1 || true)"
  if printf '%s' "$pre_output" | rg -F "BLOCKED: Access to protected file 'USER.md'" >/dev/null; then
    echo "  [ok] PreToolUse blocks protected file edits"
  else
    echo "  [fail] PreToolUse did not report protected file block"
    failed=1
  fi

  local perm_output
  perm_output="$(printf '%s' "{\"hook_event_name\":\"PermissionRequest\",\"tool_name\":\"Edit\",\"tool_input\":{\"file_path\":\"${PROTECTED_FILE}\"}}" | uv run "$permission_hook" 2>&1 || true)"
  if printf '%s' "$perm_output" | rg -F '"behavior": "deny"' >/dev/null && printf '%s' "$perm_output" | rg -F "Permission denied for protected file 'USER.md'" >/dev/null; then
    echo "  [ok] PermissionRequest denies protected file edits"
  else
    echo "  [fail] PermissionRequest did not deny protected file edits"
    failed=1
  fi

  return "$failed"
}

main() {
  require_command rg
  require_command python3
  require_command codex
  require_command uv

  local failed=0
  check_codex_rules || failed=1
  check_claude_settings || failed=1
  check_claude_hook_behavior || failed=1

  if [ "$failed" -ne 0 ]; then
    log "Guardrail check failed"
    exit 1
  fi

  log "Guardrail check passed"
}

main "$@"
