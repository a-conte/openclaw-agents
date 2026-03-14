# TOOLS.md - Skill Inventory

## Email & Calendar
- **himalaya** - IMAP/SMTP email (antconte92@gmail.com). Never send without approval.
- **gog** - Google Workspace CLI (Gmail, Calendar, Drive, Contacts, Sheets, Docs)
- **Known config check:**
  - `himalaya --output json envelope list 'flag unseen'`
  - If missing config, error points to: `~/Library/Application Support/himalaya/config.toml`
  - `gog auth status --json --results-only --no-input`
  - If missing config, expected file is: `~/Library/Application Support/gogcli/config.json`

## Notes & Documents
- **apple-notes** - Apple Notes via `memo` CLI
- **bear-notes** - Bear notes via `grizzly` CLI
- **obsidian** - Obsidian vault management
- **nano-pdf** - PDF editing with natural language

## Task Management
- **things-mac** - Things 3 (macOS)
- **apple-reminders** - Apple Reminders via `remindctl`

## Audio & Voice
- **blucli** - BluOS speakers
- **sonoscli** - Sonos speakers
- **spotify-player** - Spotify via `spogo`
- **sherpa-onnx-tts** - Local TTS (offline)
- **kokoro-tts** - Local TTS (Kokoro engine)
- **say** - macOS Siri TTS
- **openai-whisper** - Local speech-to-text
- **openai-whisper-api** - Cloud speech-to-text
- **faster-whisper** - Fast local speech-to-text with GPU
- **voice-call** - Voice calls via OpenClaw plugin
- **songsee** - Audio spectrograms and visualizations

## Development & GitHub
- **github** - GitHub ops via `gh` CLI (issues, PRs, CI)
- **gh-issues** - Fetch issues, spawn agents for fixes, open PRs
- **coding-agent** - Delegate coding tasks to Codex/Claude Code/Pi
- **Useful repo check:** `git -C ~/openclaw-agents status --short --branch`

## Research & Web
- **weather** - Weather via wttr.in / Open-Meteo
- **goplaces** - Google Places API
- **blogwatcher** - RSS/Atom feed monitoring
- **freshrss** - FreshRSS feed reader
- **summarize** - Summarize URLs, podcasts, transcripts
- **wikipedia-oc** - Wikipedia search and summarization
- **gemini** - Gemini CLI for Q&A and generation
- **Reliable local weather fallback:**
  - `python3 - <<'PY'
import urllib.request
print(urllib.request.urlopen('https://wttr.in/?format=j1', timeout=20).read().decode())
PY`

## Smart Home & IoT
- **openhue** - Philips Hue lights
- **control-ikea-lightbulb** - IKEA/TP-Link Kasa bulbs
- **wiz-light-control** - Wiz smart bulbs
- **eightctl** - Eight Sleep pod control
- **wol-sleep-pc** - Wake-on-LAN / Sleep-on-LAN

## Media & Images
- **nano-banana-pro** - Image generation via Gemini 3 Pro
- **openai-image-gen** - Image generation via OpenAI
- **gifgrep** - GIF search and download
- **video-frames** - Extract frames/clips from video
- **overseerr** - Movie/TV requests via Overseerr

## Messaging
- **imsg** - iMessage/SMS
- **wacli** - WhatsApp
- **xurl** - X (Twitter) API

## System & Infrastructure
- **1password** - 1Password CLI secrets management
- **clawhub** - Skill marketplace (search, install, publish)
- **skill-creator** - Create/update agent skills
- **mcporter** - MCP server management
- **peekaboo** - macOS UI capture and automation
- **tmux** - Remote-control tmux sessions
- **session-logs** - Search own session logs
- **healthcheck** - Host security hardening
- **gotify** - Push notifications
- **oracle** - Prompt bundling CLI
- **Recent session-log patterns:**
  - List recent session files:
    `for f in ~/.openclaw/agents/main/sessions/*.jsonl; do date=$(head -1 "$f" | jq -r '.timestamp' | cut -dT -f1); size=$(ls -lh "$f" | awk '{print $5}'); echo "$date $size $(basename "$f")"; done | sort -r | head -20`
  - Tool usage breakdown:
    `jq -r '.message.content[]? | select(.type=="toolCall") | .name' ~/.openclaw/agents/main/sessions/*.jsonl | sort | uniq -c | sort -rn | head -30`

## Memory
- **memoclaw** - Semantic vector memory service
- **memory-lancedb** - Local vector memory (plugin)

## Document Management
- **paperless** - Paperless-NGX via `ppls` CLI
- **paperless-ngx** - Paperless-NGX via REST API

## Content
- **humanize** - Remove AI writing patterns from text
- **briefing** - Daily briefing (calendar + todos + weather)
- **ordercli** - Food delivery order tracking
