# OpenClaw Agents

Personal AI assistant system running on [OpenClaw](https://openclaw.ai), hosted on an Intel MacBook (x86_64) repurposed as a home server.

Monorepo containing all 6 agent workspaces — each with its own personality, memory, and configuration.

## Overview

- **Model:** OpenAI Codex (gpt-5.3-codex, 200k context)
- **Gateway:** Local LaunchAgent on port 18789
- **Channel:** Telegram (7 bots — main + 6 specialized agents)
- **Skills:** 58 active (44 built-in + 19 community)
- **Plugins:** memory-lancedb, telegram, voice-call

## Repo Structure

```
openclaw-agents/
├── main/              # General assistant, daily tasks, smart home
│   ├── SOUL.md
│   ├── IDENTITY.md
│   ├── USER.md
│   ├── AGENTS.md
│   ├── TOOLS.md
│   ├── HEARTBEAT.md
│   ├── MEMORY.md
│   └── skills/        # 19 community skills from ClawHub
├── mail/              # Email triage and drafting
├── docs/              # Documentation and writing
├── research/          # General research
├── ai-research/       # AI/ML-specific research
├── dev/               # Software development
├── scripts/           # Utility scripts (push, etc.)
├── .github/workflows/ # Secret scanning CI
├── SETUP.md           # Full skill/plugin/infra reference
└── README.md
```

Each folder is symlinked from `~/.openclaw/workspace*` so OpenClaw reads/writes directly to this repo.

## Agent Files

Each agent workspace contains:

| File | Purpose |
|------|---------|
| `SOUL.md` | Personality, values, boundaries (unique per agent) |
| `IDENTITY.md` | Name, emoji, avatar |
| `USER.md` | Info about the human (Anthony) |
| `AGENTS.md` | Behavior rules, memory system, heartbeat config |
| `TOOLS.md` | Local tool notes (email, speakers, etc.) |
| `HEARTBEAT.md` | Periodic check-in task list |
| `MEMORY.md` | Long-term curated memory |

## Quick Push

```bash
./scripts/push.sh                  # auto-commit and push all changes
./scripts/push.sh "custom message" # with a custom commit message
```

## Setup

See [SETUP.md](SETUP.md) for full details on skills, plugins, and infrastructure.
