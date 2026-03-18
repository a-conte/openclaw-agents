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

Bring-up guide for a fresh Mac:
- [`docs/bootstrap-mac.md`](/Users/a_conte/dev/openclaw-agents/docs/bootstrap-mac.md)

## Current Commands

### Drive

```bash
python3 apps/drive/drive_cli.py session create --name workspace
python3 apps/drive/drive_cli.py run --session workspace "ls -la ~/Desktop"
python3 apps/drive/drive_cli.py send --session workspace "echo hello" --json
python3 apps/drive/drive_cli.py logs --session workspace --lines 120
python3 apps/drive/drive_cli.py poll --session workspace --until "__DONE_" --json
python3 apps/drive/drive_cli.py fanout --targets workspace,worker-2 "pwd" --json
python3 apps/drive/drive_cli.py proc list --session workspace --json
python3 apps/drive/drive_cli.py proc tree --session workspace --json
python3 apps/drive/drive_cli.py proc top --session workspace --json
python3 apps/drive/drive_cli.py proc kill --name claude --tree --json
```

### Steer

```bash
python3 apps/steer/steer_cli.py apps --json
python3 apps/steer/steer_cli.py screens --json
python3 apps/steer/steer_cli.py focus --app Safari
python3 apps/steer/steer_cli.py see --app Safari --window --json
python3 apps/steer/steer_cli.py find "Reload this page" --json
python3 apps/steer/steer_cli.py open-url --app Safari --url https://news.ycombinator.com
python3 apps/steer/steer_cli.py click --x 640 --y 480 --screen 1 --json
python3 apps/steer/steer_cli.py click --on B1 --json
python3 apps/steer/steer_cli.py drag --from-x 640 --from-y 480 --to-x 900 --to-y 480 --screen 1 --json
python3 apps/steer/steer_cli.py scroll down 5 --json
python3 apps/steer/steer_cli.py clipboard write --text "hello" --json
python3 apps/steer/steer_cli.py clipboard read --json
python3 apps/steer/steer_cli.py ocr --app Safari --window --text Retry --json
python3 apps/steer/steer_cli.py ocr --app "Code" --store --json
python3 apps/steer/steer_cli.py ocr-click --app Safari --window --text Retry --json
python3 apps/steer/steer_cli.py wait text --image /tmp/steer-example.png --text "connect to the server" --contains --json
python3 apps/steer/steer_cli.py wait ui --app Safari --name "Reload this page" --role button --json
python3 apps/steer/steer_cli.py wait url --url localhost:3000 --contains --json
python3 apps/steer/steer_cli.py safari current-url --json
python3 apps/steer/steer_cli.py safari reload --json
python3 apps/steer/steer_cli.py ui dump --app Safari --json
python3 apps/steer/steer_cli.py ui find --app Safari --name Retry --role button --json
python3 apps/steer/steer_cli.py ui click --app Safari --name Retry --role button --json
python3 apps/steer/steer_cli.py window list --app Safari --json
python3 apps/steer/steer_cli.py window move --app Safari --x 100 --y 100 --json
python3 apps/steer/steer_cli.py window resize --app Safari --width 1200 --height 900 --json
python3 apps/steer/steer_cli.py textedit new --text "OpenClaw notes"
python3 apps/steer/steer_cli.py notes create --title "OpenClaw" --body "Mission Control test"
```

### Listen / Direct

```bash
python3 apps/listen/listen_server.py --host 127.0.0.1 --port 7600
python3 apps/direct/direct_cli.py start --prompt "Reply with exactly OK" --mode agent --agent main
python3 apps/direct/direct_cli.py start --mode steer --command apps
python3 apps/direct/direct_cli.py start --mode steer --command wait --arg ui --arg --app --arg Safari --arg --name --arg "Reload this page" --arg --role --arg button
python3 apps/direct/direct_cli.py start --mode drive --command proc --arg list --arg --json
python3 apps/direct/direct_cli.py start --mode workflow --workflow safari_open_command_page
python3 apps/direct/direct_cli.py start --mode workflow --workflow safari_recover_localhost_command
python3 apps/direct/direct_cli.py start --mode workflow --workflow safari_wait_and_click_ui --arg "Reload this page" --arg button
python3 apps/direct/direct_cli.py start --mode workflow --workflow textedit_new_set_text --arg "OpenClaw remote note"
python3 apps/direct/direct_cli.py templates
python3 apps/direct/direct_cli.py start --mode workflow --template open_command_page --input url=http://localhost:3000/command
python3 apps/direct/direct_cli.py start --mode workflow --template repo_test_build --input repoPath=/Users/a_conte/dev/openclaw-agents
python3 apps/direct/direct_cli.py list
python3 apps/direct/direct_cli.py latest 3
python3 apps/direct/direct_cli.py clear
```

## Notes

- `steer type`, `steer focus`, and Notes/TextEdit automation require macOS Accessibility permissions for the calling terminal.
- `steer ui dump|find|click` uses the macOS accessibility tree. It works best for apps and pages with stable accessible labels.
- `steer see` writes snapshot manifests to `/tmp/steer-snapshots`, and `find`, `click --on`, and `type --into` resolve against those saved elements.
- `steer ocr|ocr-click` uses Apple Vision on a screenshot, so the calling terminal also needs Screen Recording permission if the screenshot comes from `steer see`.
- `steer screens` plus `--screen` provide display-aware coordinate translation for capture and pointer actions.
- `steer wait text|ui|url` polls OCR, Accessibility, or Safari URL state until it matches or times out.
- `steer ocr --app ... --window` and `steer see --app ... --window` crop to the target app's front-window bounds via Accessibility metadata.
- `steer ocr --app ...` without `--window` still captures whatever macOS actually shows on the current screen/Space.
- `drive run` uses a sentinel marker to detect command completion inside tmux.
- `drive send`, `poll`, and `fanout` cover raw interactive input, regex waits, and parallel tmux execution.
- `drive proc list` maps processes back to tmux pane PIDs where possible, and `proc tree|top` provide cleanup and resource inspection.
- `listen` stores job state in `apps/listen/jobs/*.json`.
- `listen` also supports job archiving plus per-job `updates`, `summary`, per-step durations, and file-backed artifacts.
- custom workflow templates are stored locally in `apps/listen/templates.json` and can be managed over the `listen` HTTP API.
- archived artifact storage can be summarized and pruned via the new artifact admin endpoints.
- `listen` now exposes job/template metrics and a policy-admin summary for dashboard and iPad observability.
- `mode=agent` uses the real `openclaw agent` CLI.
- `mode=shell` uses `drive` for tmux-backed execution.
- `mode=steer` and `mode=drive` let remote jobs call the local automation/tooling CLIs directly with structured commands.
- `mode=workflow` supports both named flows and saved `workflowSpec` templates.
- `apps/listen/client.py` is the first agent-native client path for submitting, waiting on, and inspecting automation jobs directly from Python code.

## Gaps vs. `mac-mini-agent`

Still missing if you want near-parity:

- more app-specific workflows and recovery flows
- a true packaged install path matching the imported repo layout
