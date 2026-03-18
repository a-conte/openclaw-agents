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

## Wave 1

### 1. Real OpenClaw-Core Integration

Goal:
- Make automation jobs a first-class built-in execution path inside the broader OpenClaw runtime/tool layer, not just an adjacent HTTP/CLI system.

Deliverables:
- add a native OpenClaw tool or execution adapter that can:
  - submit jobs
  - wait for jobs
  - inspect job details
  - fetch artifacts
  - resume/retry jobs
- standardize job payload and result shape for agent use
- expose workflow templates as a first-class agent-facing catalog

Suggested commit slices:
- `Add OpenClaw automation execution adapter`
- `Add OpenClaw job wait and artifact fetch helpers`
- `Expose workflow templates to OpenClaw runtime`

Definition of done:
- an OpenClaw agent can execute a workflow/template without going through `direct`
- job polling and artifacts are available from the same runtime path

### 2. Better Template Management

Goal:
- Turn templates from “usable config objects” into a proper operator product surface.

Deliverables:
- clone template
- diff template versions
- restore older version
- stronger validation for required inputs
- mark templates as recommended or favorite
- clearer category and search UX

Suggested commit slices:
- `Add template clone and recommended flags`
- `Add template version diff and restore`
- `Strengthen template input validation`

Definition of done:
- operators can manage template lifecycle without editing raw JSON unless they choose to

### 3. Richer Observability

Goal:
- Move from basic metrics to decision-grade observability.

Deliverables:
- time-series trend views
- template success rate over time
- median and p95 durations
- per-step artifact counts and sizes
- job lineage graph for retries and resumes

Suggested commit slices:
- `Add time-series job metrics aggregation`
- `Add template success and duration views`
- `Add job lineage visualization data and dashboard panel`

Definition of done:
- operators can identify regressions, slow templates, and retry hotspots from the product UI

## Wave 2

### 4. Artifact Packaging And Retention Controls

Goal:
- Make artifact storage operationally manageable as usage grows.

Deliverables:
- per-template retention rules
- export/download-all for a single job
- incident artifact bundles
- optional compression for archived artifacts

Suggested commit slices:
- `Add artifact export bundle endpoints`
- `Add template retention policies`
- `Add archived artifact compression`

Definition of done:
- operators can package and retain artifacts intentionally rather than only pruning globally

### 5. Workflow Library Expansion

Goal:
- Increase practical leverage through reusable high-value templates.

Deliverables:
- repo repair loops
- dashboard audit flows
- browser auth/login/recovery flows
- daemon restart and verification bundles
- operator handoff bundles with note, screenshot, OCR, and summary

Suggested commit slices:
- `Add repo repair and test-fix workflow templates`
- `Add dashboard audit templates`
- `Add browser auth and recovery templates`
- `Add operator handoff bundles`

Definition of done:
- the system ships with a durable library of workflows operators will actually reuse

## Wave 3

### 6. Bootstrap Automation

Goal:
- Replace the current manual bootstrap doc with an actual machine bring-up script.

Deliverables:
- dependency installer
- permission verification checklist/script
- Xcode/iOS project generation
- `listen`, dashboard, and CLI sanity checks

Suggested commit slices:
- `Add Mac bootstrap script`
- `Add permission and service verification checks`

Definition of done:
- a new Mac can be brought to operational state with one guided script plus a few unavoidable macOS permission approvals

### 7. More iPad Polish

Goal:
- Make the iPad app feel closer to the dashboard for daily operation.

Deliverables:
- better artifact previews
- template editing support
- policy admin display
- metrics views
- stronger job detail navigation

Suggested commit slices:
- `Add iPad metrics and policy surfaces`
- `Add iPad artifact preview improvements`
- `Add iPad template editing and navigation polish`

Definition of done:
- the iPad app is viable as a real operator console, not just a lightweight companion

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
