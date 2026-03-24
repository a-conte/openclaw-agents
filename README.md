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

For the additive mac-mini compatibility path, use:

```bash
./scripts/local-stack.sh start-mac-mini
```

That path keeps the existing default flow intact and runs a separate additive stack on ports `3100` and `7601` by default, with the stricter readiness waits and dashboard lockfile workaround only when explicitly requested.

For always-on local services that survive shell churn and re-login, use:

```bash
./scripts/install-launchd.sh install
```

For additive mac-mini compatibility LaunchAgents, use:

```bash
./scripts/install-launchd.sh install-mac-mini
```

Those LaunchAgents use separate labels, ports, and log files so they can exist alongside the primary setup instead of replacing it.

For a quick machine-wide snapshot:

```bash
./scripts/status-everything.sh
```

## Codex Guardrails

Claude-style protections are mirrored for Codex through additive guardrails:

```bash
python3 scripts/install_codex_guardrails.py
```

This installs managed shell rules into `~/.codex/rules/default.rules` without replacing your existing Codex rules. The current Codex CLI on this machine does not yet expose the same stable pre-tool hook model as Claude, so protected file and `.env` behavior is enforced through project instructions plus repo git hooks rather than native Codex hooks.

## Claude Hooks Mastery

If you want the additive `claude-code-hooks-mastery` hook pack available alongside Codex, install it with:

```bash
python3 scripts/install_claude_hooks_mastery.py
```

This merges hook configuration into `~/.claude/settings.json` without replacing your existing Claude plugins. The installer uses this repo's local [`.claude/`](/Users/a_conte/dev/openclaw-agents/.claude) asset pack, rewrites hook commands to absolute paths, and keeps notification/TTS behavior quiet by default. Restart Claude Code after installing so it reloads the hook snapshot.

To remove the managed Claude hook entries later:

```bash
python3 scripts/uninstall_claude_hooks_mastery.py
```

The repo-local [`.claude/`](/Users/a_conte/dev/openclaw-agents/.claude) directory now also carries the additive mac-mini command, skill, and prompt pack plus the hooks-mastery commands, output styles, status lines, and hook scripts, so Claude can run against a single OpenClaw-managed asset set.

## Listen And Direct

`apps/direct/direct_cli.py` is the additive CLI for the local `listen` server, and mac-mini-style operator shortcuts are exposed through:

```bash
just listen-server
just listen-templates
just listen-send "Reply with exactly OK"
just listen-jobs
just listen-job <job-id>
```

If you prefer to work inside the `listen` app directory, there is also an additive [`apps/listen/justfile`](/Users/a_conte/dev/openclaw-agents/apps/listen/justfile) with the same `send`, `jobs`, `job`, `latest`, `wait`, `stop`, `retry`, and `clear` commands pointed at the existing `apps/direct/direct_cli.py` client.

## Setup

See [SETUP.md](SETUP.md) for full details on skills, plugins, and infrastructure.
