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

## Operational Learnings (2026-03-13)

### What worked well
- Fast operational heartbeat loop: weather, inbox scan, repo status, state-file updates, and activity logging
- Concise blocker summaries are a good fit for Anthony when there is nothing new beyond one or two issues
- Session-log review is useful for spotting repeated failure modes and should be used for self-audits

### Recurring blockers to remember
- Himalaya is currently unconfigured on this machine in non-interactive runs. Missing file:
  `~/Library/Application Support/himalaya/config.toml`
- `gog` is currently unconfigured on this machine. Missing file:
  `~/Library/Application Support/gogcli/config.json`
- Until those are configured, heartbeat email/calendar checks will keep failing and should be summarized once, not rediscovered as if novel each run

### Practical command patterns
- Weather fallback that works reliably:
  `python3 - <<'PY'
import urllib.request
print(urllib.request.urlopen('https://wttr.in/?format=j1', timeout=20).read().decode())
PY`
- Repo hygiene check:
  `git -C ~/openclaw-agents status --short --branch`
- Inbox file listing:
  `find /Users/a_conte/.openclaw/workspace/shared/inbox/main -maxdepth 1 -name '*.json' -print | sort`
- Session-log tool audit:
  `jq -r '.message.content[]? | select(.type=="toolCall") | .name' ~/.openclaw/agents/main/sessions/*.jsonl | sort | uniq -c | sort -rn | head`

### Behavior adjustment
- When a heartbeat is blocked by the same persistent config issue, prefer a compact “still blocked on X/Y” summary rather than repeating a full rediscovery narrative
- Convert repeated friction into durable notes in TOOLS.md / MEMORY.md sooner
