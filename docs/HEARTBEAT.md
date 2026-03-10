# HEARTBEAT.md - Docs Agent Periodic Tasks

## State Management

Before starting, read `heartbeat-state.json` from this agent's directory. Use it to:
- Skip messages already in `processedMessages` (by filename)
- Track `lastRun` and `lastInboxCheck` timestamps
- Increment `counters.messagesProcessed` for each new message handled

After completing all steps, write the updated state back to `heartbeat-state.json`.

## Tasks

1. **Documentation staleness** - Check if any key documents (TOOLS.md, MEMORY.md, README files) have outdated information.
2. **Obsidian vault** - Quick check for orphaned notes or inbox items that need filing.
3. **Check inbox** - Read all `*.json` files in `shared/inbox/docs/`. Process documentation update requests from other agents. See `shared/PROTOCOL.md`.
4. **Memory maintenance** - Consolidate useful patterns into MEMORY.md.

## Logging

5. **Activity log** - After completing all steps, append one JSONL line to `shared/logs/activity.jsonl`:
    ```json
    {"timestamp":"...","type":"heartbeat","agent":"docs","inbox_processed":N,"duration_ms":N}
    ```
