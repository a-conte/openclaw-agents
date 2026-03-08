# OpenClaw Workspace

Personal AI assistant running on [OpenClaw](https://openclaw.ai), hosted on an Intel MacBook (x86_64) repurposed as a home server.

## Overview

- **Model:** OpenAI Codex (gpt-5.3-codex)
- **Gateway:** Local LaunchAgent on port 18789
- **Channel:** Telegram (7 bots — main + 6 specialized agents)
- **Skills:** 58 active (44 built-in + 14 community)
- **Plugins:** memory-lancedb, telegram, voice-call

## Agents

| Agent | Purpose |
|-------|---------|
| **main** | General assistant, daily tasks, smart home |
| **mail** | Email triage and drafting |
| **docs** | Documentation and writing |
| **research** | General research |
| **ai-research** | AI/ML-specific research |
| **dev** | Software development |

Each agent has its own Telegram bot, workspace, and session history.

## Workspace Files

| File | Purpose |
|------|---------|
| `SOUL.md` | Personality, values, boundaries |
| `IDENTITY.md` | Name, emoji, avatar |
| `USER.md` | Info about the human (Anthony) |
| `AGENTS.md` | Agent behavior rules, memory system, heartbeat config |
| `TOOLS.md` | Local tool notes (email, speakers, etc.) |
| `HEARTBEAT.md` | Periodic check-in task list |
| `MEMORY.md` | Long-term curated memory |
| `skills/` | Community skills from ClawHub |

## Setup

See [SETUP.md](SETUP.md) for full details on skills, plugins, and infrastructure.
