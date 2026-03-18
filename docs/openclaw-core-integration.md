# OpenClaw Core Integration Spec

This document defines the remaining integration work required in the external OpenClaw runtime so the automation stack in this repo becomes a true first-class built-in capability, not just a repo-local adapter.

## Goal

Expose the automation runtime behind `apps/listen` as a native OpenClaw execution path that agents can call directly through the broader OpenClaw tool/runtime layer.

Today, this repo already provides:

- runtime endpoints in [`apps/listen/listen_server.py`](/Users/a_conte/dev/openclaw-agents/apps/listen/listen_server.py)
- a programmatic client in [`apps/listen/client.py`](/Users/a_conte/dev/openclaw-agents/apps/listen/client.py)
- workflow/template execution, wait, retry, artifact inspection, metrics, and template management

What is missing is the external OpenClaw-side registration and wiring.

## Current Integration Surface

The external runtime should integrate against `ListenClient`.

Primary methods already implemented:

- `execute_job(payload, wait=False, timeout=300.0, poll_interval=1.0)`
- `execute_template(template_id, template_inputs=None, target_agent="main", wait=False, timeout=300.0, poll_interval=1.0)`
- `submit_template_job(template_id, template_inputs=None, target_agent="main")`
- `submit_workflow_spec(workflow_spec, target_agent="main")`
- `inspect_job(job_id)`
- `wait_for_job_native(job_id, timeout=300.0, poll_interval=1.0)`
- `retry_job(job_id, mode="resume_failed", resume_from_step_id=None)`
- `job_artifacts(job_id)`
- `agent_templates()`
- `template_versions(template_id)`
- `template_diff(template_id, from_version, to_version=None)`
- `create_template(payload)`
- `update_template(template_id, payload)`
- `clone_template(template_id, new_id=None, new_name=None)`
- `restore_template(template_id, version)`
- `delete_template(template_id)`

Backing HTTP endpoints already exist under:

- `POST /agent/execute`
- `GET /agent/job/<id>`
- `POST /agent/job/<id>/wait`
- `POST /agent/job/<id>/retry`
- `GET /agent/job/<id>/artifacts`
- `GET /agent/templates`
- `GET /agent/templates/<id>/versions`
- `GET /agent/templates/<id>/diff`
- `POST /agent/templates`
- `PUT /agent/templates/<id>`
- `POST /agent/templates/<id>/clone`
- `POST /agent/templates/<id>/restore`
- `DELETE /agent/templates/<id>`

## External OpenClaw Work Required

### 1. Register a native automation tool

Add a built-in OpenClaw tool, for example `automation_jobs`, with a stable action-based interface.

Recommended actions:

- `execute_template`
- `execute_workflow_spec`
- `submit_job`
- `get_job`
- `wait_job`
- `retry_job`
- `list_templates`
- `template_versions`
- `template_diff`
- `get_job_artifacts`

This should be a real built-in tool registration in the external runtime, not just shelling out to `direct`.

### 2. Bind the tool to ListenClient

Tool handlers should instantiate `ListenClient` using a configurable base URL:

- default: `http://127.0.0.1:7600`
- override via env, for example `OPENCLAW_AUTOMATION_BASE_URL`

The tool should call `ListenClient` directly, not reimplement request logic.

### 3. Normalize the tool schema

Recommended request schema:

```json
{
  "action": "execute_template",
  "templateId": "repo_release_readiness",
  "templateInputs": {
    "repoPath": "/Users/a_conte/dev/openclaw-agents"
  },
  "targetAgent": "main",
  "wait": true,
  "timeout": 300,
  "pollInterval": 1
}
```

Recommended retry schema:

```json
{
  "action": "retry_job",
  "jobId": "abc123",
  "mode": "resume_failed"
}
```

Recommended result shape:

```json
{
  "ok": true,
  "action": "execute_template",
  "job": {
    "id": "abc123",
    "status": "completed",
    "summary": "Workflow repo_release_readiness completed",
    "templateId": "repo_release_readiness",
    "attempt": 1
  }
}
```

For non-waiting execution:

```json
{
  "ok": true,
  "action": "submit_job",
  "jobId": "abc123",
  "waited": false
}
```

For failures:

```json
{
  "ok": false,
  "action": "execute_template",
  "error": "human-readable message"
}
```

### 4. Preserve listen semantics

The OpenClaw tool should preserve existing runtime behavior:

- policy blocking remains enforced by `listen`
- `resume_failed`, `resume_from`, and `rerun_all` retry modes stay unchanged
- returned job payloads should preserve:
  - `updates`
  - `stepStatus`
  - `history`
  - `policy`
  - `artifacts`
  - `summary`

Do not flatten away useful automation state just to make the tool simpler.

### 5. Add agent-facing guidance

The external runtime should document how agents should use the tool:

- prefer `execute_template` for known operational flows
- use `execute_workflow_spec` only when dynamic composition is required
- use `wait=true` for bounded operations where the agent needs the final result now
- use submit + wait/poll for long-running jobs
- use `retry_job` instead of resubmitting when a job already has useful lineage/state

## Recommended Tool Contract

Recommended single-tool action model:

```json
{
  "action": "execute_template | execute_workflow_spec | submit_job | get_job | wait_job | retry_job | list_templates | template_versions | template_diff | get_job_artifacts",
  "templateId": "optional",
  "templateInputs": {},
  "workflowSpec": {},
  "jobId": "optional",
  "mode": "optional retry mode",
  "resumeFromStepId": "optional",
  "targetAgent": "optional",
  "wait": true,
  "timeout": 300,
  "pollInterval": 1
}
```

This is preferable to many separate runtime tools because:

- easier model/tool discovery
- lower schema sprawl
- consistent auth/config story
- easier future expansion

## Environment / Configuration

The external runtime should support:

- `OPENCLAW_AUTOMATION_BASE_URL`
- `OPENCLAW_AUTOMATION_TIMEOUT`
- optional enable flag such as `OPENCLAW_ENABLE_AUTOMATION_TOOL=true`

Recommended defaults:

- base URL: `http://127.0.0.1:7600`
- timeout: `300`

## Validation Checklist

The external OpenClaw repo should verify:

1. agent can list templates from the built-in tool
2. agent can execute a template with `wait=true`
3. agent can submit a long-running workflow and then wait on the job
4. agent can inspect `stepStatus` and `updates`
5. agent can fetch artifact metadata
6. agent can retry a failed job with `resume_failed`
7. policy-blocked jobs return clear tool errors without hiding the underlying policy reason

## Definition Of Done

This integration is done when:

- the external OpenClaw runtime exposes automation as a built-in registered tool
- agents can execute template/workflow jobs without using `direct` or manual CLI glue
- job wait/retry/artifact access work from the same tool path
- returned results preserve the structured runtime state already available from `listen`

## Non-Goals

This spec does not require:

- rewriting `listen`
- replacing the existing HTTP adapter with a different transport
- duplicating workflow/template logic into the external runtime

The external runtime should integrate with the existing adapter, not fork it.
