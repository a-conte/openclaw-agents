# Mac Automation MVP

This repo now includes local CLIs aimed at the `mac-mini-agent` tool shape:

- [`apps/steer`](/Users/a_conte/dev/openclaw-agents/apps/steer/README.md) for app automation
- [`apps/drive`](/Users/a_conte/dev/openclaw-agents/apps/drive/README.md) for tmux and process control
- [`apps/listen`](/Users/a_conte/dev/openclaw-agents/apps/listen/README.md) for remote job dispatch
- [`apps/direct`](/Users/a_conte/dev/openclaw-agents/apps/direct/README.md) for job submission

They are intentionally local-first and use built-in macOS primitives:

- `osascript`
- `open`
- `screencapture`
- `tmux`
- `ps`
- `pkill`

## Current Commands

### Drive

```bash
python3 apps/drive/drive_cli.py session create --name workspace
python3 apps/drive/drive_cli.py run --session workspace "ls -la ~/Desktop"
python3 apps/drive/drive_cli.py logs --session workspace --lines 120
python3 apps/drive/drive_cli.py proc list --session workspace --json
python3 apps/drive/drive_cli.py proc kill --name claude --tree --json
```

### Steer

```bash
python3 apps/steer/steer_cli.py apps --json
python3 apps/steer/steer_cli.py focus --app Safari
python3 apps/steer/steer_cli.py open-url --app Safari --url https://news.ycombinator.com
python3 apps/steer/steer_cli.py safari current-url --json
python3 apps/steer/steer_cli.py safari reload --json
python3 apps/steer/steer_cli.py ui dump --app Safari --json
python3 apps/steer/steer_cli.py ui find --app Safari --name Retry --role button --json
python3 apps/steer/steer_cli.py ui click --app Safari --name Retry --role button --json
python3 apps/steer/steer_cli.py window list --app Safari --json
python3 apps/steer/steer_cli.py see --app Safari --json
python3 apps/steer/steer_cli.py textedit new --text "OpenClaw notes"
python3 apps/steer/steer_cli.py notes create --title "OpenClaw" --body "Mission Control test"
```

### Listen / Direct

```bash
python3 apps/listen/listen_server.py --host 127.0.0.1 --port 7600
python3 apps/direct/direct_cli.py start --prompt "Reply with exactly OK" --mode agent --agent main
python3 apps/direct/direct_cli.py list
```

## Notes

- `steer type`, `steer focus`, and Notes/TextEdit automation require macOS Accessibility permissions for the calling terminal.
- `steer ui dump|find|click` uses the macOS accessibility tree. It works best for apps and pages with stable accessible labels.
- `steer see` uses full-screen screenshot capture today. It does not yet crop to a window or perform OCR.
- `drive run` uses a sentinel marker to detect command completion inside tmux.
- `drive proc list` maps processes back to tmux pane PIDs where possible.
- `listen` stores job state in `apps/listen/jobs/*.json`.
- `mode=agent` uses the real `openclaw agent` CLI.
- `mode=shell` uses `drive` for tmux-backed execution.

## Gaps vs. `mac-mini-agent`

Still missing if you want near-parity:

- OCR-backed UI element discovery
- coordinate clicking and dragging
- richer window management
- deeper app-specific flows and self-healing GUI waits
