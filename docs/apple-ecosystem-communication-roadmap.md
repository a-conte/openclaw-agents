# Apple Ecosystem Communication Roadmap

This roadmap defines how to extend the current `openclaw-agents` stack so
agents can communicate with the operator through Apple-native surfaces without
breaking the existing `listen` policy and automation model.

## Current State

What already exists:

- iPad Mission Control app in [`apps/ios`](/Users/a_conte/dev/openclaw-agents/apps/ios)
- local Apple app automation via [`apps/steer`](/Users/a_conte/dev/openclaw-agents/apps/steer)
- workflow/runtime orchestration via [`apps/listen`](/Users/a_conte/dev/openclaw-agents/apps/listen)
- dashboard operator surface in [`apps/dashboard`](/Users/a_conte/dev/openclaw-agents/apps/dashboard)
- Apple Notes and TextEdit primitives through local automation workflows
- Apple notification preferences, event history, and supplemental iPad alert plumbing

What does not yet exist:

- true APNs-backed iPad push delivery
- Apple-native delivery execution from notification events themselves
- fully unified Apple delivery routing across all channels

## Principles

- Keep `listen` as the policy and execution boundary.
- Add Apple communication as adapters on top of job state and workflow outputs.
- Default to low-risk channels first.
- Keep human approval for high-risk outbound communication.
- Prefer templated communication over freeform agent-authored sends.

## Priority Order

### 1. iPad Push Notifications

Highest leverage and lowest risk.

Use for:

- critical job failures
- critical workflow completion
- policy-blocked jobs
- approval-required states

Why first:

- the iPad app already exists
- notifications are lower risk than outbound Messages or Mail
- this improves responsiveness immediately without changing operator behavior much

### 2. Apple Notes Handoff

Low-risk durable summaries.

Use for:

- incident notes
- daily briefings
- research summaries
- operator handoff bundles

Why second:

- Notes creation already exists in the automation layer
- this is mostly workflow and productization work

### 3. iMessage Alerts

Best Apple-native direct alert path, but higher trust than push.

Use for:

- short completion/failure alerts
- approval requests
- high-priority summaries

Constraints:

- start with templated short messages only
- no autonomous freeform multi-turn messaging at first
- route all sends through explicit `listen` policy checks

### 4. Apple Mail Draft Flow

Good for external communication, but slower and riskier.

Use for:

- incident summary drafts
- stakeholder updates
- follow-up drafts

Constraints:

- draft-only first
- no autonomous send without explicit approval

### 5. Apple Shortcuts Integration

Best mobile control layer after push is live.

Use for:

- run a known workflow template
- inspect latest failed job
- retry a job
- fetch a compact metrics summary
- open the relevant dashboard/iPad screen

## Wave Plan

## Wave 1

Goal: add safe Apple-native operator awareness.

Deliverables:

- iPad supplemental alert pipeline for critical job events
- notification preference model by agent/template/severity
- `operator_handoff_note` workflow hardened as an Apple Notes-first output
- dashboard and iPad settings surface for Apple notification preferences

Definition of done:

- a critical failed job can raise a supplemental iPad alert
- tapping the notification opens the relevant job detail
- a workflow can write a structured Apple Note with summary + artifact references

Suggested slices:

- `Done: notification event model and device registration`
- `Done: iPad alert deep-link handling for jobs`
- `Done: Apple Notes-first handoff templates`
- `Done: dashboard and iPad notification preferences UI`
- `Open: real APNs delivery once signing/entitlements are in place`

## Wave 2

Goal: add Apple-native direct communication.

Deliverables:

- templated iMessage alert workflow
- Apple Mail draft workflows
- delivery routing controls in dashboard and iPad

Definition of done:

- a critical job can trigger a short templated iMessage alert
- incident summary workflows can create Mail drafts for review
- operator can choose Apple push vs iMessage vs Notes vs Mail draft targets per template

Suggested slices:

- `Done: iMessage templated alert workflow`
- `Done: Mail draft incident summary workflow`
- `Done: Apple delivery routing config in dashboard-first settings`
- `Open: event-driven delivery dispatch for iMessage/Mail beyond explicit workflow steps`

## Wave 3

Goal: add mobile-first Apple control.

Deliverables:

- Apple Shortcuts bridge
- iPhone/iPad quick actions
- compact metrics/incident summaries for mobile triggers

Definition of done:

- operator can trigger approved workflow templates from Shortcuts
- operator can query latest failed job or retry a job from Shortcuts
- actions honor the same `listen` policy controls as dashboard/iPad

Suggested slices:

- `Done: Shortcuts-friendly HTTP actions`
- `Done: retry/latest-failure Shortcut flows`
- `Done: compact mobile summary payloads`
- `Open: iOS Shortcuts app export/import assets and human-facing Shortcut recipes`

## Security Model

Apple-native communication should remain stricter than generic automation.

Safe by default:

- iPad push notifications
- Apple Notes creation
- dashboard/iPad preference and admin reads

Require policy or approval:

- iMessage sending
- Apple Mail draft creation if it includes external recipient metadata
- any future Apple Mail send action
- any Apple app automation that could impersonate the user externally

Recommended policy posture:

- keep `listen` bound to loopback where possible
- keep dangerous commands denied by default
- add explicit allowlists for Apple communication workflows
- preserve artifact retention limits for screenshots/OCR/logs referenced in notifications

## Data / API Shape

New likely additions:

- notification preferences:
  - channel: `push | notes | imessage | mail_draft`
  - severity threshold
  - template allowlist
  - agent allowlist
- device registration endpoint, with APNs token support when available
- notification event emission from `listen`/dashboard for important job states
- artifact deep links safe for iPad consumption

## First Recommended Templates

- `job_failure_alert_ios`
- `operator_handoff_note`
- `imessage_status_ping`
- `mail_draft_incident_summary`

## Definitions Of Success

- operator receives timely Apple-native alerts without opening the dashboard constantly
- agent communication stays routed through the existing policy boundary
- outbound Apple communication remains low-risk and auditable
- Apple-native surfaces complement the dashboard instead of fragmenting orchestration logic
