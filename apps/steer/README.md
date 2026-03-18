# Steer

`steer` is a macOS automation CLI for OpenClaw agents.

Current MVP:

- `steer apps`
- `steer focus --app`
- `steer see [--app]`
- `steer type`
- `steer hotkey`
- `steer open-url`
- `steer safari current-url`
- `steer safari reload|focus-location|go-back|go-forward`
- `steer ui dump|find|click`
- `steer window list|set`
- `steer textedit new|set-text`
- `steer notes create`

Examples:

```bash
python3 apps/steer/steer_cli.py apps --json
python3 apps/steer/steer_cli.py focus --app Safari
python3 apps/steer/steer_cli.py open-url --url https://news.ycombinator.com --app Safari
python3 apps/steer/steer_cli.py safari current-url --json
python3 apps/steer/steer_cli.py safari reload --json
python3 apps/steer/steer_cli.py ui dump --app Safari --json
python3 apps/steer/steer_cli.py ui find --app Safari --name Retry --role button --json
python3 apps/steer/steer_cli.py ui click --app Safari --name Retry --role button --json
python3 apps/steer/steer_cli.py window list --app Safari --json
python3 apps/steer/steer_cli.py see --app Safari --json
python3 apps/steer/steer_cli.py textedit new --text "hello"
python3 apps/steer/steer_cli.py notes create --title "OpenClaw" --body "Mission Control note"
```
