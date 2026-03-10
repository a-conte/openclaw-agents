# HEARTBEAT.md - AI Research Agent Periodic Tasks

## State Management

Before starting, read `heartbeat-state.json` from this agent's directory. Use it to:
- Skip messages already in `processedMessages` (by filename)
- Track `lastRun` and `lastInboxCheck` timestamps
- Increment `counters.messagesProcessed` for each new message handled

After completing all steps, write the updated state back to `heartbeat-state.json`.

## Tasks

1. **AI news scan** - Check FreshRSS for new AI-related articles. Prioritize: model releases, benchmark results, major papers, industry moves.
2. **Arxiv check** - Search for new papers relevant to supply chain AI, LLMs, and ML infrastructure.
3. **GitHub trending** - Check trending AI repos for notable new projects or releases.
4. **Check inbox** - Read all `*.json` files in `shared/inbox/ai-research/`. Process unread messages. Send research summaries to `shared/inbox/main/` when requested. See `shared/PROTOCOL.md`.
5. **Memory maintenance** - Consolidate findings into MEMORY.md. Update if landscape has shifted.

## Logging

6. **Activity log** - After completing all steps, append one JSONL line to `shared/logs/activity.jsonl`:
    ```json
    {"timestamp":"...","type":"heartbeat","agent":"ai-research","inbox_processed":N,"duration_ms":N}
    ```
