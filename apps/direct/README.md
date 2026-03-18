# Direct

`direct` is a CLI client for the local `listen` job server.

Examples:

```bash
python3 apps/direct/direct_cli.py start --prompt "Reply with exactly OK" --mode agent --agent main
python3 apps/direct/direct_cli.py list
python3 apps/direct/direct_cli.py latest 3
python3 apps/direct/direct_cli.py get --job-id abc123
python3 apps/direct/direct_cli.py clear
python3 apps/direct/direct_cli.py stop --job-id abc123
```
