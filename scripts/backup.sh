#!/usr/bin/env bash
set -euo pipefail

# Encrypted backup of OpenClaw config files
# Usage: ./backup.sh [passphrase]
# If no passphrase provided, prompts interactively.

BACKUP_DIR="$HOME/.openclaw/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
ARCHIVE_NAME="openclaw-backup-${TIMESTAMP}"
TMP_DIR=$(mktemp -d)
MAX_BACKUPS=5

mkdir -p "$BACKUP_DIR"

# Collect files to back up
echo "Collecting config files..."
mkdir -p "$TMP_DIR/config"

cp "$HOME/.openclaw/openclaw.json" "$TMP_DIR/config/" 2>/dev/null || true
cp -r "$HOME/.openclaw/identity/" "$TMP_DIR/config/identity/" 2>/dev/null || true
cp -r "$HOME/.openclaw/credentials/" "$TMP_DIR/config/credentials/" 2>/dev/null || true
cp "$HOME/Library/LaunchAgents/ai.openclaw.gateway.plist" "$TMP_DIR/config/" 2>/dev/null || true

# Create tar archive
echo "Creating archive..."
tar -czf "$TMP_DIR/${ARCHIVE_NAME}.tar.gz" -C "$TMP_DIR" config

# Encrypt
echo "Encrypting..."
if [ -n "${1:-}" ]; then
  PASS="$1"
else
  read -rsp "Enter encryption passphrase: " PASS
  echo
fi

openssl enc -aes-256-cbc -salt -pbkdf2 \
  -in "$TMP_DIR/${ARCHIVE_NAME}.tar.gz" \
  -out "$BACKUP_DIR/${ARCHIVE_NAME}.tar.gz.enc" \
  -pass "pass:${PASS}"

# Cleanup temp
rm -rf "$TMP_DIR"

# Rotate: keep only last N backups
BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/openclaw-backup-*.tar.gz.enc 2>/dev/null | wc -l | tr -d ' ')
if [ "$BACKUP_COUNT" -gt "$MAX_BACKUPS" ]; then
  ls -1t "$BACKUP_DIR"/openclaw-backup-*.tar.gz.enc | tail -n +"$((MAX_BACKUPS + 1))" | xargs rm -f
  echo "Rotated old backups (keeping last $MAX_BACKUPS)."
fi

echo "Backup saved: $BACKUP_DIR/${ARCHIVE_NAME}.tar.gz.enc"
echo "To restore: openssl enc -aes-256-cbc -d -pbkdf2 -in FILE -out backup.tar.gz -pass pass:PASSPHRASE && tar xzf backup.tar.gz"
