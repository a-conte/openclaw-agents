# HEARTBEAT.md - Dev Agent Periodic Tasks

## Timing

Record the current epoch milliseconds at the very start of the heartbeat (before any other work).
At the end, compute `duration_ms = end_epoch_ms - start_epoch_ms`. Use this value in the activity log.
Never hardcode or estimate `duration_ms`.

## State Management

Before starting, read `heartbeat-state.json` from this agent's directory. Use it to:
- Skip messages already in `processedMessages` (by filename)
- Track `lastRun` and `lastInboxCheck` timestamps
- Increment `counters.messagesProcessed` for each new message handled

After completing all steps, write the updated state back to `heartbeat-state.json`.

## State Cleanup

Remove any entries from `processedMessages` that reference files no longer present in `shared/inbox/dev/`. This prevents unbounded state growth.

## Resilience

If any step fails (tool not found, command error, timeout), log the failure and continue to the next step. Never abort the entire heartbeat because one step failed.

## Tasks

1. **Check inbox** - Read all `*.json` files in `shared/inbox/dev/`. Process unread messages by priority. Update status to `"read"` or `"actioned"`. For CI-related messages, investigate and report back to sender's inbox. See `shared/PROTOCOL.md`.
2. **Git status** - Read `shared/repos.json` for the list of watched repos. For each repo with a `local` path, check `git -C {path} status` for uncommitted changes or stale branches. If stale branches are found (merged and older than 14 days), propose deletion via inbox message to main — **never delete branches without human approval**.
3. **CI check** - Review recent CI runs via `gh run list` for any failures that need attention.
4. **PR review** - Check for open PRs awaiting review or with new comments.
5. **Proactive reporting** - If CI failures are detected in step 3, write a message to `shared/inbox/main/` with priority `"high"` and subject `"CI Failure: {repo}/{workflow}"`. Include the failure details, affected branch, and link to the run.
6. **Infrastructure checks**:
    - Disk space: run `df -h /` and alert if usage exceeds 80% (write to `shared/inbox/main/` with priority `"high"`)
    - Backup freshness: check if latest backup in `~/.openclaw/backups/` is older than 24 hours (alert to main if so)
    - LaunchAgent status: run `launchctl list | grep openclaw` to verify services are loaded
7. **Memory maintenance** - Consolidate useful patterns and solutions into MEMORY.md.

## Logging

8. **Activity log** - After completing all steps, append one JSONL line to `shared/logs/activity.jsonl`:
    ```json
    {"timestamp":"...","type":"heartbeat","agent":"dev","inbox_processed":N,"duration_ms":N,"details":{"steps_ok":[...],"steps_failed":[...]}}
    ```
