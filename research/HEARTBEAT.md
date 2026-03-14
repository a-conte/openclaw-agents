# HEARTBEAT.md - Research Agent Periodic Tasks

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

Remove any entries from `processedMessages` that reference files no longer present in `shared/inbox/research/`. This prevents unbounded state growth.

## Resilience

If any step fails (tool not found, command error, timeout), log the failure and continue to the next step. Never abort the entire heartbeat because one step failed.

## Tasks

1. **Check inbox** - Read all `*.json` files in `shared/inbox/research/`. Process unread messages. If Main requests a research summary, compile findings and send back via `shared/inbox/main/`. See `shared/PROTOCOL.md`.
2. **RSS feeds** - Check FreshRSS for new articles in tracked feeds. Summarize anything noteworthy.
3. **Blog monitoring** - Run blogwatcher for any monitored blogs with new posts.
4. **Proactive reporting** - If noteworthy findings are discovered in steps 2-3 (significant news, breaking developments, or items matching Anthony's interests), write a summary to `shared/inbox/main/` with priority `"normal"` and subject `"Research Finding: {topic}"`.
5. **Memory maintenance** - Consolidate useful patterns and research findings into MEMORY.md.

## Logging

6. **Activity log** - After completing all steps, append one JSONL line to `shared/logs/activity.jsonl`:
    ```json
    {"timestamp":"...","type":"heartbeat","agent":"research","inbox_processed":N,"duration_ms":N,"details":{"steps_ok":[...],"steps_failed":[...]}}
    ```
