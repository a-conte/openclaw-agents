#!/bin/bash
# harden.sh — One-time security hardening setup for OpenClaw home server
# Run manually: ./scripts/harden.sh

set -euo pipefail

echo "=== OpenClaw Security Hardening ==="
echo ""

# 1. macOS Firewall
echo "[1/4] Checking macOS Firewall..."
fw_status=$(sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate 2>/dev/null || echo "unknown")
if echo "$fw_status" | grep -q "enabled"; then
  echo "  Firewall is already enabled."
else
  echo "  Enabling macOS firewall..."
  sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate on
  echo "  Firewall enabled."
fi

# Enable stealth mode (don't respond to pings from unknown sources)
echo "  Enabling stealth mode..."
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setstealthmode on
echo "  Stealth mode enabled."

# 2. Tailscale
echo ""
echo "[2/4] Checking Tailscale..."
if command -v tailscale &> /dev/null; then
  ts_status=$(tailscale status --json 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('BackendState','unknown'))" 2>/dev/null || echo "unknown")
  if [[ "$ts_status" == "Running" ]]; then
    echo "  Tailscale is running."
  else
    echo "  Tailscale is installed but not running. Start it with: tailscale up"
  fi
else
  echo "  Tailscale is not installed."
  echo "  Install: brew install tailscale"
  echo "  Then run: tailscale up"
fi

# 3. SSH hardening
echo ""
echo "[3/4] Checking SSH configuration..."
sshd_config="/etc/ssh/sshd_config"
if [[ -f "$sshd_config" ]]; then
  # Check for password authentication
  if grep -q "^PasswordAuthentication yes" "$sshd_config" 2>/dev/null; then
    echo "  WARNING: Password authentication is enabled for SSH."
    echo "  Consider setting 'PasswordAuthentication no' in $sshd_config"
  else
    echo "  SSH password auth: disabled or not configured (good)."
  fi

  # Check for root login
  if grep -q "^PermitRootLogin yes" "$sshd_config" 2>/dev/null; then
    echo "  WARNING: Root login is enabled for SSH."
    echo "  Consider setting 'PermitRootLogin no' in $sshd_config"
  else
    echo "  SSH root login: disabled or not configured (good)."
  fi
else
  echo "  No sshd_config found — SSH server may not be configured."
fi

# 4. Port check
echo ""
echo "[4/4] Checking open ports..."
echo "  Listening ports:"
lsof -i -P -n 2>/dev/null | grep LISTEN | awk '{print "    " $1 " -> " $9}' | sort -u || echo "  Could not check ports."

echo ""
echo "=== Gateway Port Check ==="
if lsof -i :18789 -P -n 2>/dev/null | grep -q LISTEN; then
  echo "  Gateway port 18789 is listening."
  # Check if bound to localhost only
  if lsof -i :18789 -P -n 2>/dev/null | grep -q "127.0.0.1"; then
    echo "  Bound to localhost only (good)."
  else
    echo "  WARNING: Gateway may be accessible from network. Consider binding to 127.0.0.1 only."
  fi
else
  echo "  Gateway port 18789 is not listening."
fi

echo ""
echo "=== Hardening Complete ==="
echo "Recommendations:"
echo "  1. Install Tailscale for secure remote access: brew install tailscale"
echo "  2. Restrict gateway to localhost + Tailscale interface"
echo "  3. Review open ports above and close any unnecessary ones"
echo "  4. Set up the watchdog cron job: */5 * * * * ~/openclaw-agents/scripts/watchdog.sh"
