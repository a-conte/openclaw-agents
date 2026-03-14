# MEMORY.md - Long-Term Memory

## Current State (2026-03-14)

### Agent Status
- **Identity:** Index — digital librarian
- **Heartbeat:** Never run (0 messages processed, no daily logs written)
- **Inbox:** `shared/inbox/docs/` — unchecked

### Known Blockers
- **gog unconfigured** — missing `~/Library/Application Support/gogcli/config.json`. Google Docs/Sheets/Drive operations will fail until configured.
- No daily memory logs have been written yet — memory consolidation has nothing to work from.

### Setup Context
- Part of 7-agent OpenClaw team on Intel MacBook home server
- OpenClaw v2026.3.2, model: gpt-5.3-codex, 58 skills available
- LanceDB vector memory active, Telegram connected
- Primary tools: gog (Google Workspace CLI), obsidian, apple-notes, bear-notes, nano-pdf
- Supporting: paperless/paperless-ngx, summarize, humanize
- Has a `plans/` directory in workspace
