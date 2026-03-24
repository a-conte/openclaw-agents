#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DASHBOARD_DIR="$ROOT_DIR/apps/dashboard"
LISTEN_SCRIPT="$ROOT_DIR/apps/listen/listen_server.py"

DASHBOARD_HOST="${OPENCLAW_DASHBOARD_HOST:-0.0.0.0}"
DASHBOARD_PORT="${OPENCLAW_DASHBOARD_PORT:-3000}"
LISTEN_HOST="${OPENCLAW_LISTEN_HOST:-127.0.0.1}"
LISTEN_PORT="${OPENCLAW_LISTEN_PORT:-7600}"
STACK_START_TIMEOUT="${OPENCLAW_STACK_START_TIMEOUT:-20}"
DEFAULT_NPM_DEV_ENV="NEXT_IGNORE_INCORRECT_LOCKFILE=1"
MAC_MINI_DASHBOARD_HOST="${OPENCLAW_MAC_MINI_DASHBOARD_HOST:-$DASHBOARD_HOST}"
MAC_MINI_DASHBOARD_PORT="${OPENCLAW_MAC_MINI_DASHBOARD_PORT:-3100}"
MAC_MINI_LISTEN_HOST="${OPENCLAW_MAC_MINI_LISTEN_HOST:-$LISTEN_HOST}"
MAC_MINI_LISTEN_PORT="${OPENCLAW_MAC_MINI_LISTEN_PORT:-7601}"

DASHBOARD_SESSION="${OPENCLAW_DASHBOARD_SESSION:-openclaw-dashboard}"
LISTEN_SESSION="${OPENCLAW_LISTEN_SESSION:-openclaw-listen}"
MAC_MINI_DASHBOARD_SESSION="${OPENCLAW_MAC_MINI_DASHBOARD_SESSION:-openclaw-dashboard-mac-mini}"
MAC_MINI_LISTEN_SESSION="${OPENCLAW_MAC_MINI_LISTEN_SESSION:-openclaw-listen-mac-mini}"

usage() {
  cat <<'EOF'
Usage: scripts/local-stack.sh [start|restart|start-mac-mini|restart-mac-mini|stop|stop-mac-mini|status|status-mac-mini|logs|logs-mac-mini] [component]

Commands:
  start      Start dashboard and listen in tmux sessions.
  start-mac-mini
             Start the additive mac-mini compatibility path with readiness waits.
  stop       Stop dashboard and listen tmux sessions.
  restart    Restart both services.
  restart-mac-mini
             Restart the additive mac-mini compatibility path.
  stop-mac-mini
             Stop the additive mac-mini compatibility path.
  status     Show tmux session state and HTTP health checks.
  status-mac-mini
             Show status for the additive mac-mini compatibility path.
  logs       Show recent tmux output for dashboard or listen.
  logs-mac-mini
             Show logs for the additive mac-mini compatibility path.

Components for logs:
  dashboard
  listen

Environment overrides:
  OPENCLAW_DASHBOARD_HOST
  OPENCLAW_DASHBOARD_PORT
  OPENCLAW_LISTEN_HOST
  OPENCLAW_LISTEN_PORT
  OPENCLAW_DASHBOARD_SESSION
  OPENCLAW_LISTEN_SESSION
  OPENCLAW_MAC_MINI_DASHBOARD_HOST
  OPENCLAW_MAC_MINI_DASHBOARD_PORT
  OPENCLAW_MAC_MINI_LISTEN_HOST
  OPENCLAW_MAC_MINI_LISTEN_PORT
  OPENCLAW_MAC_MINI_DASHBOARD_SESSION
  OPENCLAW_MAC_MINI_LISTEN_SESSION
EOF
}

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

tmux_has_session() {
  local session_name="$1"
  tmux has-session -t "$session_name" >/dev/null 2>&1
}

ensure_tmux_session() {
  local session_name="$1"
  local command_text="$2"
  if tmux_has_session "$session_name"; then
    printf '  [ok] tmux session %s already running\n' "$session_name"
    return
  fi
  tmux new-session -d -s "$session_name" "$command_text"
  printf '  [ok] started tmux session %s\n' "$session_name"
}

stop_tmux_session() {
  local session_name="$1"
  if tmux_has_session "$session_name"; then
    tmux kill-session -t "$session_name"
    printf '  [ok] stopped tmux session %s\n' "$session_name"
  else
    printf '  [ok] tmux session %s already stopped\n' "$session_name"
  fi
}

check_http() {
  local label="$1"
  local url="$2"
  if curl --silent --show-error --fail --max-time 5 "$url" >/dev/null; then
    printf '  [ok] %s reachable at %s\n' "$label" "$url"
  else
    printf '  [warn] %s not reachable at %s\n' "$label" "$url"
  fi
}

wait_for_http() {
  local label="$1"
  local url="$2"
  local timeout="${3:-$STACK_START_TIMEOUT}"
  local elapsed=0

  while (( elapsed < timeout )); do
    if curl --silent --show-error --fail --max-time 5 "$url" >/dev/null 2>&1; then
      printf '  [ok] %s reachable at %s\n' "$label" "$url"
      return 0
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done

  printf '  [warn] %s did not become healthy within %ss at %s\n' "$label" "$timeout" "$url"
  return 1
}

start_stack() {
  local mac_mini_mode="${1:-0}"

  require_command tmux
  require_command python3
  require_command npm
  require_command curl

  local dashboard_host="$DASHBOARD_HOST"
  local dashboard_port="$DASHBOARD_PORT"
  local listen_host="$LISTEN_HOST"
  local listen_port="$LISTEN_PORT"
  local dashboard_session="$DASHBOARD_SESSION"
  local listen_session="$LISTEN_SESSION"
  local dashboard_command="cd \"$DASHBOARD_DIR\" && npm run dev -- --hostname $dashboard_host --port $dashboard_port"
  if [[ "$mac_mini_mode" == "1" ]]; then
    dashboard_host="$MAC_MINI_DASHBOARD_HOST"
    dashboard_port="$MAC_MINI_DASHBOARD_PORT"
    listen_host="$MAC_MINI_LISTEN_HOST"
    listen_port="$MAC_MINI_LISTEN_PORT"
    dashboard_session="$MAC_MINI_DASHBOARD_SESSION"
    listen_session="$MAC_MINI_LISTEN_SESSION"
    dashboard_command="cd \"$DASHBOARD_DIR\" && $DEFAULT_NPM_DEV_ENV npm run dev -- --hostname $dashboard_host --port $dashboard_port"
  fi

  log "Starting local OpenClaw stack"
  ensure_tmux_session \
    "$dashboard_session" \
    "$dashboard_command"
  ensure_tmux_session \
    "$listen_session" \
    "cd \"$ROOT_DIR\" && python3 \"$LISTEN_SCRIPT\" --host \"$listen_host\" --port \"$listen_port\""

  if [[ "$mac_mini_mode" == "1" ]]; then
    log "Waiting for HTTP readiness"
    local failed=0
    wait_for_http "dashboard jobs API" "http://127.0.0.1:${dashboard_port}/api/jobs" || failed=1
    wait_for_http "listen metrics" "http://${listen_host}:${listen_port}/metrics" || failed=1
    wait_for_http "listen policy" "http://${listen_host}:${listen_port}/policy" || failed=1

    if (( failed != 0 )); then
      log "Startup diagnostics"
      show_logs dashboard "$mac_mini_mode" || true
      show_logs listen "$mac_mini_mode" || true
      return 1
    fi
  fi

  status_stack "$mac_mini_mode"
}

stop_stack() {
  local mac_mini_mode="${1:-0}"
  require_command tmux
  local dashboard_session="$DASHBOARD_SESSION"
  local listen_session="$LISTEN_SESSION"
  if [[ "$mac_mini_mode" == "1" ]]; then
    dashboard_session="$MAC_MINI_DASHBOARD_SESSION"
    listen_session="$MAC_MINI_LISTEN_SESSION"
  fi
  log "Stopping local OpenClaw stack"
  stop_tmux_session "$dashboard_session"
  stop_tmux_session "$listen_session"
}

status_stack() {
  local mac_mini_mode="${1:-0}"
  require_command tmux
  require_command curl
  local dashboard_session="$DASHBOARD_SESSION"
  local listen_session="$LISTEN_SESSION"
  local dashboard_port="$DASHBOARD_PORT"
  local listen_host="$LISTEN_HOST"
  local listen_port="$LISTEN_PORT"
  if [[ "$mac_mini_mode" == "1" ]]; then
    dashboard_session="$MAC_MINI_DASHBOARD_SESSION"
    listen_session="$MAC_MINI_LISTEN_SESSION"
    dashboard_port="$MAC_MINI_DASHBOARD_PORT"
    listen_host="$MAC_MINI_LISTEN_HOST"
    listen_port="$MAC_MINI_LISTEN_PORT"
  fi
  log "tmux session status"
  if tmux_has_session "$dashboard_session"; then
    printf '  [ok] %s\n' "$dashboard_session"
  else
    printf '  [warn] %s not running\n' "$dashboard_session"
  fi
  if tmux_has_session "$listen_session"; then
    printf '  [ok] %s\n' "$listen_session"
  else
    printf '  [warn] %s not running\n' "$listen_session"
  fi

  log "HTTP health checks"
  check_http "dashboard jobs API" "http://127.0.0.1:${dashboard_port}/api/jobs"
  check_http "listen metrics" "http://${listen_host}:${listen_port}/metrics"
  check_http "listen policy" "http://${listen_host}:${listen_port}/policy"

  printf '\nPrimary Mission Control:\n'
  printf '  http://127.0.0.1:%s/command\n' "$dashboard_port"
  printf 'Supplemental iPad / LAN:\n'
  printf '  http://<your-mac-lan-ip>:%s/command\n' "$dashboard_port"
}

show_logs() {
  local mac_mini_mode="${2:-0}"
  require_command tmux
  local component="${1:-dashboard}"
  local session_name=""
  case "$component" in
    dashboard)
      session_name="$DASHBOARD_SESSION"
      ;;
    listen)
      session_name="$LISTEN_SESSION"
      ;;
    *)
      echo "Unknown log component: $component" >&2
      exit 1
      ;;
  esac
  if [[ "$mac_mini_mode" == "1" ]]; then
    case "$component" in
      dashboard)
        session_name="$MAC_MINI_DASHBOARD_SESSION"
        ;;
      listen)
        session_name="$MAC_MINI_LISTEN_SESSION"
        ;;
    esac
  fi
  if ! tmux_has_session "$session_name"; then
    echo "tmux session not running: $session_name" >&2
    exit 1
  fi
  tmux capture-pane -pt "$session_name" -S -120
}

command_name="${1:-start}"
component_arg="${2:-}"

case "$command_name" in
  start)
    start_stack
    ;;
  start-mac-mini)
    start_stack 1
    ;;
  stop)
    stop_stack
    ;;
  stop-mac-mini)
    stop_stack 1
    ;;
  restart)
    stop_stack
    start_stack
    ;;
  restart-mac-mini)
    stop_stack 1
    start_stack 1
    ;;
  status)
    status_stack
    ;;
  status-mac-mini)
    status_stack 1
    ;;
  logs)
    show_logs "$component_arg"
    ;;
  logs-mac-mini)
    show_logs "$component_arg" 1
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    echo "Unknown command: $command_name" >&2
    usage
    exit 1
    ;;
esac
