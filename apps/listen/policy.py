from __future__ import annotations

import os
from typing import Any


def _env_flag(name: str, default: bool = False) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _env_list(name: str) -> list[str]:
    value = os.environ.get(name, "")
    return [item.strip() for item in value.split(",") if item.strip()]


def current_policy() -> dict[str, Any]:
    return {
        "version": 1,
        "allowDangerous": _env_flag("OPENCLAW_LISTEN_ALLOW_DANGEROUS", default=False),
        "allowedSteerCommands": _env_list("OPENCLAW_LISTEN_ALLOWED_STEER_COMMANDS"),
        "allowedDriveCommands": _env_list("OPENCLAW_LISTEN_ALLOWED_DRIVE_COMMANDS"),
        "allowedWorkflows": _env_list("OPENCLAW_LISTEN_ALLOWED_WORKFLOWS"),
    }


def normalize_command_key(mode: str, command: str, args: list[str]) -> str:
    base = command.strip()
    first_non_flag = next((item for item in args if item and not item.startswith("-")), "")
    if base == "click" and "--right" in args:
        return "click.right"
    if first_non_flag:
        return f"{base}.{first_non_flag}"
    return base


def top_level_dangerous(mode: str, command: str, args: list[str]) -> bool:
    key = normalize_command_key(mode, command, args)
    return key in {"proc.kill", "session.kill", "window.close", "click.right"}


def check_command_policy(mode: str, command: str, args: list[str], dangerous: bool = False) -> tuple[bool, str | None]:
    policy = current_policy()
    key = normalize_command_key(mode, command, args)
    allowed = policy["allowedSteerCommands"] if mode == "steer" else policy["allowedDriveCommands"]
    if allowed and key not in allowed and command not in allowed:
        return False, f"{mode} command blocked by policy: {key}"
    if (dangerous or top_level_dangerous(mode, command, args)) and not policy["allowDangerous"]:
        return False, f"{mode} command requires OPENCLAW_LISTEN_ALLOW_DANGEROUS=true: {key}"
    return True, None


def check_workflow_policy(workflow: str | None) -> tuple[bool, str | None]:
    policy = current_policy()
    allowed = policy["allowedWorkflows"]
    if workflow and allowed and workflow not in allowed:
        return False, f"workflow blocked by policy: {workflow}"
    return True, None


def check_step_policy(step: dict[str, Any]) -> tuple[bool, str | None]:
    step_type = str(step.get("type", "")).strip()
    dangerous = bool(step.get("dangerous", False))
    if step_type in {"steer", "drive"}:
        command = str(step.get("command", "")).strip()
        args = [str(item) for item in step.get("args", []) if str(item).strip()]
        return check_command_policy(step_type, command, args, dangerous=dangerous)
    if step_type == "wait":
        run = step.get("run")
        if isinstance(run, dict):
            return check_step_policy(run)
    if dangerous and not current_policy()["allowDangerous"]:
        return False, f"{step_type} step requires OPENCLAW_LISTEN_ALLOW_DANGEROUS=true"
    return True, None
