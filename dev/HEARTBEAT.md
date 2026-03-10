# HEARTBEAT.md - Dev Agent Periodic Tasks

## State Management

Before starting, read `heartbeat-state.json` from this agent's directory. Use it to:
- Skip messages already in `processedMessages` (by filename)
- Track `lastRun` and `lastInboxCheck` timestamps
- Increment `counters.messagesProcessed` for each new message handled

After completing all steps, write the updated state back to `heartbeat-state.json`.

## Tasks

1. **Git status** - Read `shared/repos.json` for the list of watched repos. For each repo with a `local` path, check `git -C {path} status` for uncommitted changes or stale branches. If stale branches are found (merged and older than 14 days), propose deletion via inbox message to main — **never delete branches without human approval**.
2. **CI check** - Review recent CI runs via `gh run list` for any failures that need attention.
3. **PR review** - Check for open PRs awaiting review or with new comments.
4. **Check inbox** - Read all `*.json` files in `shared/inbox/dev/`. Process unread messages by priority. Update status to `"read"` or `"actioned"`. For CI-related messages, investigate and report back to sender's inbox. See `shared/PROTOCOL.md`.
5. **Memory maintenance** - Consolidate useful patterns and solutions into MEMORY.md.

## Logging

6. **Activity log** - After completing all steps, append one JSONL line to `shared/logs/activity.jsonl`:
    ```json
    {"timestamp":"...","type":"heartbeat","agent":"dev","inbox_processed":N,"duration_ms":N}
    ```
