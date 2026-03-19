#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LAUNCH_AGENTS_DIR="${HOME}/Library/LaunchAgents"

DASHBOARD_LABEL="${OPENCLAW_DASHBOARD_LABEL:-dev.openclaw.dashboard}"
LISTEN_LABEL="${OPENCLAW_LISTEN_LABEL:-dev.openclaw.listen}"

DASHBOARD_HOST="${OPENCLAW_DASHBOARD_HOST:-0.0.0.0}"
DASHBOARD_PORT="${OPENCLAW_DASHBOARD_PORT:-3000}"
LISTEN_HOST="${OPENCLAW_LISTEN_HOST:-127.0.0.1}"
LISTEN_PORT="${OPENCLAW_LISTEN_PORT:-7600}"

DASHBOARD_PLIST="${LAUNCH_AGENTS_DIR}/${DASHBOARD_LABEL}.plist"
LISTEN_PLIST="${LAUNCH_AGENTS_DIR}/${LISTEN_LABEL}.plist"

usage() {
  cat <<'EOF'
Usage: scripts/install-launchd.sh [install|uninstall|restart|status]

Commands:
  install     Install and load dashboard + listen LaunchAgents.
  uninstall   Unload and remove dashboard + listen LaunchAgents.
  restart     Reinstall and reload both LaunchAgents.
  status      Show launchctl state for both LaunchAgents.

Environment overrides:
  OPENCLAW_DASHBOARD_LABEL
  OPENCLAW_LISTEN_LABEL
  OPENCLAW_DASHBOARD_HOST
  OPENCLAW_DASHBOARD_PORT
  OPENCLAW_LISTEN_HOST
  OPENCLAW_LISTEN_PORT

Notes:
  - `tmux` remains the preferred interactive dev path via `scripts/local-stack.sh`
  - `launchd` is for stable always-on local services on this Mac
EOF
}

require_command() {
  local command_name="$1"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing required command: $command_name" >&2
    exit 1
  fi
}

write_dashboard_plist() {
  cat >"$DASHBOARD_PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${DASHBOARD_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/opt/homebrew/bin/npm</string>
    <string>run</string>
    <string>dev</string>
    <string>--</string>
    <string>--hostname</string>
    <string>${DASHBOARD_HOST}</string>
    <string>--port</string>
    <string>${DASHBOARD_PORT}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${ROOT_DIR}/apps/dashboard</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${ROOT_DIR}/shared/logs/launchd-dashboard.out.log</string>
  <key>StandardErrorPath</key>
  <string>${ROOT_DIR}/shared/logs/launchd-dashboard.err.log</string>
</dict>
</plist>
EOF
}

write_listen_plist() {
  cat >"$LISTEN_PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LISTEN_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/python3</string>
    <string>${ROOT_DIR}/apps/listen/listen_server.py</string>
    <string>--host</string>
    <string>${LISTEN_HOST}</string>
    <string>--port</string>
    <string>${LISTEN_PORT}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${ROOT_DIR}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${ROOT_DIR}/shared/logs/launchd-listen.out.log</string>
  <key>StandardErrorPath</key>
  <string>${ROOT_DIR}/shared/logs/launchd-listen.err.log</string>
</dict>
</plist>
EOF
}

bootout_if_loaded() {
  local label="$1"
  launchctl bootout "gui/$(id -u)/${label}" >/dev/null 2>&1 || true
}

bootstrap_plist() {
  local plist_path="$1"
  launchctl bootstrap "gui/$(id -u)" "$plist_path"
  launchctl enable "gui/$(id -u)/$(basename "$plist_path" .plist)"
  launchctl kickstart -k "gui/$(id -u)/$(basename "$plist_path" .plist)"
}

install_agents() {
  require_command launchctl
  mkdir -p "$LAUNCH_AGENTS_DIR" "${ROOT_DIR}/shared/logs"
  write_dashboard_plist
  write_listen_plist
  bootout_if_loaded "$DASHBOARD_LABEL"
  bootout_if_loaded "$LISTEN_LABEL"
  bootstrap_plist "$DASHBOARD_PLIST"
  bootstrap_plist "$LISTEN_PLIST"
  echo "Installed LaunchAgents:"
  echo "  - ${DASHBOARD_LABEL}"
  echo "  - ${LISTEN_LABEL}"
}

uninstall_agents() {
  require_command launchctl
  bootout_if_loaded "$DASHBOARD_LABEL"
  bootout_if_loaded "$LISTEN_LABEL"
  rm -f "$DASHBOARD_PLIST" "$LISTEN_PLIST"
  echo "Removed LaunchAgents:"
  echo "  - ${DASHBOARD_LABEL}"
  echo "  - ${LISTEN_LABEL}"
}

status_agents() {
  require_command launchctl
  echo "[launchd] ${DASHBOARD_LABEL}"
  launchctl print "gui/$(id -u)/${DASHBOARD_LABEL}" 2>/dev/null | sed -n '1,20p' || echo "  not loaded"
  echo
  echo "[launchd] ${LISTEN_LABEL}"
  launchctl print "gui/$(id -u)/${LISTEN_LABEL}" 2>/dev/null | sed -n '1,20p' || echo "  not loaded"
}

command_name="${1:-install}"

case "$command_name" in
  install)
    install_agents
    ;;
  uninstall)
    uninstall_agents
    ;;
  restart)
    uninstall_agents
    install_agents
    ;;
  status)
    status_agents
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
