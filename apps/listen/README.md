# Listen

`listen` is a lightweight HTTP job server for remote agent execution.

Current endpoints:

- `POST /job`
- `GET /job/<id>`
- `GET /jobs`
- `DELETE /job/<id>`

Run locally:

```bash
python3 apps/listen/listen_server.py --host 127.0.0.1 --port 7600
```

Default worker behavior is local and safe:

- `mode=agent` runs `openclaw agent --agent <targetAgent> -m <prompt> --json`
- `mode=shell` creates a tmux session via `drive` and runs the prompt as a shell command
- `mode=steer` runs `steer <command> <args...> --json`
- `mode=drive` runs `drive <command> <args...>`
- `mode=note` records the prompt and marks the job completed

Examples:

```bash
curl -X POST http://127.0.0.1:7600/job \
  -H 'content-type: application/json' \
  -d '{"prompt":"Reply with exactly OK","mode":"agent","targetAgent":"main"}'
curl -X POST http://127.0.0.1:7600/job \
  -H 'content-type: application/json' \
  -d '{"mode":"steer","command":"apps"}'
curl -X POST http://127.0.0.1:7600/job \
  -H 'content-type: application/json' \
  -d '{"mode":"drive","command":"proc","args":["list","--json"]}'
curl http://127.0.0.1:7600/jobs
```
