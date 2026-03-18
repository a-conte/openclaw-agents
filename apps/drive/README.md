# Drive

`drive` is a tmux and process-control CLI for OpenClaw agents.

Current MVP:

- `drive session create|list|kill`
- `drive run`
- `drive logs`
- `drive proc list`
- `drive proc kill`

Examples:

```bash
python3 apps/drive/drive_cli.py session create --name workspace
python3 apps/drive/drive_cli.py run --session workspace "pwd"
python3 apps/drive/drive_cli.py logs --session workspace --lines 80
python3 apps/drive/drive_cli.py proc list --session workspace --json
python3 apps/drive/drive_cli.py proc kill --name claude --json
```
