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

- creates a tmux session via `drive`
- runs the prompt text as a shell command if `mode=shell`
- otherwise records the prompt and marks the job completed

Examples:

```bash
curl -X POST http://127.0.0.1:7600/job \
  -H 'content-type: application/json' \
  -d '{"prompt":"pwd","mode":"shell"}'
curl http://127.0.0.1:7600/jobs
```
