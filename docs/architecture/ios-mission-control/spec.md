# OpenClaw Mission Control Architecture Spec

## Goal

Create the fastest and most responsive OpenClaw dashboard experience across desktop and iPad by splitting responsibilities across the right clients while keeping one stable backend contract.

## Product Surfaces

### MacBook desktop dashboard

The desktop dashboard remains the full-featured operational and administrative surface. It should be optimized for dense information, large-screen layouts, keyboard and pointer workflows, and deep inspection.

Primary responsibilities:

- complete system visibility
- configuration and administration
- deep debugging and logs
- bulk actions and dense operational views

### iPad Mission Control

The iPad app is a native SwiftUI client focused on live operational awareness, triage, and command execution. It is not a 1:1 port of the web UI. It should be designed around touch-first panels, summaries, detail drill-down, and fast perceived performance.

Primary responsibilities:

- live agent status
- task and pipeline monitoring
- alerts and incident triage
- calendar and system health visibility
- high-value operator actions

### iPhone companion

The iPhone app is a smaller native surface for alerts, approvals, acknowledgements, and quick status checks.

Primary responsibilities:

- push-driven alerts
- approval or reject flows
- quick status checks
- lightweight action execution

## Architecture Principles

1. One backend contract, multiple clients.
2. Share contracts and domain models, not presentation code.
3. Keep desktop optimized for power use and iPad optimized for native responsiveness.
4. Design for cached reads and incremental realtime updates.
5. Keep repo changes incremental and tied to product value.

## Recommended Repo Structure

Target structure:

- `apps/dashboard`
- `apps/ios`
- `packages/contracts`
- `packages/client-sdk`
- `docs/architecture/ios-mission-control`

Implementation notes:

- Move the existing `dashboard/` app to `apps/dashboard` early in the process.
- Add `apps/ios` once the contracts and architecture direction are approved.
- Create `packages/contracts` as the canonical home for API models, event payloads, and response shapes.
- Create `packages/client-sdk` only after at least two consumers benefit from a shared typed client.
- Leave the agent workspace folders in their current top-level locations for now.

## Shared Contract Layer

The shared contract layer should define the stable shapes consumed by both desktop and native clients. It should include:

- agent summaries and detailed agent state
- task, queue, and pipeline models
- alert and incident payloads
- calendar and schedule items
- system health and service status payloads
- action request and action result schemas
- realtime event envelopes

The contract layer should be treated as the source of truth for all client-facing shapes. Desktop and iOS clients should adapt presentation independently.

### Contract authorship and consumption

To avoid contract drift, the backend contract needs a single authorship model. The recommended approach is:

- define canonical API and event schemas in a checked-in machine-readable format
- keep `packages/contracts` as the repo home for those schemas plus generated client artifacts
- generate TypeScript artifacts for the desktop dashboard and Swift artifacts for the iOS app from the same source when practical
- treat contract changes as explicit reviewable changes rather than ad hoc response-shape edits in app code

The exact source format can be finalized in the contracts phase, but it must support:

- clear versioning
- schema review in git
- generation or validation for both TypeScript and Swift clients
- compatibility checks when backend payloads change

## Mobile Auth And Command Safety

Mobile clients should not inherit the full desktop action surface by default.

First-cut capability boundaries:

- desktop: full administration, configuration, bulk actions, deep inspection, and sensitive operations
- iPad: observe, acknowledge, triage, approve or reject, and invoke a limited set of operator-safe actions
- iPhone: alerts, acknowledgements, approvals, quick status, and tightly scoped safe actions only

Actions that can materially change system state should require stronger safeguards on mobile, such as:

- explicit operator identity
- server-side authorization by action type
- confirmation for sensitive actions
- audit logging with actor, device class, and timestamp

Desktop remains the default surface for broad mutations, configuration edits, and high-risk recovery flows until the mobile safety model proves mature.

## Realtime And Caching Strategy

Responsiveness depends more on data flow than on repo structure. The preferred model is:

- fast initial load from local cache or retained client state
- background refresh for canonical server state
- incremental realtime updates through a stable event stream
- optimistic local state only where operator actions are reversible or safely acknowledged

Design goals:

- the dashboard should render something useful immediately
- iPad should feel live without requiring full-screen reloads
- desktop should avoid unnecessary broad re-fetches
- event payloads should be small, stable, and easy to apply incrementally

### Realtime model

Both clients should follow the same reconciliation pattern:

1. fetch an initial snapshot
2. subscribe to the realtime stream
3. apply incremental updates to cached state
4. detect gaps or reconnects and re-fetch the affected snapshot when needed

Preferred transport direction:

- use one primary realtime transport for both desktop and iOS
- favor a persistent bidirectional channel for command-and-status workflows
- keep polling only as a fallback for degraded conditions or non-critical views

Event envelope requirements:

- stable event type
- entity identifier
- monotonic ordering token or sequence
- server timestamp
- idempotent event identifier
- enough payload to update cached state without broad refetches when possible

Reconnect behavior should be explicit:

- clients keep last seen ordering token
- if the stream resumes cleanly, continue applying deltas
- if a gap is detected, invalidate the affected cached slice and refresh from the server
- stale cached data should remain visible but clearly refreshable until a new snapshot is obtained

## Desktop Dashboard Direction

The desktop dashboard remains the primary control plane. Performance work here should focus on:

- reducing unnecessary rerenders
- making dense views cheap to update
- improving data-fetching granularity
- isolating failures with local error boundaries
- preserving large-screen information density

The desktop app should not be simplified into a mobile-first web layout. It exists to be the deepest operational surface.

## iPad Mission Control Direction

The iPad app should be native SwiftUI and should prioritize:

- high readability at distance
- quick recognition of system state
- touch-optimized navigation
- low-latency transitions
- persistent context across panels and detail views

The iPad app should not attempt to replicate every desktop screen at launch. It should start with the highest-value operational surfaces and expand from there.

### First-cut action split

Initial mobile capabilities should be narrower than desktop:

- iPad: acknowledge alert, assign or reassign task, approve or reject queued action, invoke a small set of safe operational commands, inspect current health and status
- iPhone: acknowledge alert, approve or reject, mark seen, open item details, run only the safest quick actions
- desktop: all of the above plus full editing, configuration, bulk operations, and recovery tooling

## Branching Strategy

Use short-lived branches off `main`.

Examples:

- `docs/ios-mission-control-spec`
- `chore/monorepo-apps-layout`
- `feat/contracts-foundation`
- `feat/ipad-shell`
- `feat/desktop-performance-pass`
- `feat/iphone-companion-mvp`

Rules:

- keep `main` deployable
- avoid permanent `ios` or `mobile` branches
- avoid long-running migration branches
- merge focused slices instead of waiting for large platform drops

## Worktree Strategy

Worktrees are recommended for parallel, low-conflict streams but are not required for every task.

Suggested use:

- stable main checkout for review and coordination
- one worktree for architecture and planning
- one worktree for repo structure changes
- one worktree for active iPad implementation
- optional separate worktree for desktop performance work

Worktrees are especially useful when structural changes, dashboard work, and iOS work would otherwise interfere with one another.

## Rollout Order

1. Write and approve architecture and implementation plans.
2. Create the architecture context folder in-repo.
3. Move `dashboard/` to `apps/dashboard`.
4. Validate all tooling affected by the dashboard move, including scripts, docs, CI paths, imports, and local workflows.
5. Introduce `packages/contracts`.
6. Define stable desktop and iPad-facing contracts.
7. Create the native iPad app shell in `apps/ios`.
8. Add the iPhone companion once the iPad foundation is stable.

The early dashboard move should be treated as a focused migration with a checklist, not as a casual rename. The goal is to establish the long-term monorepo layout without stalling ongoing dashboard work.

## Near-Term Non-Goals

- a full top-to-bottom repo reorganization unrelated to dashboard and iOS work
- shared cross-platform UI components between web and iOS
- a webview-based iPad dashboard as the primary solution
- broad migration of agent workspace folders before product surfaces and contracts are stabilized

## Decisions Captured Here

- Native SwiftUI is the preferred path for the iPad Mission Control app.
- The MacBook dashboard remains the primary desktop power-user surface.
- Shared contracts matter more than shared UI.
- The repo should move toward an apps and packages layout incrementally.
- Worktrees should be used when they reduce contention between parallel streams.

## Next Documents To Add

- `repo-and-branching.md`
- `client-architecture.md`
- `api-contracts.md`
- `roadmap.md`
- `decisions/`
