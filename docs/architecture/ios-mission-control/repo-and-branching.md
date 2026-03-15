# OpenClaw Repo And Branching Workflow

## Purpose

This document describes how Mission Control work should move through the repo now that the dashboard lives in `apps/dashboard` and the repo is adopting an apps-and-packages structure.

The goal is to keep `main` deployable while allowing desktop, contracts, and native iPad work to proceed in focused slices.

## Current And Target Structure

Current relevant repo areas:

- `apps/dashboard` for the desktop Mission Control web app
- top-level agent workspaces such as `main`, `mail`, `docs`, `research`, `ai-research`, `dev`, and `security`

Target additions:

- `apps/ios` for the future native SwiftUI app
- `packages/contracts` for canonical client-facing schemas and shared types

This remains intentionally incremental. The repo is not being fully reorganized all at once.

## Branching Model

Use short-lived branches from `main`.

Preferred examples:

- `chore/monorepo-apps-layout`
- `feat/contracts-foundation`
- `feat/ipad-shell`
- `feat/desktop-performance-pass`
- `feat/iphone-companion-mvp`

Rules:

- keep `main` releasable
- avoid long-running migration branches
- avoid permanent platform branches like `ios` or `mobile`
- merge focused slices instead of batching unrelated work together

## Worktree Guidance

Worktrees are recommended when multiple streams would otherwise interfere with each other.

Good worktree use cases:

- one worktree for repo structure changes
- one worktree for contracts/package work
- one worktree for iPad app implementation
- one stable checkout for review or urgent fixes

Worktrees are not required for every small task, but they are the default recommendation for Mission Control work because repo layout, contracts, and native app work often overlap.

## Current Verification Flow

Dashboard-affecting changes now have repo-level verification paths:

- `./scripts/check-dashboard-paths.sh`
- `npm run dashboard:typecheck`
- `npm run dashboard:test`
- `npm run dashboard:build`

The local `pre-push` hook runs:

1. `./scripts/check-dashboard-paths.sh`
2. dashboard typecheck when dashboard-affecting files changed

CI runs:

1. dashboard path guardrail
2. root workspace install
3. root workspace dashboard typecheck
4. root workspace dashboard test
5. root workspace dashboard build

## Recommended Execution Order

For Mission Control foundation work, use this sequence:

1. architecture and implementation docs
2. repo structure and dashboard move
3. tooling validation and workspace setup
4. contracts package
5. desktop dashboard shared-contract adoption
6. native iPad shell

That ordering matches the architecture spec: planning context first, then the dashboard move and validation work, then contracts, and only then native app scaffolding.

## Contract Change Workflow

When a change affects shared payloads:

1. update `packages/contracts` schemas and fixtures
2. update TypeScript exports
3. validate contract tests
4. adopt the new contract in desktop or iOS code

Do not let desktop or iOS silently define backend-facing shapes independently once a shared contract exists for that payload.

## Dashboard Move Guardrails

Stale `dashboard/` path references are guarded by `scripts/check-dashboard-paths.sh`.

That script currently protects:

- `Makefile`
- `.gitignore`
- `.github/workflows/ci.yml`
- `.githooks/pre-push`
- `dev/MEMORY.md`
- `apps/dashboard/README.md`
- `apps/dashboard/TROUBLESHOOTING.md`

When new operational docs or tooling files are added, extend the guard if they contain live path assumptions.

## What Not To Do

- do not develop iPad work directly on `main`
- do not create long-lived side branches for all mobile work
- do not bypass the contracts package once a shared payload has been defined there
- do not treat top-level repo directory scanning as equivalent to explicit agent identity

OpenClaw has a fixed known agent set today; code that needs real agent identities should use that source of truth rather than infer agents from arbitrary top-level directories.
