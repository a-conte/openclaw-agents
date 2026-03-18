# Automation Roadmap

This is the next-stage roadmap for the OpenClaw automation stack after the current `steer` / `drive` / `listen` / `direct` / dashboard / iPad foundation.

## Current State

The core architecture is already in place:

- local automation primitives via `apps/steer` and `apps/drive`
- remote runtime via `apps/listen` and `apps/direct`
- hardened workflow execution with retries, policy, artifacts, metrics, templates, and template versioning
- operator surfaces in `apps/dashboard` and `apps/ios`
- a first agent-facing client in `apps/listen/client.py`

The remaining work is primarily product hardening, operator experience, and deeper OpenClaw integration.

## Priority Order

1. Real OpenClaw-core integration
2. Better template management
3. Richer observability
4. Artifact packaging and retention controls
5. Workflow library expansion
6. Bootstrap automation
7. More iPad polish

## Progress Snapshot

Completed or materially in place:

- Real OpenClaw-core integration:
  - repo-local native automation adapter endpoints under `listen`
  - native client helpers for submit, wait, inspect, artifacts, retry, and template catalog/diff access
- Better template management:
  - template clone
  - template version diff
  - template restore
  - required-input validation
  - favorite / recommended metadata
  - category and search UX
- Richer observability:
  - template success-rate metrics
  - recent daily trend aggregation
  - median and p95 duration metrics
  - per-step artifact volume metrics
  - retry lineage summaries
  - dashboard observability cards
- Bootstrap automation:
  - guided bootstrap script via `scripts/bootstrap-mac.sh`
  - `docs/bootstrap-mac.md` now points to the script-backed flow
- iPad polish:
  - metrics, policy, artifact summary, template metadata, artifact preview, and custom template editing surfaces are partially implemented

Still meaningfully open:

- deeper external OpenClaw product/runtime integration beyond the repo-local adapter surface
- fuller template diff UX on iPad
- richer job lineage visualization beyond summary chains
- deeper workflow-library coverage beyond the new Wave 2 starter set
- full tablet-first parity on iPad

Current active focus:

- deeper workflow-library coverage
- fuller iPad diff/admin parity

## Wave 1

### 1. Real OpenClaw-Core Integration

Goal:
- Make automation jobs a first-class built-in execution path inside the broader OpenClaw runtime/tool layer, not just an adjacent HTTP/CLI system.

Status:
- Implemented
- Current state: repo-local native adapter endpoints and client helpers are available via `apps/listen/client.py` and `listen`'s `/agent/*` routes, but this is not yet a deeper built-in OpenClaw core-tool/runtime integration in the external product/runtime itself.

Deliverables:
- [x] add a native OpenClaw tool or execution adapter that can:
  - [x] submit jobs
  - [x] wait for jobs
  - [x] inspect job details
  - [x] fetch artifacts
  - [x] resume/retry jobs
- [x] standardize job payload and result shape for agent use
- [x] expose workflow templates as a first-class agent-facing catalog

Suggested commit slices:
- `Add OpenClaw automation execution adapter`
- `Add OpenClaw job wait and artifact fetch helpers`
- `Expose workflow templates to OpenClaw runtime`

Definition of done:
- an OpenClaw agent can execute a workflow/template without going through `direct`
- job polling and artifacts are available from the same runtime path

Remaining gap:
- wire this adapter into the broader external OpenClaw runtime/tool registration path, not only the repo-local `listen` surface

### 2. Better Template Management

Goal:
- Turn templates from “usable config objects” into a proper operator product surface.

Status:
- Implemented except for deeper diff UX polish

Deliverables:
- [x] clone template
- [x] diff template versions
- [x] restore older version
- [x] stronger validation for required inputs
- [x] mark templates as recommended or favorite
- [x] clearer category and search UX

Suggested commit slices:
- `Add template clone and recommended flags`
- `Add template version diff and restore`
- `Strengthen template input validation`

Definition of done:
- operators can manage template lifecycle without editing raw JSON unless they choose to

Remaining gap:
- extend compare UX beyond the dashboard to iPad and possibly side-by-side structured diffing

### 3. Richer Observability

Goal:
- Move from basic metrics to decision-grade observability.

Status:
- Mostly implemented

Deliverables:
- [x] time-series trend views
- [x] template success rate over time
- [x] median and p95 durations
- [x] per-step artifact counts and sizes
- [x] job lineage graph for retries and resumes

Suggested commit slices:
- `Add time-series job metrics aggregation`
- `Add template success and duration views`
- `Add job lineage visualization data and dashboard panel`

Definition of done:
- operators can identify regressions, slow templates, and retry hotspots from the product UI

Remaining gap:
- deepen visualization quality for lineage and long-term trends

## Wave 2

### 4. Artifact Packaging And Retention Controls

Goal:
- Make artifact storage operationally manageable as usage grows.

Status:
- Implemented except for UX polish

Deliverables:
- [x] per-template retention rules
- [x] export/download-all for a single job
- [x] incident artifact bundles
- [x] optional compression for archived artifacts

Suggested commit slices:
- `Add artifact export bundle endpoints`
- `Add template retention policies`
- `Add archived artifact compression`

Definition of done:
- operators can package and retain artifacts intentionally rather than only pruning globally

Remaining gap:
- add richer artifact-admin/export UX on iPad

### 5. Workflow Library Expansion

Goal:
- Increase practical leverage through reusable high-value templates.

Status:
- Partially implemented

Deliverables:
- [x] repo repair loops
- [x] dashboard audit flows
- [x] browser auth/login/recovery flows
- [x] daemon restart and verification bundles
- [x] operator handoff bundles with note, screenshot, OCR, and summary

Suggested commit slices:
- `Add repo repair and test-fix workflow templates`
- `Add dashboard audit templates`
- `Add browser auth and recovery templates`
- `Add operator handoff bundles`

Definition of done:
- the system ships with a durable library of workflows operators will actually reuse

Remaining gap:
- expand the starter set into a broader day-to-day library with stronger app- and incident-specific coverage

## Wave 3

### 6. Bootstrap Automation

Goal:
- Replace the current manual bootstrap doc with an actual machine bring-up script.

Status:
- In progress

Deliverables:
- [x] dependency installer
- [x] permission verification checklist/script
- [x] Xcode/iOS project generation
- [x] `listen`, dashboard, and CLI sanity checks

Suggested commit slices:
- `Add Mac bootstrap script`
- `Add permission and service verification checks`

Definition of done:
- a new Mac can be brought to operational state with one guided script plus a few unavoidable macOS permission approvals

Remaining gap:
- add more opinionated bootstrap checks if multi-host rollout becomes common

### 7. More iPad Polish

Goal:
- Make the iPad app feel closer to the dashboard for daily operation.

Status:
- In progress

Deliverables:
- [x] better artifact previews
- [x] template editing support
- [x] policy admin display
- [x] metrics views
- [x] stronger job detail navigation

Suggested commit slices:
- `Add iPad metrics and policy surfaces`
- `Add iPad artifact preview improvements`
- `Add iPad template editing and navigation polish`

Definition of done:
- the iPad app is viable as a real operator console, not just a lightweight companion

Remaining gap:
- extend template diff/compare and admin workflows further so the iPad can match the dashboard power-user experience

## Execution Strategy

Recommended order:

1. OpenClaw-core integration
2. Template lifecycle UX
3. Richer observability
4. Artifact packaging and retention controls
5. Workflow library expansion
6. Bootstrap script
7. iPad polish

Reasoning:
- steps 1-3 provide the highest leverage and cleanest foundation
- steps 4-5 improve scale and practical reuse
- steps 6-7 improve onboarding and operator ergonomics after the core product path is stronger

## Notes

- The current local state files should remain uncommitted:
  - `main/heartbeat-state.json`
  - `shared/logs/activity.jsonl`
- The roadmap assumes the existing `listen` file-backed job store remains in place unless a later migration is explicitly planned.
- This document is a planning artifact, not a promise that all items should be implemented in one branch or one turn.
