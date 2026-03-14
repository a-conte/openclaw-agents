# HEARTBEAT.md - Mail Agent Periodic Tasks

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

Remove any entries from `processedMessages` that reference files no longer present in `shared/inbox/mail/`. This prevents unbounded state growth.

## Resilience

If any step fails (tool not found, command error, timeout), log the failure and continue to the next step. Never abort the entire heartbeat because one step failed. In particular, himalaya and gog may not be configured — if they return errors, skip those steps gracefully and proceed with inbox processing and memory maintenance.

## Tasks

1. **Check inter-agent inbox** - Read all `*.json` files in `shared/inbox/mail/`. Process unread messages (e.g., newsletter draft requests from Main). Update status to `"read"` or `"actioned"`. See `shared/PROTOCOL.md`.
2. **Check email** - Run `himalaya list -s unseen` for unread messages. Flag anything urgent (time-sensitive, from known important contacts). **If himalaya is not configured or returns an error, skip this step and note it in the activity log.**
3. **Calendar preview** - Check today's upcoming events via `gog cal today`. Alert if anything in the next 2 hours. **If gog is not configured or returns an error, skip this step and note it in the activity log.**
4. **Draft review** - Check for any pending drafts that may need sending.
5. **Urgent email escalation** - If an urgent unread email is found, send a message to `shared/inbox/main/` with subject "Urgent Email", priority "high", and a summary of the email.
6. **Memory maintenance** - Consolidate useful patterns into MEMORY.md.

## Logging

7. **Activity log** - After completing all steps, append one JSONL line to `shared/logs/activity.jsonl`:
    ```json
    {"timestamp":"...","type":"heartbeat","agent":"mail","inbox_processed":N,"duration_ms":N,"details":{"steps_ok":[...],"steps_failed":[...]}}
    ```
