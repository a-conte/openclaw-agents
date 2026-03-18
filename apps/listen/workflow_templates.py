from __future__ import annotations

from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[2]


TEMPLATES: list[dict[str, Any]] = [
    {
        "id": "open_command_page",
        "name": "Open Command Page",
        "description": "Open the local Mission Control command page in Safari.",
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


def list_templates() -> list[dict[str, Any]]:
    return TEMPLATES


def get_template(template_id: str) -> dict[str, Any] | None:
    for template in TEMPLATES:
        if template["id"] == template_id:
            return template
    return None


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
                    "name": "Generate brief",
                    "type": "agent",
                    "targetAgent": agent,
                    "prompt": prompt,
                }
            ]
        }, inputs

    raise ValueError(f"Unknown workflow template: {template_id}")
