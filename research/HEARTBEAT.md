# HEARTBEAT.md - Research Agent Periodic Tasks

## State Management

Before starting, read `heartbeat-state.json` from this agent's directory. Use it to:
- Skip messages already in `processedMessages` (by filename)
- Track `lastRun` and `lastInboxCheck` timestamps
- Increment `counters.messagesProcessed` for each new message handled

After completing all steps, write the updated state back to `heartbeat-state.json`.

## Tasks

1. **RSS feeds** - Check FreshRSS for new articles in tracked feeds. Summarize anything noteworthy.
2. **Blog monitoring** - Run blogwatcher for any monitored blogs with new posts.
3. **Check inbox** - Read all `*.json` files in `shared/inbox/research/`. Process unread messages. If Main requests a research summary, compile findings and send back via `shared/inbox/main/`. See `shared/PROTOCOL.md`.
4. **Memory maintenance** - Consolidate useful patterns and research findings into MEMORY.md.

## Logging

5. **Activity log** - After completing all steps, append one JSONL line to `shared/logs/activity.jsonl`:
    ```json
    {"timestamp":"...","type":"heartbeat","agent":"research","inbox_processed":N,"duration_ms":N}
    ```
