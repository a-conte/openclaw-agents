# MEMORY.md - Long-Term Memory

## Current State (2026-03-14)

### Agent Status
- **Identity:** Sentinel — watchdog AI
- **Heartbeat:** Never run (0 messages processed, no daily logs written)
- **Inbox:** `shared/inbox/security/` — unchecked

### Known Blockers
- No daily memory logs or security baselines established yet.
- Config integrity hash baseline for `~/.openclaw/openclaw.json` not yet captured — first heartbeat should establish this.
- Network port baseline not yet established — first heartbeat should snapshot expected listeners (gateway 18789, SSH 22).

### Infrastructure to Monitor
- Gateway: LaunchAgent `ai.openclaw.gateway`, port 18789, local loopback
- Tailscale: enabled on gateway — device list should be baselined
- macOS firewall: status should be verified each heartbeat
- 7 Telegram bot tokens: should be validated periodically via getMe
- Environment secrets: OPENAI_API_KEY, GEMINI_API_KEY in `~/.zshenv` and LaunchAgent plist

### Setup Context
- Part of 7-agent OpenClaw team on Intel MacBook home server
- OpenClaw v2026.3.2, model: gpt-5.3-codex, 58 skills available
- LanceDB vector memory active, Telegram connected
- Primary tools: healthcheck, github/gh CLI, 1password
- Supporting: gotify, session-logs, tmux
- Network tools: lsof, tailscale, socketfilterfw, nmap
