# Steer

`steer` is a macOS automation CLI for OpenClaw agents.

Current MVP:

- `steer apps`
- `steer screens`
- `steer focus --app`
- `steer see [--app] [--window|--region]`
- `steer find <query>`
- `steer type`
- `steer hotkey`
- `steer open-url`
- `steer click`
- `steer drag`
- `steer scroll`
- `steer clipboard read|write`
- `steer ocr|ocr-click`
- `steer wait text|ui|url`
- `steer safari current-url`
- `steer safari reload|focus-location|go-back|go-forward`
- `steer ui dump|find|click`
- `steer window list|set|move|resize|minimize|fullscreen|close`
- `steer textedit new|set-text`
- `steer notes create`

Examples:

```bash
python3 apps/steer/steer_cli.py apps --json
python3 apps/steer/steer_cli.py screens --json
python3 apps/steer/steer_cli.py focus --app Safari
python3 apps/steer/steer_cli.py see --app Safari --window --json
python3 apps/steer/steer_cli.py find "Reload this page" --json
python3 apps/steer/steer_cli.py open-url --url https://news.ycombinator.com --app Safari
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
python3 apps/steer/steer_cli.py textedit new --text "hello"
python3 apps/steer/steer_cli.py notes create --title "OpenClaw" --body "Mission Control note"
```

Notes:

- `see` now stores a snapshot manifest under `/tmp/steer-snapshots`, and `find`, `click --on`, and `type --into` can resolve against the latest snapshot or a specific `--snapshot`.
- `ocr --store` stores OCR-derived text boxes as snapshot elements, which helps with Electron apps that do not expose useful accessibility trees.
- `--window` captures the front window bounds for the target app. `--region` accepts `x,y,width,height`.
- `--screen` lets you target a specific display for capture and coordinate translation.
