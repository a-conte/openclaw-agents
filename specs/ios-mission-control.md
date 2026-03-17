# iOS Mission Control Spec

## Overview

Native SwiftUI iPad app for operational awareness and command execution against the OpenClaw agent fleet. Connects to the dashboard backend via REST + SSE.

## Architecture

- **Transport:** HTTP REST for reads/writes, SSE for realtime updates
- **Base URL:** Configured via `Local.xcconfig` → Info.plist `MissionControlBaseURL`
- **State management:** `DashboardViewModel` as `@MainActor ObservableObject`
- **Realtime:** Snapshot + incremental event stream with sequence-based gap detection

## Screens

### Sidebar Navigation
- Agent Status (default) — live agent cards with status badges
- Tasks — task list from `/api/tasks`
- Workflows — workflow runs from `/api/workflows`
- Jobs — submit and monitor jobs via `/api/jobs`
- System Health — health endpoint

### Agent Status (implemented)
- Counts grid: In Progress, Stale Tasks, Failed Runs, Quiet Agents, Dirty Repos, Radar
- Agent cards with status badge, last activity timestamp
- Realtime updates via `agent.updated` events

### Tasks (new)
- List view of tasks from `/api/tasks`
- Status and priority badges
- Agent assignment display

### Workflows (new)
- List of workflow runs from `/api/workflows`
- Step-by-step status display
- Triggered-by indicator

### Job Submit (new)
- Agent picker (dropdown of known agents)
- Prompt text field
- Submit button → POST `/api/jobs`
- Job status cards with realtime updates via `job.updated` SSE events

## Contracts

Swift models mirror `packages/contracts/schemas/`:
- `AgentSummary` ↔ `agent-summary.schema.json`
- `DashboardSnapshot` ↔ `mission-control-snapshot.schema.json`
- `MissionControlCounts` ↔ `mission-control-counts.schema.json`
- `Job` ↔ `job.schema.json` (new)

## Client Protocol

```swift
protocol MissionControlClient {
    func loadInitialSnapshot() async throws -> DashboardSnapshot
    func eventStream(since: Int?) -> AsyncThrowingStream<MissionControlEventEnvelope, Error>
    func submitJob(prompt: String, agent: String) async throws -> Job
    func listJobs() async throws -> [Job]
}
```

Three implementations: `HTTPMissionControlClient`, `PreviewMissionControlClient`, `UnconfiguredMissionControlClient`

## Event Types

| Event | Entity ID | Payload |
|-------|-----------|---------|
| `agent.updated` | agentId | AgentSummary fields |
| `snapshot.invalidated` | `mission-control` | reason string |
| `job.updated` | jobId | Full JobContract |

## Build

```bash
just ios-generate   # xcodegen → .xcodeproj
just ios-build      # xcodebuild for simulator
just ios-test       # run unit tests
```
