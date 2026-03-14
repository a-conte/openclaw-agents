#!/bin/bash
# watchdog.sh — Heartbeat monitoring for OpenClaw agents
# Checks each agent's last heartbeat timestamp and alerts if missed.
# Run via cron every 5 minutes: */5 * * * * /path/to/watchdog.sh

set -euo pipefail

OPENCLAW_HOME="${OPENCLAW_HOME:-$HOME/.openclaw}"
OPENCLAW_AGENTS="${OPENCLAW_AGENTS:-$HOME/openclaw-agents}"
AGENTS=("main" "mail" "docs" "research" "ai-research" "dev" "security")

# Max age in seconds before alert (2x heartbeat interval — default 30min heartbeat = 3600s)
MAX_AGE=${WATCHDOG_MAX_AGE:-3600}

# Gotify notification (if available)
GOTIFY_URL="${GOTIFY_URL:-}"
GOTIFY_TOKEN="${GOTIFY_TOKEN:-}"

# Load Telegram direct alert config (fallback when gateway is down)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$SCRIPT_DIR/.watchdog.env" ]]; then
  # shellcheck source=/dev/null
  source "$SCRIPT_DIR/.watchdog.env"
fi
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID:-}"

send_alert() {
  local agent="$1"
  local age_min="$2"
  local message="Agent '$agent' has not sent a heartbeat in ${age_min} minutes. Possible failure."

  echo "[WATCHDOG] ALERT: $message"

  # Try Gotify
  if [[ -n "$GOTIFY_URL" && -n "$GOTIFY_TOKEN" ]]; then
    curl -s -X POST "$GOTIFY_URL/message" \
      -H "X-Gotify-Key: $GOTIFY_TOKEN" \
      -F "title=OpenClaw Watchdog Alert" \
      -F "message=$message" \
      -F "priority=7" \
      > /dev/null 2>&1 || true
  fi

  # Try openclaw gateway to send Telegram message via main agent
  if command -v openclaw &> /dev/null; then
    openclaw gateway call sendMessage --json \
      --agent main \
      --message "[WATCHDOG] $message" \
      > /dev/null 2>&1 || true
  fi

  # Fallback: direct Telegram Bot API (works even when gateway is down)
  if [[ -n "$TELEGRAM_BOT_TOKEN" && -n "$TELEGRAM_CHAT_ID" ]]; then
    curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      -d "chat_id=${TELEGRAM_CHAT_ID}" \
      -d "text=[WATCHDOG] $message" \
      -d "parse_mode=Markdown" \
      > /dev/null 2>&1 || true
  fi
}

check_agent() {
  local agent="$1"
  local sessions_dir="$OPENCLAW_HOME/agents/$agent/sessions"

  if [[ ! -d "$sessions_dir" ]]; then
    echo "[WATCHDOG] No sessions dir for $agent — skipping"
    return
  fi

  # Find the most recently modified session file
  local latest_file
  latest_file=$(find "$sessions_dir" -name "*.jsonl" -type f -print0 2>/dev/null | xargs -0 ls -t 2>/dev/null | head -1)

  if [[ -z "$latest_file" ]]; then
    echo "[WATCHDOG] No session files for $agent — skipping"
    return
  fi

  local last_modified
  last_modified=$(stat -f %m "$latest_file" 2>/dev/null || stat -c %Y "$latest_file" 2>/dev/null)
  local now
  now=$(date +%s)
  local age=$((now - last_modified))
  local age_min=$((age / 60))

  if [[ $age -gt $MAX_AGE ]]; then
    send_alert "$agent" "$age_min"
  else
    echo "[WATCHDOG] $agent OK — last activity ${age_min}m ago"
  fi
}

rotate_activity_log() {
  local log_file="$OPENCLAW_AGENTS/shared/logs/activity.jsonl"
  local max_lines=10000

  if [[ ! -f "$log_file" ]]; then
    return
  fi

  local line_count
  line_count=$(wc -l < "$log_file" | tr -d ' ')

  if [[ $line_count -gt $max_lines ]]; then
    local today
    today=$(date +%Y-%m-%d)
    local archive="$OPENCLAW_AGENTS/shared/logs/activity-${today}.jsonl.gz"

    echo "[WATCHDOG] Rotating activity log (${line_count} lines > ${max_lines} threshold)"
    gzip -c "$log_file" > "$archive"
    tail -n 1000 "$log_file" > "$log_file.tmp"
    mv "$log_file.tmp" "$log_file"
    echo "[WATCHDOG] Rotated to $archive, kept last 1000 lines"

    # Clean up archives older than 30 days
    find "$OPENCLAW_AGENTS/shared/logs/" -name "activity-*.jsonl.gz" -mtime +30 -delete 2>/dev/null || true
  fi
}

check_service_health() {
  # Check gateway health via HTTP
  if curl -s -o /dev/null -w '' --connect-timeout 5 "http://localhost:18789/health" 2>/dev/null; then
    echo "[WATCHDOG] Gateway: OK (HTTP health check)"
  else
    echo "[WATCHDOG] ALERT: Gateway HTTP health check failed!"
    send_alert "gateway" "0"
    # Attempt auto-restart via launchctl
    launchctl kickstart -k "gui/$(id -u)/com.openclaw.gateway" 2>/dev/null || true
  fi

  # Check dashboard health via HTTP
  if curl -s -o /dev/null -w '' --connect-timeout 5 "http://localhost:3000" 2>/dev/null; then
    echo "[WATCHDOG] Dashboard: OK (HTTP health check)"
  else
    echo "[WATCHDOG] ALERT: Dashboard HTTP health check failed!"
    send_alert "dashboard" "0"
    # Attempt auto-restart via launchctl
    launchctl kickstart -k "gui/$(id -u)/com.openclaw.dashboard" 2>/dev/null || true
  fi
}

echo "[WATCHDOG] $(date '+%Y-%m-%d %H:%M:%S') — Starting checks..."

# Check agent heartbeats
for agent in "${AGENTS[@]}"; do
  check_agent "$agent"
done

# Check service health (gateway + dashboard)
check_service_health

# Rotate activity log if needed
rotate_activity_log

echo "[WATCHDOG] Check complete."
