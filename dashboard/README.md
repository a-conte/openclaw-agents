# OpenClaw Mission Control Dashboard

Internal Next.js dashboard for monitoring and steering the `openclaw-agents` workspace.

## What it does

The dashboard provides a browser UI for:

- **Command** — mission overview, active agents, workflow runs, repo health, briefings, radar signals
- **Agents** — agent status and recent session activity
- **Projects** — project and task tracking
- **Pipeline** — workflow execution visibility
- **Memory / Content / Office / Calendar / Radar / System** — operational views used by the local agent setup

The app root redirects to `/command`.

## Tech stack

- Next.js 16
- React 19
- TypeScript
- Local JSON-backed data files in `data/`

## Local development

```bash
cd ~/openclaw-agents/dashboard
npm install
npm run dev
```

Then open:

```text
http://localhost:3000/command
```

## Data files

- `data/tasks.json` — task board state
- `data/workflow-runs.json` — persisted workflow run history

## Notes

- This dashboard is for the local OpenClaw deployment, not a generic reusable package.
- Operational troubleshooting lives in [`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md).
