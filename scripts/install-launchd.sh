#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LAUNCH_AGENTS_DIR="${HOME}/Library/LaunchAgents"
DEFAULT_PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
MAC_MINI_DASHBOARD_LABEL="${OPENCLAW_MAC_MINI_DASHBOARD_LABEL:-dev.openclaw.dashboard.mac-mini}"
MAC_MINI_LISTEN_LABEL="${OPENCLAW_MAC_MINI_LISTEN_LABEL:-dev.openclaw.listen.mac-mini}"

DASHBOARD_LABEL="${OPENCLAW_DASHBOARD_LABEL:-dev.openclaw.dashboard}"
LISTEN_LABEL="${OPENCLAW_LISTEN_LABEL:-dev.openclaw.listen}"

DASHBOARD_HOST="${OPENCLAW_DASHBOARD_HOST:-0.0.0.0}"
DASHBOARD_PORT="${OPENCLAW_DASHBOARD_PORT:-3000}"
LISTEN_HOST="${OPENCLAW_LISTEN_HOST:-127.0.0.1}"
LISTEN_PORT="${OPENCLAW_LISTEN_PORT:-7600}"
MAC_MINI_DASHBOARD_HOST="${OPENCLAW_MAC_MINI_DASHBOARD_HOST:-$DASHBOARD_HOST}"
MAC_MINI_DASHBOARD_PORT="${OPENCLAW_MAC_MINI_DASHBOARD_PORT:-3100}"
MAC_MINI_LISTEN_HOST="${OPENCLAW_MAC_MINI_LISTEN_HOST:-$LISTEN_HOST}"
MAC_MINI_LISTEN_PORT="${OPENCLAW_MAC_MINI_LISTEN_PORT:-7601}"

DASHBOARD_PLIST="${LAUNCH_AGENTS_DIR}/${DASHBOARD_LABEL}.plist"
LISTEN_PLIST="${LAUNCH_AGENTS_DIR}/${LISTEN_LABEL}.plist"

usage() {
  cat <<'EOF'
Usage: scripts/install-launchd.sh [install|restart|uninstall|status|install-mac-mini|restart-mac-mini|uninstall-mac-mini|status-mac-mini]

Commands:
  install     Install and load dashboard + listen LaunchAgents.
  uninstall   Unload and remove dashboard + listen LaunchAgents.
  restart     Reinstall and reload both LaunchAgents.
  status      Show launchctl state for both LaunchAgents.
  install-mac-mini
              Install additive mac-mini compatibility LaunchAgents.
  uninstall-mac-mini
              Remove the additive mac-mini compatibility LaunchAgents.
  restart-mac-mini
              Reinstall the additive mac-mini compatibility LaunchAgents.
  status-mac-mini
              Show launchctl state for the additive mac-mini compatibility LaunchAgents.

Environment overrides:
  OPENCLAW_DASHBOARD_LABEL
  OPENCLAW_LISTEN_LABEL
  OPENCLAW_DASHBOARD_HOST
  OPENCLAW_DASHBOARD_PORT
  OPENCLAW_LISTEN_HOST
  OPENCLAW_LISTEN_PORT
  OPENCLAW_MAC_MINI_DASHBOARD_HOST
  OPENCLAW_MAC_MINI_DASHBOARD_PORT
  OPENCLAW_MAC_MINI_LISTEN_HOST
  OPENCLAW_MAC_MINI_LISTEN_PORT

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
  local plist_path="$1"
  local label="$2"
  local dashboard_host="$3"
  local dashboard_port="$4"
  local stdout_path="$5"
  local stderr_path="$6"
  local mac_mini_mode="${7:-0}"

  cat >"$plist_path" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${label}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/opt/homebrew/bin/npm</string>
    <string>run</string>
    <string>dev</string>
    <string>--</string>
    <string>--hostname</string>
    <string>${dashboard_host}</string>
    <string>--port</string>
    <string>${dashboard_port}</string>
  </array>
EOF

  if [[ "$mac_mini_mode" == "1" ]]; then
    cat >>"$plist_path" <<EOF
  <key>EnvironmentVariables</key>
  <dict>
    <key>NEXT_IGNORE_INCORRECT_LOCKFILE</key>
    <string>1</string>
    <key>PATH</key>
    <string>${DEFAULT_PATH}</string>
  </dict>
EOF
  fi

  cat >>"$plist_path" <<EOF
  <key>WorkingDirectory</key>
  <string>${ROOT_DIR}/apps/dashboard</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${stdout_path}</string>
  <key>StandardErrorPath</key>
  <string>${stderr_path}</string>
</dict>
</plist>
EOF
}

write_listen_plist() {
  local plist_path="$1"
  local label="$2"
  local listen_host="$3"
  local listen_port="$4"
  local stdout_path="$5"
  local stderr_path="$6"
  local mac_mini_mode="${7:-0}"
  local python_bin="/usr/bin/python3"
  if [[ "$mac_mini_mode" == "1" ]]; then
    python_bin="/opt/homebrew/bin/python3"
  fi

  cat >"$plist_path" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${label}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${python_bin}</string>
    <string>${ROOT_DIR}/apps/listen/listen_server.py</string>
    <string>--host</string>
    <string>${listen_host}</string>
    <string>--port</string>
    <string>${listen_port}</string>
  </array>
EOF

  if [[ "$mac_mini_mode" == "1" ]]; then
    cat >>"$plist_path" <<EOF
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>${DEFAULT_PATH}</string>
  </dict>
EOF
  fi

  cat >>"$plist_path" <<EOF
  <key>WorkingDirectory</key>
  <string>${ROOT_DIR}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${stdout_path}</string>
  <key>StandardErrorPath</key>
  <string>${stderr_path}</string>
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
  local dashboard_label="$1"
  local listen_label="$2"
  local dashboard_plist="$3"
  local listen_plist="$4"
  local dashboard_host="$5"
  local dashboard_port="$6"
  local listen_host="$7"
  local listen_port="$8"
  local dashboard_stdout="$9"
  local dashboard_stderr="${10}"
  local listen_stdout="${11}"
  local listen_stderr="${12}"
  local mac_mini_mode="${13:-0}"

  require_command launchctl
  mkdir -p "$LAUNCH_AGENTS_DIR" "${ROOT_DIR}/shared/logs"
  write_dashboard_plist "$dashboard_plist" "$dashboard_label" "$dashboard_host" "$dashboard_port" "$dashboard_stdout" "$dashboard_stderr" "$mac_mini_mode"
  write_listen_plist "$listen_plist" "$listen_label" "$listen_host" "$listen_port" "$listen_stdout" "$listen_stderr" "$mac_mini_mode"
  bootout_if_loaded "$dashboard_label"
  bootout_if_loaded "$listen_label"
  bootstrap_plist "$dashboard_plist"
  bootstrap_plist "$listen_plist"
  echo "Installed LaunchAgents:"
  echo "  - ${dashboard_label}"
  echo "  - ${listen_label}"
}

uninstall_agents() {
  local dashboard_label="$1"
  local listen_label="$2"
  local dashboard_plist="$3"
  local listen_plist="$4"

  require_command launchctl
  bootout_if_loaded "$dashboard_label"
  bootout_if_loaded "$listen_label"
  rm -f "$dashboard_plist" "$listen_plist"
  echo "Removed LaunchAgents:"
  echo "  - ${dashboard_label}"
  echo "  - ${listen_label}"
}

status_agents() {
  local dashboard_label="$1"
  local listen_label="$2"

  require_command launchctl
  echo "[launchd] ${dashboard_label}"
  launchctl print "gui/$(id -u)/${dashboard_label}" 2>/dev/null | sed -n '1,20p' || echo "  not loaded"
  echo
  echo "[launchd] ${listen_label}"
  launchctl print "gui/$(id -u)/${listen_label}" 2>/dev/null | sed -n '1,20p' || echo "  not loaded"
}

command_name="${1:-install}"
mac_mini_dashboard_plist="${LAUNCH_AGENTS_DIR}/${MAC_MINI_DASHBOARD_LABEL}.plist"
mac_mini_listen_plist="${LAUNCH_AGENTS_DIR}/${MAC_MINI_LISTEN_LABEL}.plist"
dashboard_stdout="${ROOT_DIR}/shared/logs/launchd-dashboard.out.log"
dashboard_stderr="${ROOT_DIR}/shared/logs/launchd-dashboard.err.log"
listen_stdout="${ROOT_DIR}/shared/logs/launchd-listen.out.log"
listen_stderr="${ROOT_DIR}/shared/logs/launchd-listen.err.log"
mac_mini_dashboard_stdout="${ROOT_DIR}/shared/logs/launchd-dashboard-mac-mini.out.log"
mac_mini_dashboard_stderr="${ROOT_DIR}/shared/logs/launchd-dashboard-mac-mini.err.log"
mac_mini_listen_stdout="${ROOT_DIR}/shared/logs/launchd-listen-mac-mini.out.log"
mac_mini_listen_stderr="${ROOT_DIR}/shared/logs/launchd-listen-mac-mini.err.log"

case "$command_name" in
  install)
    install_agents "$DASHBOARD_LABEL" "$LISTEN_LABEL" "$DASHBOARD_PLIST" "$LISTEN_PLIST" "$DASHBOARD_HOST" "$DASHBOARD_PORT" "$LISTEN_HOST" "$LISTEN_PORT" "$dashboard_stdout" "$dashboard_stderr" "$listen_stdout" "$listen_stderr"
    ;;
  uninstall)
    uninstall_agents "$DASHBOARD_LABEL" "$LISTEN_LABEL" "$DASHBOARD_PLIST" "$LISTEN_PLIST"
    ;;
  restart)
    uninstall_agents "$DASHBOARD_LABEL" "$LISTEN_LABEL" "$DASHBOARD_PLIST" "$LISTEN_PLIST"
    install_agents "$DASHBOARD_LABEL" "$LISTEN_LABEL" "$DASHBOARD_PLIST" "$LISTEN_PLIST" "$DASHBOARD_HOST" "$DASHBOARD_PORT" "$LISTEN_HOST" "$LISTEN_PORT" "$dashboard_stdout" "$dashboard_stderr" "$listen_stdout" "$listen_stderr"
    ;;
  status)
    status_agents "$DASHBOARD_LABEL" "$LISTEN_LABEL"
    ;;
  install-mac-mini)
    install_agents "$MAC_MINI_DASHBOARD_LABEL" "$MAC_MINI_LISTEN_LABEL" "$mac_mini_dashboard_plist" "$mac_mini_listen_plist" "$MAC_MINI_DASHBOARD_HOST" "$MAC_MINI_DASHBOARD_PORT" "$MAC_MINI_LISTEN_HOST" "$MAC_MINI_LISTEN_PORT" "$mac_mini_dashboard_stdout" "$mac_mini_dashboard_stderr" "$mac_mini_listen_stdout" "$mac_mini_listen_stderr" 1
    ;;
  uninstall-mac-mini)
    uninstall_agents "$MAC_MINI_DASHBOARD_LABEL" "$MAC_MINI_LISTEN_LABEL" "$mac_mini_dashboard_plist" "$mac_mini_listen_plist"
    ;;
  restart-mac-mini)
    uninstall_agents "$MAC_MINI_DASHBOARD_LABEL" "$MAC_MINI_LISTEN_LABEL" "$mac_mini_dashboard_plist" "$mac_mini_listen_plist"
    install_agents "$MAC_MINI_DASHBOARD_LABEL" "$MAC_MINI_LISTEN_LABEL" "$mac_mini_dashboard_plist" "$mac_mini_listen_plist" "$MAC_MINI_DASHBOARD_HOST" "$MAC_MINI_DASHBOARD_PORT" "$MAC_MINI_LISTEN_HOST" "$MAC_MINI_LISTEN_PORT" "$mac_mini_dashboard_stdout" "$mac_mini_dashboard_stderr" "$mac_mini_listen_stdout" "$mac_mini_listen_stderr" 1
    ;;
  status-mac-mini)
    status_agents "$MAC_MINI_DASHBOARD_LABEL" "$MAC_MINI_LISTEN_LABEL"
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
