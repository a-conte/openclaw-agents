# Working With Agents

You can start using the agents now.

The intended operating model is:

- the online dashboard is the primary Mission Control
- the iPad app is supplemental
- `listen` is the local automation/runtime layer
- your forked `openclaw` build provides the native `automation_jobs` tool

## Start The Stack

On the OpenClaw host machine:

```bash
cd /Users/a_conte/dev/openclaw-agents
./scripts/local-stack.sh start
```

Then open the dashboard locally:

```bash
open http://127.0.0.1:3000/command
```

## Trigger From Your Main Machine

Use the dashboard from your main machine over your LAN.

Open:

```text
http://<your-mac-lan-ip>:3000/command
```

Recommended model:

- trigger jobs, templates, and reviews from the dashboard on your main machine
- keep `listen` bound to `127.0.0.1` on the host machine
- do not expose raw `listen` directly to other devices

If you want a quick host-health snapshot before connecting from your main machine:

```bash
cd /Users/a_conte/dev/openclaw-agents
./scripts/status-everything.sh
```

## Use OpenClaw Directly

On the host machine, your linked OpenClaw fork can already use the native automation tool:

```bash
openclaw agent --agent main
```

That agent can use `automation_jobs` for:

- template execution
- workflow execution
- job wait/retry
- artifact lookup
- template inspection

## Good First Workflows

These are good bounded starting points:

- `open_command_page`
- `recover_command_page`
- `repo_status_check`
- `repo_branch_hygiene`
- `repo_validation_handoff`
- `developer_workstation_bootstrap`
- `codex_repo_task`
- `claude_code_repo_task`
- `github_repo_triage`
- `dashboard_health_check`
- `browser_recovery_handoff`

If you want the agents to operate more like the `mac-mini-agent` drive/steer "skills" model, use
the developer workstation templates first:

- `developer_workstation_bootstrap` for tmux + Ghostty + VS Code
- `codex_ghostty_session` or `claude_code_ghostty_session` for visible terminal-supervised work
- `codex_repo_task` or `claude_code_repo_task` for bounded autonomous repo work
- `github_repo_triage` before repo changes
- `github_branch_commit_push_pr` only when you explicitly want branch/push/PR automation

## Trust Level

What is ready now:

- supervised use through the dashboard
- bounded automation via templates and workflows
- quick review and retry loops on iPad

What is not the intended mode:

- unconstrained unsupervised operation across arbitrary host actions
- bypassing `listen` policy
- exposing the raw runtime broadly on the network

## Recommended Daily Flow

1. Start the stack on the host machine.
2. Open the dashboard from your main machine.
3. Run a bounded template or workflow.
4. Review the job result and artifacts in the dashboard.
5. Use the iPad only for alerts, quick checks, and follow-up.

## Related Docs

- [`docs/local-startup.md`](/Users/a_conte/dev/openclaw-agents/docs/local-startup.md)
- [`docs/apple-ecosystem-communication-roadmap.md`](/Users/a_conte/dev/openclaw-agents/docs/apple-ecosystem-communication-roadmap.md)
- [`docs/remaining-work.md`](/Users/a_conte/dev/openclaw-agents/docs/remaining-work.md)
