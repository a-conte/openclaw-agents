# @openclaw/contracts

Canonical client-facing contracts for OpenClaw Mission Control.

## Contents

- `schemas/`: JSON Schema source of truth
- `fixtures/`: representative payload samples from the current desktop dashboard model
- `src/generated-types.ts`: initial TypeScript contract exports
- `tests/schema-smoke.test.ts`: schema validation and compatibility checks

## Initial Scope

This package currently standardizes:

- `AgentSummaryContract`
- `TaskContract`
- `WorkflowRunContract`
- `EventEnvelopeContract`

These are entity contracts, not full HTTP response wrapper contracts.
