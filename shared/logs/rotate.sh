#!/usr/bin/env bash
# Rotate activity.jsonl — keeps last 7 days of rotated files.
# Usage: run daily via cron or launchd.
#   0 0 * * * /path/to/openclaw-agents/shared/logs/rotate.sh

set -euo pipefail

LOGS_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_FILE="$LOGS_DIR/activity.jsonl"
MAX_DAYS=7

[ -f "$LOG_FILE" ] || exit 0

# Only rotate if file has content
[ -s "$LOG_FILE" ] || exit 0

DATE=$(date +%Y-%m-%d)
ROTATED="$LOGS_DIR/activity-$DATE.jsonl"

# Move current log and create fresh one (atomic for readers)
mv "$LOG_FILE" "$ROTATED"
touch "$LOG_FILE"

# Remove rotated files older than MAX_DAYS
find "$LOGS_DIR" -name 'activity-*.jsonl' -mtime +"$MAX_DAYS" -delete
