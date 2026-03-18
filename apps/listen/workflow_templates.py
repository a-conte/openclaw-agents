from __future__ import annotations

import json
import re
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
]


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

    raise ValueError(f"Unknown workflow template: {template_id}")
