# HEARTBEAT.md - Dev Agent Periodic Tasks

1. **Git status** - Check `git status` across active repos for uncommitted changes or stale branches.
2. **CI check** - Review recent CI runs via `gh run list` for any failures that need attention.
3. **PR review** - Check for open PRs awaiting review or with new comments.
4. **Check inbox** - Read all `*.json` files in `shared/inbox/dev/`. Process unread messages by priority. Update status to `"read"` or `"actioned"`. For CI-related messages, investigate and report back to sender's inbox. See `shared/PROTOCOL.md`.
5. **Memory maintenance** - Consolidate useful patterns and solutions into MEMORY.md.
