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
- `mode=workflow` runs a named local automation flow
- `mode=note` records the prompt and marks the job completed

Built-in workflows:

- `safari_reload_wait_url <url-substring>`
- `safari_open_wait_url <url> [expected-substring]`
- `safari_open_command_page [url]`
- `safari_recover_localhost_command [url]`
- `safari_open_and_wait_ui <url> <label> [role]`
- `safari_wait_and_click_ui <label> [role]`
- `textedit_new_set_text <text>`
- `notes_create <title> <body>`

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
curl -X POST http://127.0.0.1:7600/job \
  -H 'content-type: application/json' \
  -d '{"mode":"workflow","workflow":"safari_wait_and_click_ui","args":["Reload this page","button"]}'
curl -X POST http://127.0.0.1:7600/job \
  -H 'content-type: application/json' \
  -d '{"mode":"workflow","workflow":"safari_open_command_page"}'
curl http://127.0.0.1:7600/jobs
```
