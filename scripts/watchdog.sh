#!/bin/bash
# watchdog.sh — Heartbeat monitoring for OpenClaw agents
# Checks each agent's last heartbeat timestamp and alerts if missed.
# Run via cron every 5 minutes: */5 * * * * /path/to/watchdog.sh

set -euo pipefail

OPENCLAW_HOME="${OPENCLAW_HOME:-$HOME/.openclaw}"
OPENCLAW_AGENTS="${OPENCLAW_AGENTS:-$HOME/openclaw-agents}"
AGENTS=("main" "docs" "research" "ai-research" "dev" "security")

# Max age in seconds before alert (2x heartbeat interval — default 30min heartbeat = 3600s)
MAX_AGE=${WATCHDOG_MAX_AGE:-3600}

# Gotify notification (if available)
GOTIFY_URL="${GOTIFY_URL:-}"
GOTIFY_TOKEN="${GOTIFY_TOKEN:-}"

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

echo "[WATCHDOG] $(date '+%Y-%m-%d %H:%M:%S') — Checking agent heartbeats..."

for agent in "${AGENTS[@]}"; do
  check_agent "$agent"
done

# Check gateway health
if command -v openclaw &> /dev/null; then
  if openclaw gateway call health --json > /dev/null 2>&1; then
    echo "[WATCHDOG] Gateway: OK"
  else
    echo "[WATCHDOG] ALERT: Gateway unreachable!"
    send_alert "gateway" "0"
  fi
fi

echo "[WATCHDOG] Check complete."
