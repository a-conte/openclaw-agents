# Listen

`listen` is a lightweight HTTP job server for remote agent execution.

Current endpoints:

- `POST /job`
- `GET /job/<id>`
- `GET /job/<id>/bundle`
- `GET /jobs`
- `GET /policy`
- `GET /policy/admin`
- `GET /notifications/preferences`
- `POST /notifications/preferences`
- `GET /notifications/events`
- `GET /notifications/devices`
- `POST /notifications/devices`
- `GET /templates`
- `GET /agent/templates`
- `GET /templates/<id>/versions`
- `GET /agent/templates/<id>/versions`
- `GET /agent/templates/<id>/diff`
- `POST /templates`
- `POST /agent/templates`
- `PUT /templates/<id>`
- `PUT /agent/templates/<id>`
- `DELETE /templates/<id>`
- `DELETE /agent/templates/<id>`
- `GET /artifacts/admin`
- `POST /artifacts/prune`
- `POST /artifacts/compress`
- `GET /metrics`
- `GET /shortcuts/summary`
- `GET /shortcuts/latest-failed`
- `GET /shortcuts/templates`
- `POST /shortcuts/run-template`
- `POST /shortcuts/retry-latest-failed`
- `POST /agent/execute`
- `POST /jobs/clear`
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

Job records now keep:

- `updates[]` for step-by-step progress
- `summary` for a compact final outcome
- file-backed step artifacts under `apps/listen/jobs/artifacts`
- archived jobs under `apps/listen/jobs/archived`
- export bundles under `apps/listen/jobs/exports`
- compressed archived artifact sets under `apps/listen/jobs/archived-artifacts-compressed`
- Apple alert events and delivery preferences under `apps/listen/notification-state.json`

Custom templates:

- built-in templates are always available from `GET /templates`
- custom templates are stored locally in `apps/listen/templates.json`
- use `POST /templates` and `PUT /templates/<id>` to save reusable workflow specs
- `GET /templates/<id>/versions` returns saved version history for custom templates
- templates may include `artifactRetentionDays` to override the default archived-artifact retention window
- archived artifact retention can be inspected with `GET /artifacts/admin` and pruned with `POST /artifacts/prune`
- older archived artifact directories can be compressed with `POST /artifacts/compress`
- `GET /metrics` returns job/template/policy observability summaries
- `GET /policy/admin` returns current env-backed policy settings plus suggested host env values
- `GET /notifications/preferences` returns Apple delivery preferences used by the dashboard and iPad app
- `GET /notifications/events` returns recent Apple alert events for supplemental iPad delivery and dashboard review
- the `/shortcuts/*` endpoints provide compact mobile-friendly payloads for Apple Shortcuts and similar automation clients
- notification preferences may include per-template routing for `push`, `notes`, `imessage`, and `mail_draft`

Agent-facing client:

- import `ListenClient` from [`apps/listen/client.py`](/Users/a_conte/dev/openclaw-agents/apps/listen/client.py)
- use `submit_template_job`, `submit_workflow_spec`, `execute_job`, `wait_for_job`, `run_template_job`, `template_diff`, `create_template`, `update_template`, `clone_template`, or `restore_template` for direct programmatic execution without going through `direct`

Built-in workflows:

- `safari_reload_wait_url <url-substring>`
- `safari_open_wait_url <url> [expected-substring]`
- `safari_open_command_page [url]`
- `safari_recover_localhost_command [url]`
- `safari_open_and_wait_ui <url> <label> [role]`
- `safari_wait_and_click_ui <label> [role]`
- `textedit_new_set_text <text>`
- `notes_create <title> <body>`
- `repo_repair_loop`
- `repo_release_readiness`
- `repo_change_review`
- `dashboard_audit`
- `dashboard_jobs_triage`
- `dashboard_policy_audit`
- `browser_auth_recovery`
- `browser_login_snapshot`
- `browser_recovery_handoff`
- `daemon_restart_verify_bundle`
- `daemon_logs_bundle`
- `daemon_recovery_handoff`
- `operator_handoff_note`
- `operator_handoff_bundle`
- `imessage_status_ping`
- `mail_draft_incident_summary`

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
curl -X POST http://127.0.0.1:7600/templates \
  -H 'content-type: application/json' \
  -d '{"id":"ops_review","name":"Ops Review","description":"Custom review flow","workflowSpec":{"steps":[{"id":"note_1","type":"note","message":"hello"}]}}'
curl http://127.0.0.1:7600/artifacts/admin
curl http://127.0.0.1:7600/policy/admin
curl http://127.0.0.1:7600/metrics
curl http://127.0.0.1:7600/shortcuts/summary
curl http://127.0.0.1:7600/shortcuts/latest-failed
curl http://127.0.0.1:7600/shortcuts/templates
curl -X POST http://127.0.0.1:7600/shortcuts/run-template \
  -H 'content-type: application/json' \
  -d '{"templateId":"open_command_page","wait":true}'
curl -X POST http://127.0.0.1:7600/shortcuts/retry-latest-failed \
  -H 'content-type: application/json' \
  -d '{"mode":"resume_failed"}'
curl http://127.0.0.1:7600/job/<job-id>/bundle
curl http://127.0.0.1:7600/job/<job-id>/bundle?kind=incident
curl -X POST http://127.0.0.1:7600/artifacts/compress \
  -H 'content-type: application/json' \
  -d '{"olderThanDays":7}'
curl http://127.0.0.1:7600/jobs
curl http://127.0.0.1:7600/jobs?archived=true
curl -X POST http://127.0.0.1:7600/jobs/clear
```
