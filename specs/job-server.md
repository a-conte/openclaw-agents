# Job Server Design

## Overview

The job server enables external clients (iPad, CLI, automations) to submit prompts to specific agents and track execution status. Rather than a separate process, it integrates into the existing Next.js dashboard — which already runs on the server, has gateway access, and serves the iOS app.

## Contract

```typescript
interface JobContract {
  id: string;
  prompt: string;
  targetAgent: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  priority: 'normal' | 'high' | 'urgent';
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  result?: string;
  error?: string;
}
```

## API

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/jobs` | Create a job (returns job with status `queued`) |
| GET | `/api/jobs` | List all jobs |
| GET | `/api/jobs/:jobId` | Get single job status |

## Dispatch

The POST handler:
1. Validates `prompt` (non-empty string) and `targetAgent` (known agent ID)
2. Creates a `JobContract` with status `queued`
3. Emits a `job.updated` SSE event
4. Asynchronously dispatches to the target agent via `openclaw gateway call`
5. Updates status to `running`, then `completed` or `failed`
6. Emits `job.updated` on each transition

## Storage

In-memory Map, same pattern as `mission-control-events.ts`. Jobs are ephemeral — they exist for the lifetime of the dashboard process. Persistence can be added later via the data/ JSON file pattern if needed.

## SSE Integration

A new `job.updated` event type is emitted through the existing mission-control event system. The event payload is the full `JobContract`. iOS clients receive these via the same `/api/mission-control/events` SSE stream.

## Known agents

`main`, `mail`, `docs`, `research`, `ai-research`, `dev`, `security`

## Non-goals

- Job persistence across restarts (can add later)
- Job cancellation (can add later)
- Authentication (home LAN)
- Rate limiting
