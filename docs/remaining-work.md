# Remaining Work

This file tracks the main remaining work after the core OpenClaw automation stack, dashboard Mission Control, iPad supplemental client, Apple communication roadmap, and local startup flow were put in place.

The goal is to keep the remaining scope small, explicit, and easy to chip away one slice at a time.

## 1. External OpenClaw Integration

Status:
- Partially completed
- Active code/work exists in the separate fork at [`/Users/a_conte/dev/openclaw`](/Users/a_conte/dev/openclaw)
- The forked CLI is now built, globally linked, and smoke-tested locally against the `automation_jobs` tool

Remaining tasks:
- wire the `automation_jobs` path into the broader OpenClaw runtime/tool surface as a normal installed capability
- [x] install and validate the forked OpenClaw build locally so real agent sessions use the plugin by default
- document the fork-based local install/update workflow
- decide whether the plugin remains fork-only or becomes part of a longer-lived private/internal branch strategy

Primary reference:
- [`docs/openclaw-core-integration.md`](/Users/a_conte/dev/openclaw-agents/docs/openclaw-core-integration.md)

## 2. Apple Ecosystem Polish

Status:
- Apple communication roadmap Waves 1-3 are materially implemented
- Remaining work is polish and operator convenience

Remaining tasks:
- package real Apple Shortcuts recipes instead of exposing only HTTP endpoints
- add event-driven iMessage and Mail dispatch from notification events, not only manual/template invocation
- deepen delivery routing controls per template and per agent
- review notification noise and add tighter severity/routing defaults if needed

Primary reference:
- [`docs/apple-ecosystem-communication-roadmap.md`](/Users/a_conte/dev/openclaw-agents/docs/apple-ecosystem-communication-roadmap.md)

## 3. iPad Product Polish

Status:
- Strong supplemental surface
- Not yet full dashboard parity

Remaining tasks:
- add a cleaner navigation structure for admin, jobs, templates, metrics, and alerts
- improve artifact browsing and preview depth
- deepen metrics and history drill-down
- move admin functions into cleaner dedicated screens instead of stacking them into a few views

## 4. Workflow Library Depth

Status:
- Strong starter library is already in place
- Remaining work depends on real daily usage patterns

Remaining tasks:
- add more repo maintenance flows
- add more incident and recovery bundles
- add more browser and app-specific flows
- add more operator handoff variants
- prune or merge low-value templates once usage patterns are clear

Primary reference:
- [`apps/listen/workflow_templates.py`](/Users/a_conte/dev/openclaw-agents/apps/listen/workflow_templates.py)

## 5. General Hygiene

Status:
- In progress
- Worth doing to keep the machine stable and less surprising

Remaining tasks:
- [x] set explicit global git `user.name` and `user.email`
- [x] add a top-level “status of everything” view or script snapshot
- decide whether to keep expanding tmux-based local ops or move some services to `launchd`
- continue tightening local bring-up and maintenance docs as habits stabilize

Primary references:
- [`scripts/local-stack.sh`](/Users/a_conte/dev/openclaw-agents/scripts/local-stack.sh)
- [`scripts/status-everything.sh`](/Users/a_conte/dev/openclaw-agents/scripts/status-everything.sh)
- [`docs/local-startup.md`](/Users/a_conte/dev/openclaw-agents/docs/local-startup.md)
- [`docs/bootstrap-mac.md`](/Users/a_conte/dev/openclaw-agents/docs/bootstrap-mac.md)

## Suggested Order

If working strictly by practical leverage:

1. external OpenClaw integration
2. Apple ecosystem polish
3. iPad product polish
4. workflow library depth
5. general hygiene

If working by lowest friction inside this repo:

1. general hygiene
2. Apple ecosystem polish
3. iPad product polish
4. workflow library depth
5. external OpenClaw integration
