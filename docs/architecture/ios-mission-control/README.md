# OpenClaw iOS Mission Control

This folder is the long-lived context home for OpenClaw's desktop and iOS dashboard architecture.

## Current Direction

- Keep the MacBook dashboard as the full desktop power-user surface.
- Build a native SwiftUI iPad app as the primary Mission Control experience.
- Add an iPhone companion later for alerts, approvals, and quick actions.
- Stabilize API contracts before significant native client implementation.
- Use efficient caching and realtime updates to keep both desktop and iPad responsive.

## Planned Repo Structure

The repo is moving toward this shape:

- `apps/dashboard`
- `apps/ios`
- `packages/contracts`
- `packages/client-sdk` (only if needed by multiple consumers)
- `docs/architecture/ios-mission-control`

Notes:

- Move `dashboard/` to `apps/dashboard` early.
- Do not restructure the agent workspace folders yet unless they start getting in the way.
- Treat `packages/contracts` as the canonical definition of API models and realtime payloads.

## Documents

- `spec.md`: Approved architecture and rollout direction for Mission Control.

## Working Rules

- Prefer short-lived branches off `main`.
- Use worktrees for parallel streams such as spec work, repo restructuring, and native app development.
- Keep `main` deployable and avoid long-running platform branches.
