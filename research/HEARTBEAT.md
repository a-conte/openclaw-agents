# HEARTBEAT.md - Research Agent Periodic Tasks

1. **RSS feeds** - Check FreshRSS for new articles in tracked feeds. Summarize anything noteworthy.
2. **Blog monitoring** - Run blogwatcher for any monitored blogs with new posts.
3. **Check inbox** - Read all `*.json` files in `shared/inbox/research/`. Process unread messages. If Main requests a research summary, compile findings and send back via `shared/inbox/main/`. See `shared/PROTOCOL.md`.
4. **Memory maintenance** - Consolidate useful patterns and research findings into MEMORY.md.
