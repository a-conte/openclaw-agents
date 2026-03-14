# MEMORY.md - Long-Term Memory

## Current State (2026-03-14)

### Agent Status
- **Identity:** Forge — code spirit
- **Heartbeat:** Never run (0 messages processed, no daily logs written)
- **Inbox:** `shared/inbox/dev/` — unchecked but main has processed 23 messages, many from dev

### Watched Repos
- `openclaw-agents` — monorepo at `~/dev/openclaw-agents`, default branch `main` (per `shared/repos.json`)

### Active Work Context
- Dashboard (Next.js) under `dashboard/` — recent commits include SSE chat, agent org chart, command recommendations, office tab upgrades
- 15 workflow runs recently failed with "Clean Workspace - Gateway agent failed; falling back to embedded: Error: gateway closed (1006 abnormal)"
- Workflow definitions in `shared/workflows/` — clean-workspace, needs-attention, prep-my-day, review-repos, weekly-review

### Setup Context
- Part of 7-agent OpenClaw team on Intel MacBook home server
- OpenClaw v2026.3.2, model: gpt-5.3-codex, 58 skills available
- LanceDB vector memory active, Telegram connected
- Primary tools: github/gh CLI, gh-issues, coding-agent
- Supporting: things-mac, session-logs, tmux, peekaboo, skill-creator
