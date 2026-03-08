# MEMORY.md - Long-Term Memory

## Current State (2026-03-07)

### Active Focus
- OpenClaw fully configured — monorepo with 6 agents (main, mail, docs, research, ai-research, dev)
- Daily workflow: email triage, Obsidian vault maintenance, file cleanup

### Setup Status
- OpenClaw v2026.3.2 running on Codex (gpt-5.3-codex for sub-agents, gpt-5.2 for main)
- 58 skills ready (out of 67 total; 9 missing deps like BlueBubbles, Discord, Slack, etc.)
- 19 community/workspace skills installed (freshrss, memoclaw, paperless, kokoro-tts, etc.)
- Telegram: 7 bot accounts connected (main + 5 specialized agents)
- Voice transcription working (faster-whisper, openai-whisper, openai-whisper-api)
- Voice replies configured (Edge TTS, inbound mode)
- Tailscale enabled on gateway
- Cron: casual-cron skill available (CRON_DEFAULT_CHANNEL=telegram)
- Memory: LanceDB vector memory plugin active, memoclaw available
- Heartbeat: configured with periodic checks
- Monorepo: ~/openclaw-agents with push.sh script

### Preferences Learned
- Wants brief, direct communication
- Approval required before any outbound messages/emails
- Quiet hours after 10pm ET
