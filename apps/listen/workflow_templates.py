from __future__ import annotations

import json
import re
import time
from difflib import unified_diff
from copy import deepcopy
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[2]
CUSTOM_TEMPLATES_PATH = Path(__file__).resolve().parent / "templates.json"


BUILTIN_TEMPLATES: list[dict[str, Any]] = [
    {
        "id": "open_command_page",
        "name": "Open Command Page",
        "description": "Open the local Mission Control command page in Safari.",
        "category": "browser",
        "builtIn": True,
        "recommended": True,
        "artifactRetentionDays": 14,
        "inputs": [
            {
                "key": "url",
                "label": "URL",
                "description": "Target page to open in Safari.",
                "required": False,
                "defaultValue": "http://localhost:3000/command",
            }
        ],
    },
    {
        "id": "recover_command_page",
        "name": "Recover Command Page",
        "description": "Open the command page, click Reload if Safari is on an error page, and wait for /command.",
        "category": "browser",
        "builtIn": True,
        "recommended": True,
        "artifactRetentionDays": 14,
        "inputs": [
            {
                "key": "url",
                "label": "URL",
                "description": "Command page URL.",
                "required": False,
                "defaultValue": "http://localhost:3000/command",
            }
        ],
    },
    {
        "id": "repo_status_check",
        "name": "Repo Status Check",
        "description": "Run git status in a managed shell session and capture the output.",
        "category": "repo",
        "builtIn": True,
        "favorite": True,
        "artifactRetentionDays": 14,
        "inputs": [
            {
                "key": "repoPath",
                "label": "Repo Path",
                "description": "Absolute path to the repo you want to inspect.",
                "required": False,
                "defaultValue": str(REPO_ROOT),
            }
        ],
    },
    {
        "id": "browser_snapshot_review",
        "name": "Browser Snapshot Review",
        "description": "Open a page in Safari, wait for the URL, then capture a window-scoped screenshot and OCR snapshot.",
        "category": "browser",
        "builtIn": True,
        "artifactRetentionDays": 30,
        "inputs": [
            {
                "key": "url",
                "label": "URL",
                "description": "Page to load in Safari.",
                "required": False,
                "defaultValue": "http://localhost:3000/command",
            },
            {
                "key": "expected",
                "label": "Expected URL Fragment",
                "description": "URL fragment to wait for before capture.",
                "required": False,
                "defaultValue": "/command",
            },
        ],
    },
    {
        "id": "operator_handoff_note",
        "name": "Operator Handoff Note",
        "description": "Create an Apple Notes handoff for operator escalation or follow-up.",
        "category": "operator",
        "builtIn": True,
        "recommended": True,
        "artifactRetentionDays": 30,
        "inputs": [
            {
                "key": "title",
                "label": "Note Title",
                "description": "Title for the Apple Note.",
                "required": False,
                "defaultValue": "Operator Handoff",
            },
            {
                "key": "text",
                "label": "Note Text",
                "description": "Contents of the Apple Note.",
                "required": False,
                "defaultValue": "Operator handoff:\n- Context:\n- Next action:\n- Risks:",
            }
        ],
    },
    {
        "id": "agent_brief",
        "name": "Agent Brief",
        "description": "Run an OpenClaw agent step with a focused operational prompt.",
        "category": "agent",
        "builtIn": True,
        "favorite": True,
        "artifactRetentionDays": 14,
        "inputs": [
            {
                "key": "agent",
                "label": "Agent",
                "description": "Target OpenClaw agent lane.",
                "required": False,
                "defaultValue": "main",
            },
            {
                "key": "prompt",
                "label": "Prompt",
                "description": "Prompt sent to the agent.",
                "required": False,
                "defaultValue": "Summarize the current operational state in 3 bullets.",
            },
        ],
    },
    {
        "id": "repo_test_build",
        "name": "Repo Test + Build",
        "description": "Run a test command and build command in a repo with captured shell artifacts.",
        "category": "repo",
        "builtIn": True,
        "artifactRetentionDays": 14,
        "inputs": [
            {
                "key": "repoPath",
                "label": "Repo Path",
                "description": "Absolute repo path to execute against.",
                "required": False,
                "defaultValue": str(REPO_ROOT),
            },
            {
                "key": "testCommand",
                "label": "Test Command",
                "description": "Command used for validation before build.",
                "required": False,
                "defaultValue": "npm run dashboard:test",
            },
            {
                "key": "buildCommand",
                "label": "Build Command",
                "description": "Command used for production validation.",
                "required": False,
                "defaultValue": "npm run dashboard:build",
            },
        ],
    },
    {
        "id": "dashboard_health_check",
        "name": "Dashboard Health Check",
        "description": "Open the dashboard, wait for the page, and capture an API health response plus a Safari snapshot.",
        "category": "health",
        "builtIn": True,
        "artifactRetentionDays": 30,
        "inputs": [
            {
                "key": "url",
                "label": "Dashboard URL",
                "description": "Dashboard page to open in Safari.",
                "required": False,
                "defaultValue": "http://localhost:3000/command",
            },
            {
                "key": "healthUrl",
                "label": "Health URL",
                "description": "JSON endpoint checked from shell.",
                "required": False,
                "defaultValue": "http://localhost:3000/api/health",
            },
        ],
    },
    {
        "id": "incident_capture",
        "name": "Incident Capture",
        "description": "Capture a browser snapshot and create an operator handoff note for a live incident.",
        "category": "operator",
        "builtIn": True,
        "artifactRetentionDays": 90,
        "inputs": [
            {
                "key": "url",
                "label": "Incident URL",
                "description": "Page to capture in Safari.",
                "required": False,
                "defaultValue": "http://localhost:3000/command",
            },
            {
                "key": "noteText",
                "label": "Note Text",
                "description": "Seed text for the incident handoff note.",
                "required": False,
                "defaultValue": "Incident capture:\n- Symptom:\n- Evidence:\n- Next action:",
            },
        ],
    },
    {
        "id": "repo_browser_loop",
        "name": "Repo + Browser Loop",
        "description": "Collect repo status, open a browser page, and capture a follow-up OCR snapshot for mixed shell/browser work.",
        "category": "repo",
        "builtIn": True,
        "artifactRetentionDays": 21,
        "inputs": [
            {
                "key": "repoPath",
                "label": "Repo Path",
                "description": "Absolute repo path to inspect.",
                "required": False,
                "defaultValue": str(REPO_ROOT),
            },
            {
                "key": "url",
                "label": "Browser URL",
                "description": "Browser page to open after repo status.",
                "required": False,
                "defaultValue": "http://localhost:3000/command",
            },
        ],
    },
    {
        "id": "listen_restart_health_check",
        "name": "Listen Restart + Health Check",
        "description": "Restart the local listen server and verify that the health page is reachable again.",
        "category": "daemon",
        "builtIn": True,
        "artifactRetentionDays": 7,
        "inputs": [
            {
                "key": "listenCommand",
                "label": "Listen Start Command",
                "description": "Command used to restart the listen server.",
                "required": False,
                "defaultValue": "python3 apps/listen/listen_server.py --host 127.0.0.1 --port 7600",
            },
            {
                "key": "healthUrl",
                "label": "Health URL",
                "description": "Endpoint checked after restart.",
                "required": False,
                "defaultValue": "http://127.0.0.1:7600/policy",
            },
        ],
    },
    {
        "id": "repo_repair_loop",
        "name": "Repo Repair Loop",
        "description": "Inspect repo status, run tests, and capture a focused repair brief.",
        "category": "repo",
        "builtIn": True,
        "recommended": True,
        "artifactRetentionDays": 30,
        "inputs": [
            {
                "key": "repoPath",
                "label": "Repo Path",
                "description": "Absolute repo path to inspect and test.",
                "required": False,
                "defaultValue": str(REPO_ROOT),
            },
            {
                "key": "testCommand",
                "label": "Test Command",
                "description": "Test command used before repair recommendations.",
                "required": False,
                "defaultValue": "npm run dashboard:test",
            },
        ],
    },
    {
        "id": "dashboard_audit",
        "name": "Dashboard Audit",
        "description": "Open the dashboard, verify the command page, and capture both screenshot and OCR evidence.",
        "category": "health",
        "builtIn": True,
        "artifactRetentionDays": 30,
        "inputs": [
            {
                "key": "url",
                "label": "Dashboard URL",
                "description": "Target dashboard page.",
                "required": False,
                "defaultValue": "http://localhost:3000/command",
            }
        ],
    },
    {
        "id": "browser_auth_recovery",
        "name": "Browser Auth Recovery",
        "description": "Open a browser page, recover error UI if needed, and capture a final browser snapshot.",
        "category": "browser",
        "builtIn": True,
        "artifactRetentionDays": 30,
        "inputs": [
            {
                "key": "url",
                "label": "Target URL",
                "description": "Browser page to recover.",
                "required": False,
                "defaultValue": "http://localhost:3000/command",
            }
        ],
    },
    {
        "id": "daemon_restart_verify_bundle",
        "name": "Daemon Restart Verify Bundle",
        "description": "Restart a daemon, verify health, and capture process state for the operator record.",
        "category": "daemon",
        "builtIn": True,
        "artifactRetentionDays": 21,
        "inputs": [
            {
                "key": "restartCommand",
                "label": "Restart Command",
                "description": "Command used to restart the daemon.",
                "required": True,
                "defaultValue": "",
            },
            {
                "key": "healthCommand",
                "label": "Health Command",
                "description": "Command used to verify the daemon after restart.",
                "required": True,
                "defaultValue": "",
            },
        ],
    },
    {
        "id": "operator_handoff_bundle",
        "name": "Operator Handoff Bundle",
        "description": "Create a handoff note together with browser screenshot and OCR evidence for the next operator.",
        "category": "operator",
        "builtIn": True,
        "recommended": True,
        "artifactRetentionDays": 90,
        "inputs": [
            {
                "key": "url",
                "label": "Context URL",
                "description": "Browser page to capture as evidence.",
                "required": False,
                "defaultValue": "http://localhost:3000/command",
            },
            {
                "key": "noteText",
                "label": "Note Text",
                "description": "Initial handoff note text.",
                "required": False,
                "defaultValue": "Operator handoff:\n- Context:\n- Evidence:\n- Next action:\n- Risks:",
            },
        ],
    },
    {
        "id": "repo_release_readiness",
        "name": "Repo Release Readiness",
        "description": "Capture branch, commit, test, and build state for a release checkpoint.",
        "category": "repo",
        "builtIn": True,
        "recommended": True,
        "artifactRetentionDays": 21,
        "inputs": [
            {
                "key": "repoPath",
                "label": "Repo Path",
                "description": "Absolute repo path to inspect.",
                "required": False,
                "defaultValue": str(REPO_ROOT),
            },
            {
                "key": "testCommand",
                "label": "Test Command",
                "description": "Validation command run before build.",
                "required": False,
                "defaultValue": "npm run dashboard:test",
            },
            {
                "key": "buildCommand",
                "label": "Build Command",
                "description": "Build command run for release readiness.",
                "required": False,
                "defaultValue": "npm run dashboard:build",
            },
        ],
    },
    {
        "id": "dashboard_jobs_triage",
        "name": "Dashboard Jobs Triage",
        "description": "Open the command page, capture the jobs API, and gather browser evidence for job triage.",
        "category": "dashboard",
        "builtIn": True,
        "artifactRetentionDays": 30,
        "inputs": [
            {
                "key": "url",
                "label": "Dashboard URL",
                "description": "Target dashboard page.",
                "required": False,
                "defaultValue": "http://localhost:3000/command",
            },
            {
                "key": "jobsUrl",
                "label": "Jobs API URL",
                "description": "Jobs endpoint to fetch from shell.",
                "required": False,
                "defaultValue": "http://localhost:3000/api/jobs",
            },
        ],
    },
    {
        "id": "browser_login_snapshot",
        "name": "Browser Login Snapshot",
        "description": "Open a browser page, wait for expected login text, and capture screenshot plus OCR evidence.",
        "category": "browser",
        "builtIn": True,
        "artifactRetentionDays": 30,
        "inputs": [
            {
                "key": "url",
                "label": "Login URL",
                "description": "Page to open in Safari.",
                "required": True,
                "defaultValue": "",
            },
            {
                "key": "expectedText",
                "label": "Expected Text",
                "description": "Visible UI text to wait for.",
                "required": True,
                "defaultValue": "",
            },
        ],
    },
    {
        "id": "daemon_logs_bundle",
        "name": "Daemon Logs Bundle",
        "description": "Capture daemon status, log output, and a follow-up health check for incident review.",
        "category": "daemon",
        "builtIn": True,
        "artifactRetentionDays": 14,
        "inputs": [
            {
                "key": "statusCommand",
                "label": "Status Command",
                "description": "Command used to capture daemon state.",
                "required": True,
                "defaultValue": "ps aux | grep listen_server.py",
            },
            {
                "key": "logCommand",
                "label": "Log Command",
                "description": "Command used to capture recent daemon logs.",
                "required": True,
                "defaultValue": "tail -n 80 apps/listen/jobs/*.json 2>/dev/null || true",
            },
            {
                "key": "healthUrl",
                "label": "Health URL",
                "description": "Endpoint checked after log capture.",
                "required": False,
                "defaultValue": "http://127.0.0.1:7600/metrics",
            },
        ],
    },
    {
        "id": "repo_change_review",
        "name": "Repo Change Review",
        "description": "Capture repo change state, diff stats, targeted test output, and a short review brief for the next operator.",
        "category": "repo",
        "builtIn": True,
        "artifactRetentionDays": 21,
        "inputs": [
            {
                "key": "repoPath",
                "label": "Repo Path",
                "description": "Absolute repo path to inspect.",
                "required": False,
                "defaultValue": str(REPO_ROOT),
            },
            {
                "key": "testCommand",
                "label": "Test Command",
                "description": "Validation command run after repo inspection.",
                "required": False,
                "defaultValue": "npm run dashboard:test",
            },
        ],
    },
    {
        "id": "dashboard_policy_audit",
        "name": "Dashboard Policy Audit",
        "description": "Open the dashboard, capture policy and metrics endpoints, then gather screenshot and OCR evidence for admin review.",
        "category": "dashboard",
        "builtIn": True,
        "artifactRetentionDays": 30,
        "inputs": [
            {
                "key": "url",
                "label": "Dashboard URL",
                "description": "Target dashboard page.",
                "required": False,
                "defaultValue": "http://localhost:3000/command",
            },
            {
                "key": "policyUrl",
                "label": "Policy Admin URL",
                "description": "Endpoint used to inspect policy admin state.",
                "required": False,
                "defaultValue": "http://localhost:3000/api/jobs/policy/admin",
            },
            {
                "key": "metricsUrl",
                "label": "Metrics URL",
                "description": "Endpoint used to inspect automation metrics.",
                "required": False,
                "defaultValue": "http://localhost:3000/api/jobs/metrics",
            },
        ],
    },
    {
        "id": "browser_recovery_handoff",
        "name": "Browser Recovery Handoff",
        "description": "Recover a browser page, capture evidence, and draft a handoff note with the latest page state.",
        "category": "browser",
        "builtIn": True,
        "recommended": True,
        "artifactRetentionDays": 45,
        "inputs": [
            {
                "key": "url",
                "label": "Target URL",
                "description": "Browser page to recover and capture.",
                "required": False,
                "defaultValue": "http://localhost:3000/command",
            },
            {
                "key": "expectedText",
                "label": "Expected Text",
                "description": "Optional text to wait for before capture.",
                "required": False,
                "defaultValue": "",
            },
            {
                "key": "noteText",
                "label": "Note Text",
                "description": "Initial handoff note content.",
                "required": False,
                "defaultValue": "Browser recovery handoff:\n- Context:\n- Current page state:\n- Next action:",
            },
        ],
    },
    {
        "id": "daemon_recovery_handoff",
        "name": "Daemon Recovery Handoff",
        "description": "Restart a daemon, capture status/logs/health, and draft a short recovery handoff summary.",
        "category": "daemon",
        "builtIn": True,
        "recommended": True,
        "artifactRetentionDays": 21,
        "inputs": [
            {
                "key": "restartCommand",
                "label": "Restart Command",
                "description": "Command used to restart the daemon.",
                "required": True,
                "defaultValue": "",
            },
            {
                "key": "statusCommand",
                "label": "Status Command",
                "description": "Command used to inspect daemon state after restart.",
                "required": True,
                "defaultValue": "",
            },
            {
                "key": "healthCommand",
                "label": "Health Command",
                "description": "Command used to verify daemon health after restart.",
                "required": True,
                "defaultValue": "",
            },
            {
                "key": "logCommand",
                "label": "Log Command",
                "description": "Command used to capture recent daemon logs.",
                "required": True,
                "defaultValue": "",
            },
        ],
    },
]


def _now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _ensure_custom_templates_file() -> None:
    if not CUSTOM_TEMPLATES_PATH.exists():
        CUSTOM_TEMPLATES_PATH.write_text("[]\n", encoding="utf-8")


def _load_custom_templates() -> list[dict[str, Any]]:
    _ensure_custom_templates_file()
    try:
        payload = json.loads(CUSTOM_TEMPLATES_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []
    if not isinstance(payload, list):
        return []
    templates: list[dict[str, Any]] = []
    for item in payload:
        if isinstance(item, dict):
            normalized = dict(item)
            normalized["builtIn"] = False
            normalized["favorite"] = bool(normalized.get("favorite", False))
            normalized["recommended"] = bool(normalized.get("recommended", False))
            retention = normalized.get("artifactRetentionDays")
            if isinstance(retention, int):
                normalized["artifactRetentionDays"] = retention
            elif isinstance(retention, str) and retention.strip():
                normalized["artifactRetentionDays"] = int(retention)
            else:
                normalized["artifactRetentionDays"] = None
            templates.append(normalized)
    return templates


def _write_custom_templates(templates: list[dict[str, Any]]) -> None:
    payload: list[dict[str, Any]] = []
    for template in templates:
        if not isinstance(template, dict):
            continue
        item = dict(template)
        item.pop("builtIn", None)
        payload.append(item)
    CUSTOM_TEMPLATES_PATH.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def _normalize_template_id(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9_-]+", "_", value.strip().lower()).strip("_")
    if not normalized:
        raise ValueError("template id must contain letters or numbers")
    return normalized


def _normalize_inputs(raw_inputs: Any) -> list[dict[str, Any]]:
    if not isinstance(raw_inputs, list):
        return []
    inputs: list[dict[str, Any]] = []
    for item in raw_inputs:
        if not isinstance(item, dict):
            continue
        key = str(item.get("key") or "").strip()
        label = str(item.get("label") or key).strip()
        if not key:
            continue
        if any(existing["key"] == key for existing in inputs):
            raise ValueError(f"duplicate template input key: {key}")
        inputs.append(
            {
                "key": key,
                "label": label or key,
                "description": str(item.get("description") or "").strip() or None,
                "required": bool(item.get("required", False)),
                "defaultValue": str(item.get("defaultValue") or ""),
            }
        )
    return inputs


def list_templates() -> list[dict[str, Any]]:
    return [*BUILTIN_TEMPLATES, *_load_custom_templates()]


def get_template(template_id: str) -> dict[str, Any] | None:
    for template in list_templates():
        if template["id"] == template_id:
            return template
    return None


def list_builtin_templates() -> list[dict[str, Any]]:
    return BUILTIN_TEMPLATES


def list_custom_templates() -> list[dict[str, Any]]:
    return _load_custom_templates()


def list_template_versions(template_id: str) -> list[dict[str, Any]]:
    template = get_template(template_id)
    if not template:
        return []
    if template.get("builtIn", False):
        return [
            {
                "version": 1,
                "updatedAt": None,
                "name": template.get("name"),
                "description": template.get("description"),
                "workflowSpec": template.get("workflowSpec"),
                "builtIn": True,
            }
        ]
    history = template.get("history")
    versions = list(history) if isinstance(history, list) else []
    versions.append(
        {
            "version": template.get("version", 1),
            "updatedAt": template.get("updatedAt"),
            "name": template.get("name"),
            "description": template.get("description"),
            "workflowSpec": template.get("workflowSpec"),
            "builtIn": False,
        }
    )
    return versions


def diff_template_versions(template_id: str, from_version: int, to_version: int | None = None) -> dict[str, Any]:
    versions = list_template_versions(template_id)
    if not versions:
        raise ValueError(f"Unknown workflow template: {template_id}")
    left = next((item for item in versions if int(item.get("version", -1)) == int(from_version)), None)
    if left is None:
        raise ValueError(f"Template version not found: {from_version}")
    if to_version is None:
        right = versions[-1]
    else:
        right = next((item for item in versions if int(item.get("version", -1)) == int(to_version)), None)
        if right is None:
            raise ValueError(f"Template version not found: {to_version}")

    left_text = json.dumps(
        {
            "name": left.get("name"),
            "description": left.get("description"),
            "workflowSpec": left.get("workflowSpec"),
        },
        indent=2,
        sort_keys=True,
    ).splitlines()
    right_text = json.dumps(
        {
            "name": right.get("name"),
            "description": right.get("description"),
            "workflowSpec": right.get("workflowSpec"),
        },
        indent=2,
        sort_keys=True,
    ).splitlines()
    diff_lines = list(
        unified_diff(
            left_text,
            right_text,
            fromfile=f"{template_id}@v{left.get('version')}",
            tofile=f"{template_id}@v{right.get('version')}",
            lineterm="",
        )
    )
    return {
        "templateId": template_id,
        "fromVersion": int(left.get("version", from_version)),
        "toVersion": int(right.get("version", to_version or left.get("version", from_version))),
        "from": left,
        "to": right,
        "diff": "\n".join(diff_lines),
    }


def validate_custom_template(payload: dict[str, Any]) -> dict[str, Any]:
    template_id = _normalize_template_id(str(payload.get("id") or ""))
    name = str(payload.get("name") or "").strip()
    description = str(payload.get("description") or "").strip()
    category = str(payload.get("category") or "custom").strip() or "custom"
    workflow_spec = payload.get("workflowSpec")
    if not name:
        raise ValueError("template name is required")
    if not description:
        raise ValueError("template description is required")
    if not isinstance(workflow_spec, dict) or not workflow_spec:
        raise ValueError("workflowSpec must be a non-empty object")
    return {
        "id": template_id,
        "name": name,
        "description": description,
        "category": category,
        "favorite": bool(payload.get("favorite", False)),
        "recommended": bool(payload.get("recommended", False)),
        "artifactRetentionDays": int(payload.get("artifactRetentionDays")) if str(payload.get("artifactRetentionDays") or "").strip() else None,
        "inputs": _normalize_inputs(payload.get("inputs")),
        "workflowSpec": workflow_spec,
        "builtIn": False,
    }


def save_custom_template(payload: dict[str, Any]) -> dict[str, Any]:
    template = validate_custom_template(payload)
    existing = next((item for item in _load_custom_templates() if item.get("id") == template["id"]), None)
    version = int(existing.get("version", 1)) + 1 if isinstance(existing, dict) else 1
    created_at = str(existing.get("createdAt") or _now_iso()) if isinstance(existing, dict) else _now_iso()
    history = list(existing.get("history", [])) if isinstance(existing, dict) and isinstance(existing.get("history"), list) else []
    if isinstance(existing, dict):
        history.append(
            {
                "version": int(existing.get("version", 1)),
                "updatedAt": existing.get("updatedAt"),
                "name": existing.get("name"),
                "description": existing.get("description"),
                "workflowSpec": existing.get("workflowSpec"),
            }
        )
    template["version"] = version
    template["createdAt"] = created_at
    template["updatedAt"] = _now_iso()
    template["history"] = history[-20:]
    templates = [item for item in _load_custom_templates() if item.get("id") != template["id"]]
    templates.append(template)
    templates.sort(key=lambda item: str(item.get("name") or item.get("id") or ""))
    _write_custom_templates(templates)
    return template


def delete_custom_template(template_id: str) -> bool:
    templates = _load_custom_templates()
    remaining = [item for item in templates if item.get("id") != template_id]
    if len(remaining) == len(templates):
        return False
    _write_custom_templates(remaining)
    return True


def clone_custom_template(source_template_id: str, new_template_id: str | None = None, new_name: str | None = None) -> dict[str, Any]:
    source = get_template(source_template_id)
    if not source:
        raise ValueError(f"Unknown workflow template: {source_template_id}")
    cloned_id = _normalize_template_id(new_template_id or f"{source_template_id}_copy")
    payload = {
        "id": cloned_id,
        "name": (new_name or f"{source.get('name', source_template_id)} Copy").strip(),
        "description": str(source.get("description") or "").strip() or "Cloned workflow template",
        "category": str(source.get("category") or "custom"),
        "favorite": bool(source.get("favorite", False)),
        "recommended": False,
        "artifactRetentionDays": source.get("artifactRetentionDays"),
        "inputs": deepcopy(source.get("inputs", [])) if isinstance(source.get("inputs"), list) else [],
        "workflowSpec": deepcopy(source.get("workflowSpec") or resolve_template(source_template_id, {})[0]),
    }
    return save_custom_template(payload)


def restore_template_version(template_id: str, version: int) -> dict[str, Any]:
    template = get_template(template_id)
    if not template or template.get("builtIn", False):
        raise ValueError("Only custom templates can be restored")
    versions = list_template_versions(template_id)
    match = next((item for item in versions if int(item.get("version", -1)) == int(version)), None)
    if not match:
        raise ValueError(f"Template version not found: {version}")
    return save_custom_template(
        {
            "id": template_id,
            "name": str(match.get("name") or template.get("name") or template_id),
            "description": str(match.get("description") or template.get("description") or ""),
            "category": str(template.get("category") or "custom"),
            "favorite": bool(template.get("favorite", False)),
            "recommended": bool(template.get("recommended", False)),
            "artifactRetentionDays": template.get("artifactRetentionDays"),
            "inputs": deepcopy(template.get("inputs", [])) if isinstance(template.get("inputs"), list) else [],
            "workflowSpec": deepcopy(match.get("workflowSpec") or template.get("workflowSpec")),
        }
    )


def normalize_template_inputs(template: dict[str, Any], raw_inputs: dict[str, Any] | None) -> dict[str, str]:
    inputs = raw_inputs if isinstance(raw_inputs, dict) else {}
    resolved: dict[str, str] = {}
    for definition in template.get("inputs", []):
        if not isinstance(definition, dict):
            continue
        key = str(definition.get("key") or "").strip()
        if not key:
            continue
        value = inputs.get(key, definition.get("defaultValue", ""))
        normalized_value = str(value).strip()
        if bool(definition.get("required", False)) and not normalized_value:
            raise ValueError(f"Missing required template input: {key}")
        resolved[key] = normalized_value
    return resolved


def resolve_template(template_id: str, raw_inputs: dict[str, Any] | None = None) -> tuple[dict[str, Any], dict[str, str]]:
    template = get_template(template_id)
    if not template:
        raise ValueError(f"Unknown workflow template: {template_id}")
    inputs = normalize_template_inputs(template, raw_inputs)

    if not template.get("builtIn", False):
        workflow_spec = template.get("workflowSpec")
        if not isinstance(workflow_spec, dict) or not workflow_spec:
            raise ValueError(f"Custom template {template_id} has no workflowSpec")
        return workflow_spec, inputs

    if template_id == "open_command_page":
        url = inputs.get("url") or "http://localhost:3000/command"
        return {
            "steps": [
                {
                    "id": "open_command",
                    "name": "Open command page",
                    "type": "steer",
                    "command": "open-url",
                    "args": ["--app", "Safari", "--url", url],
                }
            ]
        }, inputs

    if template_id == "recover_command_page":
        url = inputs.get("url") or "http://localhost:3000/command"
        return {
            "steps": [
                {
                    "id": "open_command",
                    "name": "Open command page",
                    "type": "steer",
                    "command": "open-url",
                    "args": ["--app", "Safari", "--url", url],
                },
                {
                    "id": "wait_reload",
                    "name": "Wait for reload UI",
                    "type": "steer",
                    "command": "wait",
                    "args": ["ui", "--app", "Safari", "--name", "Reload this page", "--role", "button", "--timeout", "8", "--interval", "0.75"],
                },
                {
                    "id": "click_reload",
                    "name": "Click reload",
                    "type": "steer",
                    "command": "ui",
                    "args": ["click", "--app", "Safari", "--name", "Reload this page", "--role", "button"],
                    "onFailure": "continue",
                },
                {
                    "id": "wait_command",
                    "name": "Wait for command URL",
                    "type": "steer",
                    "command": "wait",
                    "args": ["url", "--url", "/command", "--contains", "--timeout", "12", "--interval", "0.75"],
                },
            ]
        }, inputs

    if template_id == "repo_status_check":
        repo_path = inputs.get("repoPath") or str(REPO_ROOT)
        return {
            "steps": [
                {
                    "id": "repo_status",
                    "name": "Collect git status",
                    "type": "shell",
                    "prompt": f"cd {repo_path} && git status --short",
                }
            ]
        }, inputs

    if template_id == "browser_snapshot_review":
        url = inputs.get("url") or "http://localhost:3000/command"
        expected = inputs.get("expected") or "/command"
        return {
            "steps": [
                {
                    "id": "open_page",
                    "name": "Open review page",
                    "type": "steer",
                    "command": "open-url",
                    "args": ["--app", "Safari", "--url", url],
                },
                {
                    "id": "wait_page",
                    "name": "Wait for page URL",
                    "type": "steer",
                    "command": "wait",
                    "args": ["url", "--url", expected, "--contains", "--timeout", "12", "--interval", "0.75"],
                },
                {
                    "id": "capture_window",
                    "name": "Capture Safari window",
                    "type": "steer",
                    "command": "see",
                    "args": ["--app", "Safari", "--window"],
                },
                {
                    "id": "ocr_window",
                    "name": "OCR Safari window",
                    "type": "steer",
                    "command": "ocr",
                    "args": ["--app", "Safari", "--window", "--store"],
                },
            ]
        }, inputs

    if template_id == "operator_handoff_note":
        title = inputs.get("title") or "Operator Handoff"
        text = inputs.get("text") or "Operator handoff:\n- Context:\n- Next action:\n- Risks:"
        return {
            "steps": [
                {
                    "id": "handoff_note",
                    "name": "Create handoff note",
                    "type": "steer",
                    "command": "notes",
                    "args": ["create", "--title", title, "--body", text],
                }
            ]
        }, inputs

    if template_id == "agent_brief":
        agent = inputs.get("agent") or "main"
        prompt = inputs.get("prompt") or "Summarize the current operational state in 3 bullets."
        return {
            "steps": [
                {
                    "id": "agent_brief",
                    "name": "Run agent brief",
                    "type": "agent",
                    "targetAgent": agent,
                    "prompt": prompt,
                }
            ]
        }, inputs

    if template_id == "repo_test_build":
        repo_path = inputs.get("repoPath") or str(REPO_ROOT)
        test_command = inputs.get("testCommand") or "npm run dashboard:test"
        build_command = inputs.get("buildCommand") or "npm run dashboard:build"
        return {
            "steps": [
                {
                    "id": "repo_test",
                    "name": "Run test command",
                    "type": "shell",
                    "prompt": f"cd {repo_path} && {test_command}",
                },
                {
                    "id": "repo_build",
                    "name": "Run build command",
                    "type": "shell",
                    "prompt": f"cd {repo_path} && {build_command}",
                },
            ]
        }, inputs

    if template_id == "dashboard_health_check":
        url = inputs.get("url") or "http://localhost:3000/command"
        health_url = inputs.get("healthUrl") or "http://localhost:3000/api/health"
        return {
            "steps": [
                {
                    "id": "open_dashboard",
                    "name": "Open dashboard page",
                    "type": "steer",
                    "command": "open-url",
                    "args": ["--app", "Safari", "--url", url],
                },
                {
                    "id": "wait_dashboard",
                    "name": "Wait for dashboard URL",
                    "type": "steer",
                    "command": "wait",
                    "args": ["url", "--url", "/command", "--contains", "--timeout", "12", "--interval", "0.75"],
                },
                {
                    "id": "health_json",
                    "name": "Fetch health JSON",
                    "type": "shell",
                    "prompt": f"curl -fsSL {health_url}",
                },
                {
                    "id": "snapshot_dashboard",
                    "name": "Capture dashboard window",
                    "type": "steer",
                    "command": "see",
                    "args": ["--app", "Safari", "--window"],
                },
            ]
        }, inputs

    if template_id == "incident_capture":
        url = inputs.get("url") or "http://localhost:3000/command"
        note_text = inputs.get("noteText") or "Incident capture:\n- Symptom:\n- Evidence:\n- Next action:"
        return {
            "steps": [
                {
                    "id": "open_incident_page",
                    "name": "Open incident page",
                    "type": "steer",
                    "command": "open-url",
                    "args": ["--app", "Safari", "--url", url],
                },
                {
                    "id": "capture_incident_window",
                    "name": "Capture incident window",
                    "type": "steer",
                    "command": "see",
                    "args": ["--app", "Safari", "--window"],
                },
                {
                    "id": "ocr_incident_window",
                    "name": "OCR incident window",
                    "type": "steer",
                    "command": "ocr",
                    "args": ["--app", "Safari", "--window", "--store"],
                },
                {
                    "id": "draft_incident_note",
                    "name": "Draft incident handoff note",
                    "type": "steer",
                    "command": "textedit",
                    "args": ["new", "--text", note_text],
                },
            ]
        }, inputs

    if template_id == "repo_browser_loop":
        repo_path = inputs.get("repoPath") or str(REPO_ROOT)
        url = inputs.get("url") or "http://localhost:3000/command"
        return {
            "steps": [
                {
                    "id": "repo_status_loop",
                    "name": "Collect repo status",
                    "type": "shell",
                    "prompt": f"cd {repo_path} && git status --short",
                },
                {
                    "id": "open_repo_context",
                    "name": "Open browser context",
                    "type": "steer",
                    "command": "open-url",
                    "args": ["--app", "Safari", "--url", url],
                },
                {
                    "id": "ocr_repo_context",
                    "name": "OCR browser context",
                    "type": "steer",
                    "command": "ocr",
                    "args": ["--app", "Safari", "--window", "--store"],
                },
            ]
        }, inputs

    if template_id == "listen_restart_health_check":
        listen_command = inputs.get("listenCommand") or "python3 apps/listen/listen_server.py --host 127.0.0.1 --port 7600"
        health_url = inputs.get("healthUrl") or "http://127.0.0.1:7600/policy"
        return {
            "steps": [
                {
                    "id": "restart_listen",
                    "name": "Restart listen server",
                    "type": "shell",
                    "dangerous": True,
                    "prompt": f"pkill -f 'apps/listen/listen_server.py' || true; cd {REPO_ROOT} && nohup {listen_command} >/tmp/openclaw-listen.log 2>&1 &",
                },
                {
                    "id": "wait_listen_health",
                    "name": "Fetch listen health",
                    "type": "shell",
                    "prompt": f"curl -fsSL {health_url}",
                },
            ]
        }, inputs

    if template_id == "repo_repair_loop":
        repo_path = inputs.get("repoPath") or str(REPO_ROOT)
        test_command = inputs.get("testCommand") or "npm run dashboard:test"
        return {
            "steps": [
                {
                    "id": "repo_status_repair",
                    "name": "Inspect repo status",
                    "type": "shell",
                    "prompt": f"cd {repo_path} && git status --short",
                },
                {
                    "id": "repo_tests_repair",
                    "name": "Run repo tests",
                    "type": "shell",
                    "prompt": f"cd {repo_path} && {test_command}",
                },
                {
                    "id": "repo_repair_brief",
                    "name": "Draft repair brief",
                    "type": "agent",
                    "targetAgent": "dev",
                    "prompt": f"Review the repo state for {repo_path} and propose the smallest repair plan after running `{test_command}`.",
                },
            ]
        }, inputs

    if template_id == "dashboard_audit":
        url = inputs.get("url") or "http://localhost:3000/command"
        return {
            "steps": [
                {
                    "id": "open_dashboard_audit",
                    "name": "Open dashboard audit page",
                    "type": "steer",
                    "command": "open-url",
                    "args": ["--app", "Safari", "--url", url],
                },
                {
                    "id": "wait_dashboard_audit",
                    "name": "Wait for dashboard page",
                    "type": "steer",
                    "command": "wait",
                    "args": ["url", "--url", "/command", "--contains", "--timeout", "12", "--interval", "0.75"],
                },
                {
                    "id": "see_dashboard_audit",
                    "name": "Capture dashboard screenshot",
                    "type": "steer",
                    "command": "see",
                    "args": ["--app", "Safari", "--window"],
                },
                {
                    "id": "ocr_dashboard_audit",
                    "name": "Capture dashboard OCR",
                    "type": "steer",
                    "command": "ocr",
                    "args": ["--app", "Safari", "--window", "--store"],
                },
            ]
        }, inputs

    if template_id == "browser_auth_recovery":
        url = inputs.get("url") or "http://localhost:3000/command"
        return {
            "steps": [
                {
                    "id": "open_browser_recovery",
                    "name": "Open target browser page",
                    "type": "steer",
                    "command": "open-url",
                    "args": ["--app", "Safari", "--url", url],
                },
                {
                    "id": "wait_browser_reload",
                    "name": "Wait for browser recovery UI",
                    "type": "steer",
                    "command": "wait",
                    "args": ["ui", "--app", "Safari", "--name", "Reload this page", "--role", "button", "--timeout", "8", "--interval", "0.75"],
                    "onFailure": "continue",
                },
                {
                    "id": "click_browser_reload",
                    "name": "Attempt browser reload",
                    "type": "steer",
                    "command": "ui",
                    "args": ["click", "--app", "Safari", "--name", "Reload this page", "--role", "button"],
                    "onFailure": "continue",
                },
                {
                    "id": "snapshot_browser_recovery",
                    "name": "Capture browser recovery state",
                    "type": "steer",
                    "command": "see",
                    "args": ["--app", "Safari", "--window"],
                },
                {
                    "id": "ocr_browser_recovery",
                    "name": "OCR browser recovery state",
                    "type": "steer",
                    "command": "ocr",
                    "args": ["--app", "Safari", "--window", "--store"],
                },
            ]
        }, inputs

    if template_id == "daemon_restart_verify_bundle":
        restart_command = inputs.get("restartCommand") or ""
        health_command = inputs.get("healthCommand") or ""
        return {
            "steps": [
                {
                    "id": "daemon_restart",
                    "name": "Restart daemon",
                    "type": "shell",
                    "dangerous": True,
                    "prompt": restart_command,
                },
                {
                    "id": "daemon_health",
                    "name": "Verify daemon health",
                    "type": "shell",
                    "prompt": health_command,
                },
                {
                    "id": "daemon_process_snapshot",
                    "name": "Capture process snapshot",
                    "type": "drive",
                    "command": "proc",
                    "args": ["list", "--json"],
                },
            ]
        }, inputs

    if template_id == "operator_handoff_bundle":
        url = inputs.get("url") or "http://localhost:3000/command"
        note_text = inputs.get("noteText") or "Operator handoff:\n- Context:\n- Evidence:\n- Next action:\n- Risks:"
        return {
            "steps": [
                {
                    "id": "open_handoff_context",
                    "name": "Open handoff context",
                    "type": "steer",
                    "command": "open-url",
                    "args": ["--app", "Safari", "--url", url],
                },
                {
                    "id": "capture_handoff_context",
                    "name": "Capture handoff screenshot",
                    "type": "steer",
                    "command": "see",
                    "args": ["--app", "Safari", "--window"],
                },
                {
                    "id": "ocr_handoff_context",
                    "name": "Capture handoff OCR",
                    "type": "steer",
                    "command": "ocr",
                    "args": ["--app", "Safari", "--window", "--store"],
                },
                {
                    "id": "draft_handoff_bundle_note",
                    "name": "Draft handoff note",
                    "type": "steer",
                    "command": "notes",
                    "args": [
                        "create",
                        "--title",
                        "Operator Handoff Bundle",
                        "--body",
                        f"{note_text}\n\nEvidence:\n- Screenshot: {{{{steps.capture_handoff_context.result.screenshot}}}}\n- OCR image: {{{{steps.ocr_handoff_context.result.image}}}}",
                    ],
                },
            ]
        }, inputs

    if template_id == "repo_release_readiness":
        repo_path = inputs.get("repoPath") or str(REPO_ROOT)
        test_command = inputs.get("testCommand") or "npm run dashboard:test"
        build_command = inputs.get("buildCommand") or "npm run dashboard:build"
        return {
            "steps": [
                {
                    "id": "repo_release_branch",
                    "name": "Capture branch state",
                    "type": "shell",
                    "prompt": f"cd {repo_path} && git branch --show-current && git status --short && git log --oneline -5",
                },
                {
                    "id": "repo_release_test",
                    "name": "Run release validation tests",
                    "type": "shell",
                    "prompt": f"cd {repo_path} && {test_command}",
                },
                {
                    "id": "repo_release_build",
                    "name": "Run release validation build",
                    "type": "shell",
                    "prompt": f"cd {repo_path} && {build_command}",
                },
                {
                    "id": "repo_release_summary",
                    "name": "Draft release summary",
                    "type": "agent",
                    "targetAgent": "dev",
                    "prompt": f"Summarize release readiness for {repo_path} after `{test_command}` and `{build_command}`. Call out blockers and next actions.",
                },
            ]
        }, inputs

    if template_id == "dashboard_jobs_triage":
        url = inputs.get("url") or "http://localhost:3000/command"
        jobs_url = inputs.get("jobsUrl") or "http://localhost:3000/api/jobs"
        return {
            "steps": [
                {
                    "id": "open_jobs_triage_page",
                    "name": "Open dashboard jobs page",
                    "type": "steer",
                    "command": "open-url",
                    "args": ["--app", "Safari", "--url", url],
                },
                {
                    "id": "wait_jobs_triage_page",
                    "name": "Wait for dashboard jobs page",
                    "type": "steer",
                    "command": "wait",
                    "args": ["url", "--url", "/command", "--contains", "--timeout", "12", "--interval", "0.75"],
                },
                {
                    "id": "fetch_jobs_triage_api",
                    "name": "Fetch jobs API payload",
                    "type": "shell",
                    "prompt": f"curl -fsSL {jobs_url}",
                },
                {
                    "id": "capture_jobs_triage_window",
                    "name": "Capture jobs triage screenshot",
                    "type": "steer",
                    "command": "see",
                    "args": ["--app", "Safari", "--window"],
                },
                {
                    "id": "ocr_jobs_triage_window",
                    "name": "OCR jobs triage screenshot",
                    "type": "steer",
                    "command": "ocr",
                    "args": ["--app", "Safari", "--window", "--store"],
                },
            ]
        }, inputs

    if template_id == "browser_login_snapshot":
        url = inputs.get("url") or ""
        expected_text = inputs.get("expectedText") or ""
        return {
            "steps": [
                {
                    "id": "open_login_page",
                    "name": "Open login page",
                    "type": "steer",
                    "command": "open-url",
                    "args": ["--app", "Safari", "--url", url],
                },
                {
                    "id": "wait_login_text",
                    "name": "Wait for expected login text",
                    "type": "steer",
                    "command": "wait",
                    "args": ["text", "--app", "Safari", "--window", "--text", expected_text, "--contains", "--timeout", "15", "--interval", "0.75"],
                },
                {
                    "id": "capture_login_page",
                    "name": "Capture login page",
                    "type": "steer",
                    "command": "see",
                    "args": ["--app", "Safari", "--window"],
                },
                {
                    "id": "ocr_login_page",
                    "name": "OCR login page",
                    "type": "steer",
                    "command": "ocr",
                    "args": ["--app", "Safari", "--window", "--store"],
                },
            ]
        }, inputs

    if template_id == "daemon_logs_bundle":
        status_command = inputs.get("statusCommand") or "ps aux | grep listen_server.py"
        log_command = inputs.get("logCommand") or "tail -n 80 apps/listen/jobs/*.json 2>/dev/null || true"
        health_url = inputs.get("healthUrl") or "http://127.0.0.1:7600/metrics"
        return {
            "steps": [
                {
                    "id": "daemon_status_capture",
                    "name": "Capture daemon status",
                    "type": "shell",
                    "prompt": status_command,
                },
                {
                    "id": "daemon_log_capture",
                    "name": "Capture daemon logs",
                    "type": "shell",
                    "prompt": log_command,
                },
                {
                    "id": "daemon_metric_probe",
                    "name": "Probe daemon health endpoint",
                    "type": "shell",
                    "prompt": f"curl -fsSL {health_url}",
                },
                {
                    "id": "daemon_log_summary",
                    "name": "Draft daemon incident summary",
                    "type": "agent",
                    "targetAgent": "main",
                    "prompt": f"Summarize daemon health and likely operator actions after `{status_command}` and `{log_command}`.",
                },
            ]
        }, inputs

    if template_id == "repo_change_review":
        repo_path = inputs.get("repoPath") or str(REPO_ROOT)
        test_command = inputs.get("testCommand") or "npm run dashboard:test"
        return {
            "steps": [
                {
                    "id": "repo_change_status",
                    "name": "Capture repo change status",
                    "type": "shell",
                    "prompt": f"cd {repo_path} && git status --short && git diff --stat",
                },
                {
                    "id": "repo_change_history",
                    "name": "Capture recent history",
                    "type": "shell",
                    "prompt": f"cd {repo_path} && git log --oneline -8",
                },
                {
                    "id": "repo_change_test",
                    "name": "Run targeted validation",
                    "type": "shell",
                    "prompt": f"cd {repo_path} && {test_command}",
                },
                {
                    "id": "repo_change_review_summary",
                    "name": "Draft change review summary",
                    "type": "agent",
                    "targetAgent": "dev",
                    "prompt": f"Summarize the code change state for {repo_path} after `git diff --stat` and `{test_command}`. Highlight risks and next actions.",
                },
            ]
        }, inputs

    if template_id == "dashboard_policy_audit":
        url = inputs.get("url") or "http://localhost:3000/command"
        policy_url = inputs.get("policyUrl") or "http://localhost:3000/api/jobs/policy/admin"
        metrics_url = inputs.get("metricsUrl") or "http://localhost:3000/api/jobs/metrics"
        return {
            "steps": [
                {
                    "id": "open_dashboard_policy_audit",
                    "name": "Open dashboard page",
                    "type": "steer",
                    "command": "open-url",
                    "args": ["--app", "Safari", "--url", url],
                },
                {
                    "id": "wait_dashboard_policy_audit",
                    "name": "Wait for dashboard page",
                    "type": "steer",
                    "command": "wait",
                    "args": ["url", "--url", "/command", "--contains", "--timeout", "12", "--interval", "0.75"],
                },
                {
                    "id": "fetch_policy_admin",
                    "name": "Fetch policy admin payload",
                    "type": "shell",
                    "prompt": f"curl -fsSL {policy_url}",
                },
                {
                    "id": "fetch_metrics_admin",
                    "name": "Fetch metrics payload",
                    "type": "shell",
                    "prompt": f"curl -fsSL {metrics_url}",
                },
                {
                    "id": "capture_dashboard_policy",
                    "name": "Capture dashboard screenshot",
                    "type": "steer",
                    "command": "see",
                    "args": ["--app", "Safari", "--window"],
                },
                {
                    "id": "ocr_dashboard_policy",
                    "name": "OCR dashboard screenshot",
                    "type": "steer",
                    "command": "ocr",
                    "args": ["--app", "Safari", "--window", "--store"],
                },
            ]
        }, inputs

    if template_id == "browser_recovery_handoff":
        url = inputs.get("url") or "http://localhost:3000/command"
        expected_text = inputs.get("expectedText") or ""
        note_text = inputs.get("noteText") or "Browser recovery handoff:\n- Context:\n- Current page state:\n- Next action:"
        wait_args = ["text", "--app", "Safari", "--window", "--text", expected_text, "--contains", "--timeout", "10", "--interval", "0.75"] if expected_text else ["ui", "--app", "Safari", "--name", "Reload this page", "--role", "button", "--timeout", "8", "--interval", "0.75"]
        return {
            "steps": [
                {
                    "id": "open_browser_handoff",
                    "name": "Open browser page",
                    "type": "steer",
                    "command": "open-url",
                    "args": ["--app", "Safari", "--url", url],
                },
                {
                    "id": "wait_browser_handoff",
                    "name": "Wait for browser signal",
                    "type": "steer",
                    "command": "wait",
                    "args": wait_args,
                    "onFailure": "continue",
                },
                {
                    "id": "capture_browser_handoff",
                    "name": "Capture browser screenshot",
                    "type": "steer",
                    "command": "see",
                    "args": ["--app", "Safari", "--window"],
                },
                {
                    "id": "ocr_browser_handoff",
                    "name": "OCR browser screenshot",
                    "type": "steer",
                    "command": "ocr",
                    "args": ["--app", "Safari", "--window", "--store"],
                },
                {
                    "id": "draft_browser_handoff",
                    "name": "Draft browser handoff note",
                    "type": "steer",
                    "command": "notes",
                    "args": [
                        "create",
                        "--title",
                        "Browser Recovery Handoff",
                        "--body",
                        f"{note_text}\n\nEvidence:\n- Screenshot: {{{{steps.capture_browser_handoff.result.screenshot}}}}\n- OCR image: {{{{steps.ocr_browser_handoff.result.image}}}}",
                    ],
                },
            ]
        }, inputs

    if template_id == "daemon_recovery_handoff":
        restart_command = inputs.get("restartCommand") or ""
        status_command = inputs.get("statusCommand") or ""
        health_command = inputs.get("healthCommand") or ""
        log_command = inputs.get("logCommand") or ""
        return {
            "steps": [
                {
                    "id": "daemon_handoff_restart",
                    "name": "Restart daemon",
                    "type": "shell",
                    "dangerous": True,
                    "prompt": restart_command,
                },
                {
                    "id": "daemon_handoff_status",
                    "name": "Capture daemon status",
                    "type": "shell",
                    "prompt": status_command,
                },
                {
                    "id": "daemon_handoff_health",
                    "name": "Verify daemon health",
                    "type": "shell",
                    "prompt": health_command,
                },
                {
                    "id": "daemon_handoff_logs",
                    "name": "Capture daemon logs",
                    "type": "shell",
                    "prompt": log_command,
                },
                {
                    "id": "daemon_handoff_summary",
                    "name": "Draft recovery handoff summary",
                    "type": "agent",
                    "targetAgent": "main",
                    "prompt": f"Summarize the daemon recovery state after `{restart_command}`, `{status_command}`, `{health_command}`, and `{log_command}`. Include the next operator action.",
                },
            ]
        }, inputs

    raise ValueError(f"Unknown workflow template: {template_id}")
