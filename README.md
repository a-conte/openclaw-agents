# OpenClaw Agents

Personal AI assistant system running on [OpenClaw](https://openclaw.ai), hosted on an Intel MacBook (x86_64) repurposed as a home server.

Monorepo containing all 7 agent workspaces — each with its own personality, memory, and configuration.

## Overview

- **Model:** OpenAI Codex (`openai-codex/gpt-5.4` at time of last update)
- **Gateway:** Local LaunchAgent on port 18789
- **Channel:** Telegram (7 bots — main + 6 specialized agents)
- **Skills:** See `SETUP.md` for the current inventory and install notes
- **Plugins:** memory-lancedb, telegram, voice-call

## Repo Structure

Current layout:

```
openclaw-agents/
├── apps/
│   ├── dashboard/     # Desktop Mission Control web app
│   ├── drive/         # tmux + process control CLI for agents
│   └── steer/         # macOS app automation CLI for agents
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
├── security/          # Security monitoring and hardening
├── shared/            # Shared data, inboxes, repos, workflows, pipelines
├── scripts/           # Utility scripts (push, etc.)
├── thoughts/          # Planning and research notes
├── .github/workflows/ # CI, validation, and secret scanning
├── SETUP.md           # Full skill/plugin/infra reference
└── README.md
```

Each folder is symlinked from `~/.openclaw/workspace*` so OpenClaw reads/writes directly to this repo.

Incoming Mission Control layout:

```text
openclaw-agents/
├── apps/
│   ├── dashboard/     # Desktop Mission Control web app
│   ├── drive/         # tmux + process control CLI
│   ├── steer/         # macOS automation CLI
│   └── ios/           # Native SwiftUI iPad / iPhone clients
├── packages/
│   └── contracts/     # Shared client-facing schemas and types
├── docs/architecture/ios-mission-control/
└── ...existing agent workspaces...
```

The repo is being migrated toward this structure incrementally so desktop and iOS clients can share stable contracts without forcing a full workspace reorganization up front.

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

## Local Startup

Start the dashboard and automation runtime together:

```bash
./scripts/local-stack.sh start
```

The stable operator flow is documented in [docs/local-startup.md](/Users/a_conte/dev/openclaw-agents/docs/local-startup.md).

For always-on local services that survive shell churn and re-login, use:

```bash
./scripts/install-launchd.sh install
```

For a quick machine-wide snapshot:

```bash
./scripts/status-everything.sh
```

## Setup

See [SETUP.md](SETUP.md) for full details on skills, plugins, and infrastructure.
