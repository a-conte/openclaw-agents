# OpenClaw API Contracts

## Purpose

This document defines the initial contract strategy for OpenClaw Mission Control across the desktop dashboard and the future native iPad client.

The contract layer exists to stop drift between clients and the backend-facing payloads they consume. It is the source of truth for client-facing shapes, not a place for UI-specific view models.

## Canonical Format

The initial source-of-truth format is **JSON Schema Draft 2020-12** stored in `packages/contracts/schemas/`.

Why JSON Schema first:

- checked into git and easy to review
- machine-readable and validation-friendly
- easy to use from TypeScript immediately
- reasonable foundation for later Swift generation or manual Swift model conformance

Initial tooling baseline:

- JSON Schema draft: `2020-12`
- validator in TypeScript: `ajv`
- TypeScript contract exports: checked-in types in `packages/contracts/src/generated-types.ts`
- Swift contract consumption: manual field-parity with the shared schema for the first iPad shell

The initial contracts package should include:

- `agent-summary.schema.json`
- `task.schema.json`
- `workflow-run.schema.json`
- `event-envelope.schema.json`

## Initial Contract Mapping

The first shared contracts should come from concrete existing dashboard sources:

| Contract | Current source in repo | Initial fixture input |
|----------|------------------------|------------------------|
| `AgentSummaryContract` | `apps/dashboard/src/lib/types.ts` and the health/config-backed agent list payload from `apps/dashboard/src/app/api/agents/route.ts` | representative agent summary fixture captured from the current canonical agents API output |
| `TaskContract` | `apps/dashboard/src/lib/types.ts` and task persistence in `apps/dashboard/src/lib/tasks-store.ts` | representative task fixtures captured from the current dashboard task data |
| `WorkflowRunContract` | `apps/dashboard/src/lib/types.ts` and workflow persistence in `apps/dashboard/src/lib/workflow-runs-store.ts` | representative workflow run fixtures captured from the current dashboard workflow run data |
| `EventEnvelopeContract` | architecture-defined realtime envelope in `spec.md` | representative event envelope samples designed to match the reconciliation model |

These mappings describe **entity contracts**, not full HTTP response wrappers. For example, `/api/workflows/runs` currently returns `{ runs }`; the first contracts package should standardize the `WorkflowRunContract` entity shape first, and only add explicit response-envelope contracts later if multiple clients benefit from them.

For `AgentSummaryContract`, canonical fixture input should come from the health/config-backed payload path in `apps/dashboard/src/app/api/agents/route.ts`. The route's last-resort directory-discovery fallback is an operational fallback, not the source of truth for shared contract design.

## Package Layout

The contracts package should live at `packages/contracts` and include:

- `schemas/` for canonical JSON Schema files
- `fixtures/` for representative payloads captured from the current dashboard data and APIs
- `src/generated-types.ts` for the initial TypeScript contract exports
- `src/index.ts` for the public package entrypoint
- `tests/schema-smoke.test.ts` for schema validation and fixture compatibility tests

The package should expose a root entrypoint through `exports` in `packages/contracts/package.json`.

## Initial Contract Scope

The first contract slice should focus on payloads that are already stable enough to share:

- `AgentSummaryContract`
- `TaskContract`
- `WorkflowRunContract`
- `EventEnvelopeContract`

The full dashboard `Agent` shape remains local for now because it still mixes canonical data with dashboard-specific filesystem and heartbeat details.

That split is intentional:

- `AgentSummaryContract` is appropriate for iPad Mission Control cards, lightweight desktop summaries, and realtime updates
- the full dashboard `Agent` interface is still a local compatibility seam until a fuller shared agent-state contract is designed

## Compatibility Rules

Every contract change must be both:

- reviewed in schema form
- validated against representative fixture payloads from the current system

At minimum, the contracts package should validate:

- sample agent summary payloads
- representative task payload fixtures captured from the current dashboard data model
- representative workflow run payload fixtures captured from the current dashboard data model
- representative realtime event envelope samples

If a backend payload changes shape, the contracts package must be updated first or in the same change.

## TypeScript Consumption

Desktop consumption should happen through `@openclaw/contracts`.

Current pattern:

- keep `apps/dashboard/src/lib/types.ts` as a compatibility seam
- gradually re-export shared contract types from `@openclaw/contracts`
- keep dashboard-only shapes local until they have a real cross-client contract

This allows the desktop app to adopt shared models incrementally without a large refactor.

## Swift Consumption

The first iPad shell should mirror the shared contract fields in Swift models, starting with `AgentSummary`.

Short term:

- define canonical JSON Schema in `packages/contracts`
- keep the initial Swift model aligned manually with the shared schema
- validate payload semantics through fixtures and explicit field parity

Later options:

- generate Swift types from schema-derived artifacts
- introduce a dedicated generation step if the contract surface grows enough to justify it

## Realtime Event Rules

Realtime payloads must use a stable event envelope that supports:

- event identity
- ordering or sequence tracking
- entity identity
- server timestamp
- idempotent application

The initial envelope should support client reconciliation rules already defined in the main architecture spec:

1. fetch initial snapshot
2. subscribe to stream
3. apply deltas
4. detect gaps and refetch affected snapshots

## Versioning Policy

Initial versioning can remain repo-internal and Git-based, but contract changes should still behave as explicit compatibility decisions.

Rules:

- additive changes are preferred
- destructive field renames or removals require coordinated client updates
- schema fixture tests must pass before a contract change is considered valid

## Near-Term Non-Goals

- full OpenAPI coverage for every backend route
- automatic Swift code generation on day one
- sharing UI-level view models between web and iOS

The first goal is a reliable shared contract spine, not a maximal schema platform.
