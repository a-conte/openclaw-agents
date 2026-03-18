# Drive

`drive` is a tmux and process-control CLI for OpenClaw agents.

Current MVP:

- `drive session create|list|kill`
- `drive run`
- `drive send`
- `drive logs`
- `drive poll`
- `drive fanout`
- `drive proc list|kill|tree|top`

Examples:

```bash
python3 apps/drive/drive_cli.py session create --name workspace
python3 apps/drive/drive_cli.py run --session workspace "pwd"
python3 apps/drive/drive_cli.py send --session workspace "echo hello from send" --json
python3 apps/drive/drive_cli.py logs --session workspace --lines 80
python3 apps/drive/drive_cli.py poll --session workspace --until "__DONE_" --json
python3 apps/drive/drive_cli.py fanout --targets workspace,worker-2 "pwd" --json
python3 apps/drive/drive_cli.py proc list --session workspace --json
python3 apps/drive/drive_cli.py proc tree --session workspace --json
python3 apps/drive/drive_cli.py proc top --session workspace --json
python3 apps/drive/drive_cli.py proc kill --name claude --json
```
