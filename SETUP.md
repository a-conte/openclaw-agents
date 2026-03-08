# Setup Reference

Full breakdown of the OpenClaw installation: skills, plugins, infrastructure, and configuration.

## Infrastructure

| Component | Details |
|-----------|---------|
| **Host** | Intel MacBook (x86_64), macOS 26.3, repurposed as always-on home server |
| **Node** | v25.8.0 (gateway uses node@22 via LaunchAgent) |
| **Gateway** | LaunchAgent (`ai.openclaw.gateway`), port 18789, local loopback |
| **Model** | `openai-codex/gpt-5.3-codex` (200k context) |
| **Memory** | LanceDB plugin with OpenAI embeddings |
| **Channel** | Telegram (7 bot accounts — one per agent) |

### Key Paths

```
~/openclaw-agents/              # THIS REPO (monorepo)
├── main/                       # → ~/.openclaw/workspace (symlink)
│   ├── skills/                 # Community skills
│   ├── memory/                 # Daily memory logs (gitignored)
│   └── *.md                    # Agent personality + config
├── mail/                       # → ~/.openclaw/workspace-mail (symlink)
├── docs/                       # → ~/.openclaw/workspace-docs (symlink)
├── research/                   # → ~/.openclaw/workspace-research (symlink)
├── ai-research/                # → ~/.openclaw/workspace-ai-research (symlink)
└── dev/                        # → ~/.openclaw/workspace-dev (symlink)

~/.openclaw/                    # Root config directory (NOT in repo)
├── openclaw.json               # Main config (contains secrets)
├── identity/                   # Device auth
├── credentials/                # Telegram pairing
├── agents/                     # Agent session data
├── memory/                     # LanceDB vector store
├── tools/                      # sherpa-onnx runtime + models
└── logs/                       # Gateway stdout/stderr
```

## Built-in Skills (44)

Installed via brew, npm, go, or bundled with OpenClaw.

### Core Tools
| Skill | Description | Install Method |
|-------|-------------|----------------|
| coding-agent | Code generation and editing | Built-in |
| gh-issues | GitHub issue management | Built-in |
| github | GitHub integration | Built-in |
| clawhub | Skill registry CLI | `npm install -g clawhub` |
| oracle | AI oracle | `npm install -g @steipete/oracle` |
| healthcheck | Gateway health monitoring | Built-in |
| mcporter | MCP tool porter | Built-in |
| skill-creator | Create new skills | Built-in |
| nano-pdf | PDF reading | Built-in |
| session-logs | Session log search (ripgrep) | `brew install ripgrep` |
| tmux | Terminal multiplexer | `brew install tmux` |
| video-frames | Video frame extraction | Built-in |

### Communication
| Skill | Description | Install Method |
|-------|-------------|----------------|
| himalaya | Email via IMAP/SMTP | Built-in |
| imsg | iMessage | `brew install imsg` |
| voice-call | Voice calls | Plugin |
| wacli | WhatsApp CLI | Built-in |
| xurl | Twitter/X URL handling | Built-in |

### Apple & macOS
| Skill | Description | Install Method |
|-------|-------------|----------------|
| apple-notes | Notes.app via `memo` CLI | `brew install memo` |
| apple-reminders | Reminders via `remindctl` | `brew install remindctl` |
| bear-notes | Bear.app notes | Built-in |
| obsidian | Obsidian vault | `brew install obsidian-cli` |
| things-mac | Things 3 task manager | Built-in |
| peekaboo | Screen/window capture | `brew install peekaboo` |
| 1password | 1Password CLI | `brew install 1password-cli` |

### Media & Audio
| Skill | Description | Install Method |
|-------|-------------|----------------|
| blucli | BluOS speakers | Built-in |
| sonoscli | Sonos speakers | Built-in |
| songsee | Song recognition | `brew install songsee` |
| spotify-player | Spotify playback | Built-in |
| gifgrep | GIF search | `brew install gifgrep` |

### AI & Speech
| Skill | Description | Install Method |
|-------|-------------|----------------|
| openai-image-gen | DALL-E image generation | Env: `OPENAI_API_KEY` |
| openai-whisper | Local whisper transcription | Built-in |
| openai-whisper-api | Cloud transcription ($0.006/min) | Env: `OPENAI_API_KEY` |
| sherpa-onnx-tts | Local TTS (offline) | Downloaded runtime + model |
| gemini | Google Gemini CLI | `brew install gemini-cli` |
| nano-banana-pro | Banana.dev inference | `brew install uv` + Env: `GEMINI_API_KEY` |
| summarize | Text summarization | Built-in |

### Smart Home & Utility
| Skill | Description | Install Method |
|-------|-------------|----------------|
| openhue | Philips Hue lights | `brew install openhue` |
| goplaces | Location search | `brew install goplaces` |
| weather | Weather info | Built-in |
| ordercli | Order tracking | `brew install ordercli` |
| gog | GOG.com game library | `brew install gog` |
| blogwatcher | Blog/RSS monitoring | `go install .../blogwatcher@latest` |
| eightctl | Eight Sleep pod control | `go install .../eightctl@latest` |

## Community Skills (19)

Installed via `npx clawhub@latest install <slug>` into `skills/`.

All audited for security — no credential exfiltration, no suspicious network calls, no obfuscated code.

### Speech & TTS
| Skill | Description | Notes |
|-------|-------------|-------|
| faster-whisper | Local speech-to-text | Free, no API cost |
| voice-edge-tts | Microsoft Edge TTS | Free, patched for shell safety |
| say | macOS `say` command TTS | Siri Natural Voices |
| kokoro-tts | Local Kokoro TTS engine | Requires local API server |

### Productivity
| Skill | Description | Notes |
|-------|-------------|-------|
| briefing | Morning briefing (calendar + weather + todos) | Pure prompt skill |
| todo-boss | Telegram task management | Writes to local JSONL |
| casual-cron | Natural language cron jobs | Needs `CRON_DEFAULT_CHANNEL` env |

### Smart Home
| Skill | Description | Notes |
|-------|-------------|-------|
| control-ikea-lightbulb | IKEA/TP-Link Kasa bulbs | LAN only, python-kasa |
| wiz-light-control | Wiz smart bulbs | LAN only, pywizlight |
| wol-sleep-pc | Wake-on-LAN / Sleep-on-LAN | UDP broadcast |

### Knowledge & Research
| Skill | Description | Notes |
|-------|-------------|-------|
| wikipedia-oc | Wikipedia lookups | Public API |
| my-weather | Weather via wttr.in | No API key needed |

### Self-Hosted Services
| Skill | Description | Notes |
|-------|-------------|-------|
| overseerr | Movie/TV requests (Plex/Jellyfin) | Needs `OVERSEERR_URL` + API key |
| paperless | Paperless-NGX via ppls CLI | Needs `PPLS_HOSTNAME` + token |
| paperless-ngx | Paperless-NGX via curl | Needs `PAPERLESS_URL` + token |
| freshrss-reader | FreshRSS article reader | Needs FreshRSS instance |
| gotify | Push notifications | Needs Gotify server |

### Other
| Skill | Description | Notes |
|-------|-------------|-------|
| humanize | Make AI text sound human | Pure prompt skill |
| memoclaw | Memory sync utilities | Sync scripts |

## Plugins

| Plugin | Status | Purpose |
|--------|--------|---------|
| **telegram** | Enabled | Telegram bot channel (7 accounts) |
| **voice-call** | Enabled | Voice calling capability |
| **memory-lancedb** | Enabled | Vector memory with OpenAI embeddings |
| memory-core | Disabled | Default memory (replaced by lancedb) |

## Environment Variables

Set in both `~/.zshenv` (shell) and the LaunchAgent plist (gateway process):

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | OpenAI API (whisper, image gen, embeddings) |
| `GEMINI_API_KEY` | Google Gemini CLI |
| `SHERPA_ONNX_RUNTIME_DIR` | sherpa-onnx TTS runtime path |
| `SHERPA_ONNX_MODEL_DIR` | sherpa-onnx TTS model path |

## Blocked Skills (9)

| Skill | Reason |
|-------|--------|
| camsnap | Requires ARM64 (Apple Silicon) |
| codexbar (model-usage) | Requires ARM64 (Apple Silicon) |
| sag | Needs ElevenLabs API key (`ELEVENLABS_API_KEY`) |
| notion | Needs Notion API key (`NOTION_API_KEY`) |
| trello | Needs Trello API key + token |
| bluebubbles | Needs BlueBubbles server config |
| discord | Needs Discord bot token |
| slack | Needs Slack config |
| casual-cron | Needs `CRON_DEFAULT_CHANNEL` env var (easy fix) |
