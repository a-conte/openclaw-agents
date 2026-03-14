# HEARTBEAT.md - AI Research Agent Periodic Tasks

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

Remove any entries from `processedMessages` that reference files no longer present in `shared/inbox/ai-research/`. This prevents unbounded state growth.

## Resilience

If any step fails (tool not found, command error, timeout), log the failure and continue to the next step. Never abort the entire heartbeat because one step failed.

## Tasks

1. **Check inbox** - Read all `*.json` files in `shared/inbox/ai-research/`. Process unread messages. Send research summaries to `shared/inbox/main/` when requested. See `shared/PROTOCOL.md`.
2. **AI news scan** - Check FreshRSS for new AI-related articles. Prioritize: model releases, benchmark results, major papers, industry moves.
3. **Arxiv check** - Search for new papers relevant to supply chain AI, LLMs, and ML infrastructure.
4. **GitHub trending** - Check trending AI repos for notable new projects or releases.
5. **Proactive reporting** - If noteworthy findings are discovered in steps 2-4 (new model releases, major papers, significant industry moves), write a summary to `shared/inbox/main/` with priority `"normal"` and subject `"AI Research Finding: {topic}"`.
6. **Memory maintenance** - Consolidate findings into MEMORY.md. Update if landscape has shifted.

## Logging

7. **Activity log** - After completing all steps, append one JSONL line to `shared/logs/activity.jsonl`:
    ```json
    {"timestamp":"...","type":"heartbeat","agent":"ai-research","inbox_processed":N,"duration_ms":N,"details":{"steps_ok":[...],"steps_failed":[...]}}
    ```
