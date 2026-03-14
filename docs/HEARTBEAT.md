# HEARTBEAT.md - Docs Agent Periodic Tasks

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

Remove any entries from `processedMessages` that reference files no longer present in `shared/inbox/docs/`. This prevents unbounded state growth.

## Resilience

If any step fails (tool not found, command error, timeout), log the failure and continue to the next step. Never abort the entire heartbeat because one step failed.

## Tasks

1. **Check inbox** - Read all `*.json` files in `shared/inbox/docs/`. Process documentation update requests from other agents. See `shared/PROTOCOL.md`.
2. **Documentation staleness** - Check if any key documents (TOOLS.md, MEMORY.md, README files) have outdated information.
3. **Obsidian vault** - Quick check for orphaned notes or inbox items that need filing.
4. **Memory maintenance** - Consolidate useful patterns into MEMORY.md.

## Logging

5. **Activity log** - After completing all steps, append one JSONL line to `shared/logs/activity.jsonl`:
    ```json
    {"timestamp":"...","type":"heartbeat","agent":"docs","inbox_processed":N,"duration_ms":N,"details":{"steps_ok":[...],"steps_failed":[...]}}
    ```
