#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DASHBOARD_DIR="$ROOT_DIR/apps/dashboard"
IOS_DIR="$ROOT_DIR/apps/ios"
LISTEN_PORT="${OPENCLAW_LISTEN_PORT:-7600}"
LISTEN_HOST="${OPENCLAW_LISTEN_HOST:-127.0.0.1}"

INSTALL_DEPS=0
GENERATE_IOS=0
RUN_CHECKS=0

usage() {
  cat <<'EOF'
Usage: scripts/bootstrap-mac.sh [options]

Options:
  --install-deps    Install baseline Homebrew dependencies.
  --generate-ios    Generate the iOS Xcode project with xcodegen.
  --check           Run automation and service smoke checks.
  -h, --help        Show this help text.

If no options are provided, the script runs the verification path.
EOF
}

log() {
  printf '\n[%s] %s\n' "$(date '+%H:%M:%S')" "$1"
}

require_command() {
  local command_name="$1"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing required command: $command_name" >&2
    return 1
  fi
}

check_service() {
  local name="$1"
  local url="$2"
  if curl --silent --show-error --fail --max-time 5 "$url" >/dev/null; then
    printf '  [ok] %s reachable at %s\n' "$name" "$url"
  else
    printf '  [warn] %s not reachable at %s\n' "$name" "$url"
  fi
}

install_dependencies() {
  require_command brew
  log "Installing baseline dependencies"
  brew install tmux xcodegen
}

generate_ios_project() {
  require_command xcodegen
  log "Generating iOS project"
  (cd "$ROOT_DIR" && xcodegen generate --spec apps/ios/project.yml)
}

check_permissions() {
  log "Permission checklist"
  echo "  Confirm the active terminal has:"
  echo "  - Accessibility"
  echo "  - Screen Recording"
  echo "  - Automation approval for Safari/System Events when prompted"
  if python3 "$ROOT_DIR/apps/steer/steer_cli.py" apps --json >/dev/null 2>&1; then
    echo "  [ok] steer accessibility probe succeeded"
  else
    echo "  [warn] steer accessibility probe failed; verify Accessibility/Automation permissions"
  fi
}

run_checks() {
  require_command python3
  require_command npm
  require_command curl
  require_command tmux

  log "Checking local toolchain"
  printf '  python3: %s\n' "$(python3 --version 2>&1)"
  printf '  npm: %s\n' "$(npm --version 2>&1)"
  printf '  tmux: %s\n' "$(tmux -V 2>&1)"

  if command -v xcodebuild >/dev/null 2>&1; then
    printf '  xcodebuild: %s\n' "$(xcodebuild -version | tr '\n' ' ' | sed 's/ $//')"
  else
    echo "  [warn] xcodebuild not found"
  fi

  if command -v xcodegen >/dev/null 2>&1; then
    printf '  xcodegen: %s\n' "$(xcodegen --version 2>&1)"
  else
    echo "  [warn] xcodegen not found"
  fi

  log "Checking local service endpoints"
  check_service "dashboard" "http://127.0.0.1:3000/api/jobs"
  check_service "listen metrics" "http://${LISTEN_HOST}:${LISTEN_PORT}/metrics"
  check_service "listen policy" "http://${LISTEN_HOST}:${LISTEN_PORT}/policy"

  log "Running CLI smoke checks"
  python3 "$ROOT_DIR/apps/steer/steer_cli.py" apps --json >/dev/null
  python3 "$ROOT_DIR/apps/drive/drive_cli.py" session list --json >/dev/null
  python3 "$ROOT_DIR/apps/direct/direct_cli.py" templates >/dev/null
  echo "  [ok] steer / drive / direct checks passed"

  if [[ -f "$IOS_DIR/Local.xcconfig" ]]; then
    echo "  [ok] iOS local config present at $IOS_DIR/Local.xcconfig"
  else
    echo "  [warn] missing $IOS_DIR/Local.xcconfig"
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --install-deps)
      INSTALL_DEPS=1
      ;;
    --generate-ios)
      GENERATE_IOS=1
      ;;
    --check)
      RUN_CHECKS=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
  shift
done

if [[ $INSTALL_DEPS -eq 0 && $GENERATE_IOS -eq 0 && $RUN_CHECKS -eq 0 ]]; then
  RUN_CHECKS=1
fi

if [[ $INSTALL_DEPS -eq 1 ]]; then
  install_dependencies
fi

if [[ $GENERATE_IOS -eq 1 ]]; then
  generate_ios_project
fi

check_permissions

if [[ $RUN_CHECKS -eq 1 ]]; then
  run_checks
fi

log "Bootstrap workflow complete"
