from __future__ import annotations

import json
import re
import time
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
        "description": "Create a TextEdit note for operator handoff or escalation.",
        "category": "operator",
        "builtIn": True,
        "inputs": [
            {
                "key": "text",
                "label": "Note Text",
                "description": "Contents of the TextEdit note.",
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
        resolved[key] = str(value).strip()
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
        text = inputs.get("text") or "Operator handoff:\n- Context:\n- Next action:\n- Risks:"
        return {
            "steps": [
                {
                    "id": "handoff_note",
                    "name": "Create handoff note",
                    "type": "steer",
                    "command": "textedit",
                    "args": ["new", "--text", text],
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

    raise ValueError(f"Unknown workflow template: {template_id}")
