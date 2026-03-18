#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DASHBOARD_DIR="$ROOT_DIR/apps/dashboard"
LISTEN_SCRIPT="$ROOT_DIR/apps/listen/listen_server.py"

DASHBOARD_HOST="${OPENCLAW_DASHBOARD_HOST:-0.0.0.0}"
DASHBOARD_PORT="${OPENCLAW_DASHBOARD_PORT:-3000}"
LISTEN_HOST="${OPENCLAW_LISTEN_HOST:-127.0.0.1}"
LISTEN_PORT="${OPENCLAW_LISTEN_PORT:-7600}"

DASHBOARD_SESSION="${OPENCLAW_DASHBOARD_SESSION:-openclaw-dashboard}"
LISTEN_SESSION="${OPENCLAW_LISTEN_SESSION:-openclaw-listen}"

usage() {
  cat <<'EOF'
Usage: scripts/local-stack.sh [start|stop|restart|status|logs] [component]

Commands:
  start      Start dashboard and listen in tmux sessions.
  stop       Stop dashboard and listen tmux sessions.
  restart    Restart both services.
  status     Show tmux session state and HTTP health checks.
  logs       Show recent tmux output for dashboard or listen.

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

start_stack() {
  require_command tmux
  require_command python3
  require_command npm
  require_command curl

  log "Starting local OpenClaw stack"
  ensure_tmux_session \
    "$DASHBOARD_SESSION" \
    "cd \"$DASHBOARD_DIR\" && npm run dev -- --hostname $DASHBOARD_HOST --port $DASHBOARD_PORT"
  ensure_tmux_session \
    "$LISTEN_SESSION" \
    "cd \"$ROOT_DIR\" && python3 \"$LISTEN_SCRIPT\" --host \"$LISTEN_HOST\" --port \"$LISTEN_PORT\""
  status_stack
}

stop_stack() {
  require_command tmux
  log "Stopping local OpenClaw stack"
  stop_tmux_session "$DASHBOARD_SESSION"
  stop_tmux_session "$LISTEN_SESSION"
}

status_stack() {
  require_command tmux
  require_command curl
  log "tmux session status"
  if tmux_has_session "$DASHBOARD_SESSION"; then
    printf '  [ok] %s\n' "$DASHBOARD_SESSION"
  else
    printf '  [warn] %s not running\n' "$DASHBOARD_SESSION"
  fi
  if tmux_has_session "$LISTEN_SESSION"; then
    printf '  [ok] %s\n' "$LISTEN_SESSION"
  else
    printf '  [warn] %s not running\n' "$LISTEN_SESSION"
  fi

  log "HTTP health checks"
  check_http "dashboard jobs API" "http://127.0.0.1:${DASHBOARD_PORT}/api/jobs"
  check_http "listen metrics" "http://${LISTEN_HOST}:${LISTEN_PORT}/metrics"
  check_http "listen policy" "http://${LISTEN_HOST}:${LISTEN_PORT}/policy"

  printf '\nPrimary Mission Control:\n'
  printf '  http://127.0.0.1:%s/command\n' "$DASHBOARD_PORT"
  printf 'Supplemental iPad / LAN:\n'
  printf '  http://<your-mac-lan-ip>:%s/command\n' "$DASHBOARD_PORT"
}

show_logs() {
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
  stop)
    stop_stack
    ;;
  restart)
    stop_stack
    start_stack
    ;;
  status)
    status_stack
    ;;
  logs)
    show_logs "$component_arg"
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
