# MEMORY.md - Long-Term Memory

## Current State (2026-03-14)

### Agent Status
- **Identity:** Postie — carrier pigeon AI
- **Status:** Disabled in dashboard (since ~2026-03-12)
- **Heartbeat:** Never run (0 messages processed, no daily logs written)
- **Inbox:** `shared/inbox/mail/` — unchecked

### Known Blockers
- **Himalaya unconfigured** on this machine — missing `~/Library/Application Support/himalaya/config.toml`. Email heartbeat checks will fail until this is set up.
- **gog unconfigured** — missing `~/Library/Application Support/gogcli/config.json`. Calendar checks will fail until configured.
- Agent was disabled in dashboard workflows; unclear if Telegram bot is still receiving messages.

### Setup Context
- Part of 7-agent OpenClaw team on Intel MacBook home server
- OpenClaw v2026.3.2, model: gpt-5.3-codex, 58 skills available
- LanceDB vector memory active, Telegram connected
- Primary tools: himalaya (IMAP/SMTP), gog (Google Workspace CLI)
- Supporting: summarize, things-mac, apple-reminders, gotify
