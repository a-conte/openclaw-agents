#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import time
from copy import deepcopy
from pathlib import Path
from typing import Any

from artifacts import copy_file_artifact, write_json_artifact, write_text_artifact
from notifications import emit_job_notification, record_notification_delivery
from policy import check_command_policy, check_step_policy, check_workflow_policy, current_policy
from workflow_templates import resolve_template


REPO_ROOT = Path(__file__).resolve().parents[2]
JOBS_DIR = Path(__file__).resolve().parent / "jobs"


class PolicyError(RuntimeError):
    pass


def now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def read_job(job_id: str) -> dict[str, Any]:
    return json.loads((JOBS_DIR / f"{job_id}.json").read_text(encoding="utf-8"))


def write_job(job_id: str, payload: dict[str, Any]) -> None:
    (JOBS_DIR / f"{job_id}.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")


def append_update(job: dict[str, Any], message: str, *, level: str = "info", step_id: str | None = None) -> None:
    updates = job.setdefault("updates", [])
    if isinstance(updates, list):
        entry: dict[str, Any] = {"at": now_iso(), "message": message, "level": level}
        if step_id:
            entry["stepId"] = step_id
        updates.append(entry)
    job["updatedAt"] = now_iso()


def persist_job(job_id: str, job: dict[str, Any]) -> None:
    write_job(job_id, job)


def set_step_state(
    job: dict[str, Any],
    step_id: str,
    *,
    name: str,
    step_type: str,
    status: str,
    result: Any = None,
    error: str | None = None,
    artifacts: dict[str, Any] | None = None,
    dangerous: bool = False,
    started_at: str | None = None,
    completed_at: str | None = None,
    duration_ms: int | None = None,
) -> None:
    steps = job.setdefault("stepStatus", [])
    if not isinstance(steps, list):
        steps = []
        job["stepStatus"] = steps
    existing = next((item for item in steps if item.get("id") == step_id), None)
    payload = existing if isinstance(existing, dict) else {}
    payload.update(
        {
            "id": step_id,
            "name": name,
            "type": step_type,
            "status": status,
            "dangerous": dangerous,
        }
    )
    if status == "running":
        payload.pop("completedAt", None)
        payload.pop("durationMs", None)
        payload.pop("result", None)
        payload.pop("error", None)
        payload.pop("artifacts", None)
    if started_at:
        payload["startedAt"] = started_at
    if completed_at:
        payload["completedAt"] = completed_at
    if duration_ms is not None:
        payload["durationMs"] = duration_ms
    if result is not None:
        payload["result"] = result
    if error:
        payload["error"] = error
    if artifacts:
        payload["artifacts"] = artifacts
    if existing is None:
        steps.append(payload)
    job["currentStepId"] = None if status in {"completed", "failed", "skipped"} else step_id


def run_drive(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(REPO_ROOT / "apps" / "drive" / "drive_cli.py"), *args],
        text=True,
        capture_output=True,
        cwd=str(REPO_ROOT),
        check=False,
    )


def run_steer(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(REPO_ROOT / "apps" / "steer" / "steer_cli.py"), *args],
        text=True,
        capture_output=True,
        cwd=str(REPO_ROOT),
        check=False,
    )


def run_openclaw_agent(target_agent: str, prompt: str, thinking: str | None, local: bool) -> subprocess.CompletedProcess[str]:
    args = ["openclaw", "agent", "--agent", target_agent, "--message", prompt, "--json"]
    if thinking:
        args.extend(["--thinking", thinking])
    if local:
        args.append("--local")
    return subprocess.run(args, text=True, capture_output=True, cwd=str(REPO_ROOT), check=False)


def parse_json_result(result: subprocess.CompletedProcess[str]) -> tuple[bool, Any]:
    try:
        payload = json.loads(result.stdout)
    except json.JSONDecodeError:
        payload = None
    ok = result.returncode == 0 and payload is not None and payload.get("ok", True) is not False if isinstance(payload, dict) else result.returncode == 0 and payload is not None
    return ok, payload


def structured_process_failure(result: subprocess.CompletedProcess[str], fallback: str) -> dict[str, Any]:
    stdout = result.stdout.strip()
    stderr = result.stderr.strip()
    return {
        "ok": False,
        "error": stderr or stdout or fallback,
        "stdout": stdout,
        "stderr": stderr,
        "exitCode": result.returncode,
    }


def require_arg(cmd_args: list[str], index: int, message: str) -> str:
    if len(cmd_args) <= index or not cmd_args[index].strip():
        raise ValueError(message)
    return cmd_args[index].strip()


def compact_text(value: Any, limit: int = 1200) -> str | None:
    if not isinstance(value, str):
        return None
    text = value.strip()
    if not text:
        return None
    if len(text) <= limit:
        return text
    return f"{text[:limit].rstrip()}…"


def extract_step_artifacts(job_id: str, step_id: str, result: Any) -> dict[str, Any]:
    if not isinstance(result, dict):
        return {}

    artifacts: dict[str, Any] = {}
    for key in ("output", "stdout", "stderr", "rawOutput"):
        value = result.get(key)
        if isinstance(value, str) and value.strip():
            artifacts[key] = write_text_artifact(
                job_id,
                step_id,
                f"{key}.txt",
                value,
                preview=compact_text(value),
            )

    for key in ("session", "snapshotId", "match"):
        value = compact_text(result.get(key))
        if value is not None:
            artifacts[key] = value

    exit_code = result.get("exitCode")
    if isinstance(exit_code, int):
        artifacts["exitCode"] = exit_code

    token = compact_text(result.get("token"), 120)
    if token is not None:
        artifacts["token"] = token

    for key in ("screenshot", "image", "snapshotPath", "path"):
        source = result.get(key)
        preview = compact_text(source, 240)
        if isinstance(source, str) and source.strip():
            copied = copy_file_artifact(job_id, step_id, source, preview=preview)
            artifacts[key] = copied or {"kind": "missing-file", "sourcePath": source, "preview": preview}

    clicked = result.get("clicked")
    if isinstance(clicked, dict):
        filtered = {key: value for key, value in clicked.items() if isinstance(value, (str, int, float, bool))}
        if filtered:
            artifacts["clicked"] = write_json_artifact(
                job_id,
                step_id,
                "clicked.json",
                filtered,
                preview=compact_text(json.dumps(filtered, sort_keys=True), 240),
            )

    target = result.get("target")
    if isinstance(target, dict):
        filtered = {key: value for key, value in target.items() if isinstance(value, (str, int, float, bool))}
        if filtered:
            artifacts["target"] = write_json_artifact(
                job_id,
                step_id,
                "target.json",
                filtered,
                preview=compact_text(json.dumps(filtered, sort_keys=True), 240),
            )

    matches = result.get("matches")
    if isinstance(matches, list) and matches:
        summarized: list[dict[str, Any]] = []
        for match in matches[:5]:
            if not isinstance(match, dict):
                continue
            entry: dict[str, Any] = {}
            text = compact_text(match.get("text"), 160)
            if text is not None:
                entry["text"] = text
            confidence = match.get("confidence")
            if isinstance(confidence, (int, float)):
                entry["confidence"] = float(confidence)
            box = match.get("box")
            if isinstance(box, dict):
                box_summary = {}
                for key in ("screenCenterX", "screenCenterY", "centerX", "centerY"):
                    value = box.get(key)
                    if isinstance(value, (int, float)):
                        box_summary[key] = round(float(value), 2)
                if box_summary:
                    entry["box"] = box_summary
            if entry:
                summarized.append(entry)
        if summarized:
            preview = ", ".join(item.get("text", "") for item in summarized[:3] if isinstance(item.get("text"), str)).strip() or None
            artifacts["matches"] = write_json_artifact(job_id, step_id, "matches.json", matches, preview=compact_text(preview, 240))

    window = result.get("window")
    if isinstance(window, dict):
        filtered = {key: value for key, value in window.items() if isinstance(value, (str, int, float, bool))}
        if filtered:
            artifacts["window"] = write_json_artifact(
                job_id,
                step_id,
                "window.json",
                filtered,
                preview=compact_text(json.dumps(filtered, sort_keys=True), 240),
            )

    return artifacts


def legacy_workflow_spec(workflow: str, cmd_args: list[str]) -> dict[str, Any]:
    if workflow == "safari_reload_wait_url":
        url = require_arg(cmd_args, 0, "workflow safari_reload_wait_url requires <url-substring>")
        return {
            "steps": [
                {"id": "focus", "name": "focus Safari", "type": "steer", "command": "focus", "args": ["--app", "Safari"]},
                {"id": "reload", "name": "reload Safari", "type": "steer", "command": "safari", "args": ["reload"]},
                {
                    "id": "wait_url",
                    "name": "wait for Safari URL",
                    "type": "steer",
                    "command": "wait",
                    "args": ["url", "--url", url, "--contains", "--timeout", "10", "--interval", "0.75"],
                },
            ]
        }
    if workflow == "safari_open_wait_url":
        url = require_arg(cmd_args, 0, "workflow safari_open_wait_url requires <url>")
        expected = cmd_args[1].strip() if len(cmd_args) > 1 and cmd_args[1].strip() else url
        return {
            "steps": [
                {"id": "open", "name": "open URL in Safari", "type": "steer", "command": "open-url", "args": ["--app", "Safari", "--url", url]},
                {
                    "id": "wait_url",
                    "name": "wait for Safari URL",
                    "type": "steer",
                    "command": "wait",
                    "args": ["url", "--url", expected, "--contains", "--timeout", "12", "--interval", "0.75"],
                },
            ]
        }
    if workflow == "safari_open_command_page":
        url = cmd_args[0].strip() if cmd_args and cmd_args[0].strip() else "http://localhost:3000/command"
        return legacy_workflow_spec("safari_open_wait_url", [url, "/command"])
    if workflow == "safari_recover_localhost_command":
        url = cmd_args[0].strip() if cmd_args and cmd_args[0].strip() else "http://localhost:3000/command"
        return {
            "steps": [
                {"id": "open", "name": "open localhost command page", "type": "steer", "command": "open-url", "args": ["--app", "Safari", "--url", url]},
                {
                    "id": "wait_reload",
                    "name": "wait for reload button",
                    "type": "steer",
                    "command": "wait",
                    "args": ["ui", "--app", "Safari", "--name", "Reload this page", "--role", "button", "--timeout", "8", "--interval", "0.75"],
                },
                {
                    "id": "click_reload",
                    "name": "click reload button",
                    "type": "steer",
                    "command": "ui",
                    "args": ["click", "--app", "Safari", "--name", "Reload this page", "--role", "button"],
                },
                {
                    "id": "wait_url",
                    "name": "wait for command URL",
                    "type": "steer",
                    "command": "wait",
                    "args": ["url", "--url", "/command", "--contains", "--timeout", "12", "--interval", "0.75"],
                },
            ]
        }
    if workflow == "safari_wait_and_click_ui":
        name = require_arg(cmd_args, 0, "workflow safari_wait_and_click_ui requires <label>")
        role = cmd_args[1].strip() if len(cmd_args) > 1 and cmd_args[1].strip() else "button"
        return {
            "steps": [
                {"id": "focus", "name": "focus Safari", "type": "steer", "command": "focus", "args": ["--app", "Safari"]},
                {
                    "id": "wait_ui",
                    "name": "wait for Safari UI",
                    "type": "steer",
                    "command": "wait",
                    "args": ["ui", "--app", "Safari", "--name", name, "--role", role, "--timeout", "10", "--interval", "0.75"],
                },
                {
                    "id": "click_ui",
                    "name": "click Safari UI",
                    "type": "steer",
                    "command": "ui",
                    "args": ["click", "--app", "Safari", "--name", name, "--role", role],
                },
            ]
        }
    if workflow == "safari_open_and_wait_ui":
        url = require_arg(cmd_args, 0, "workflow safari_open_and_wait_ui requires <url> <label> [role]")
        name = require_arg(cmd_args, 1, "workflow safari_open_and_wait_ui requires <url> <label> [role]")
        role = cmd_args[2].strip() if len(cmd_args) > 2 and cmd_args[2].strip() else "button"
        return {
            "steps": [
                {"id": "open", "name": "open URL in Safari", "type": "steer", "command": "open-url", "args": ["--app", "Safari", "--url", url]},
                {
                    "id": "wait_ui",
                    "name": "wait for Safari UI",
                    "type": "steer",
                    "command": "wait",
                    "args": ["ui", "--app", "Safari", "--name", name, "--role", role, "--timeout", "12", "--interval", "0.75"],
                },
            ]
        }
    if workflow == "textedit_new_set_text":
        body = require_arg(cmd_args, 0, "workflow textedit_new_set_text requires <text>")
        return {"steps": [{"id": "create_textedit", "name": "create TextEdit document", "type": "steer", "command": "textedit", "args": ["new", "--text", body]}]}
    if workflow == "notes_create":
        title = require_arg(cmd_args, 0, "workflow notes_create requires <title> <body>")
        body = require_arg(cmd_args, 1, "workflow notes_create requires <title> <body>")
        return {"steps": [{"id": "create_note", "name": "create Notes note", "type": "steer", "command": "notes", "args": ["create", "--title", title, "--body", body]}]}
    raise ValueError(f"Unknown workflow: {workflow}")


PLACEHOLDER_PATTERN = re.compile(r"\{\{\s*([^}]+?)\s*\}\}")


def deep_resolve(value: Any, context: dict[str, Any]) -> Any:
    if isinstance(value, str):
        def repl(match: re.Match[str]) -> str:
            path = match.group(1).strip().split(".")
            current: Any = context
            for part in path:
                if isinstance(current, dict) and part in current:
                    current = current[part]
                else:
                    return ""
            if current is None:
                return ""
            return current if isinstance(current, str) else json.dumps(current)

        return PLACEHOLDER_PATTERN.sub(repl, value)
    if isinstance(value, list):
        return [deep_resolve(item, context) for item in value]
    if isinstance(value, dict):
        return {key: deep_resolve(item, context) for key, item in value.items()}
    return value


def run_shell_prompt(session: str, prompt: str, timeout_seconds: float | None = None) -> dict[str, Any]:
    run_drive("session", "create", "--name", session, "--json")
    args = ["run", "--session", session]
    if timeout_seconds is not None:
        args.extend(["--timeout", str(timeout_seconds)])
    args.extend(["--json", prompt])
    result = run_drive(*args)
    ok, payload = parse_json_result(result)
    if ok and isinstance(payload, dict):
        return payload
    return structured_process_failure(result, "shell command failed")


def _notification_subject(event: dict[str, Any]) -> str:
    routing = event.get("routing")
    prefix = ""
    if isinstance(routing, dict):
        prefix = str(routing.get("mailSubjectPrefix") or "").strip()
    title = str(event.get("title") or "OpenClaw update").strip() or "OpenClaw update"
    return f"{prefix}: {title}" if prefix else title


def _notification_body(job: dict[str, Any], event: dict[str, Any]) -> str:
    lines = [
        str(event.get("title") or "OpenClaw update").strip() or "OpenClaw update",
        "",
        f"Job ID: {job.get('id')}",
        f"Status: {job.get('status')}",
    ]
    target_agent = str(job.get("targetAgent") or "").strip()
    if target_agent:
        lines.append(f"Target agent: {target_agent}")
    template_id = str(job.get("templateId") or "").strip()
    if template_id:
        lines.append(f"Template: {template_id}")
    workflow = str(job.get("workflow") or "").strip()
    if workflow:
        lines.append(f"Workflow: {workflow}")
    summary = compact_text(job.get("summary"), 800)
    if summary:
        lines.extend(["", "Summary:", summary])
    error = compact_text(job.get("error"), 800)
    if error:
        lines.extend(["", "Error:", error])
    return "\n".join(lines).strip()


def dispatch_notification_event(job: dict[str, Any], event: dict[str, Any] | None) -> list[dict[str, Any]]:
    if not isinstance(event, dict):
        return []
    event_id = str(event.get("id") or "").strip()
    channels = event.get("channels")
    if not event_id or not isinstance(channels, list):
        return []
    routing = event.get("routing")
    route = routing if isinstance(routing, dict) else {}
    body = _notification_body(job, event)
    deliveries: list[dict[str, Any]] = []

    for channel in channels:
        if channel == "push":
            recorded = record_notification_delivery(event_id, "push", "recorded")
            if isinstance(recorded, dict):
                deliveries.append(recorded)
            continue
        if channel == "notes":
            recorded = record_notification_delivery(event_id, "notes", "recorded")
            if isinstance(recorded, dict):
                deliveries.append(recorded)
            continue
        if channel == "imessage":
            recipient = str(route.get("recipient") or "").strip()
            if not recipient:
                recorded = record_notification_delivery(event_id, "imessage", "skipped", detail="missing recipient")
                if isinstance(recorded, dict):
                    deliveries.append(recorded)
                continue
            args = ["send", "--recipient", recipient, "--text", body]
            allowed, reason = check_command_policy("steer", "messages", args)
            if not allowed:
                recorded = record_notification_delivery(event_id, "imessage", "blocked", detail=reason, target=recipient)
                if isinstance(recorded, dict):
                    deliveries.append(recorded)
                continue
            result = run_steer("messages", *args, "--json")
            ok, payload = parse_json_result(result)
            final = payload if ok and isinstance(payload, dict) else structured_process_failure(result, "messages send failed")
            status = "sent" if final.get("ok") else "failed"
            detail = None if final.get("ok") else str(final.get("error") or "messages send failed")
            recorded = record_notification_delivery(event_id, "imessage", status, detail=detail, target=recipient)
            if isinstance(recorded, dict):
                deliveries.append(recorded)
            continue
        if channel == "mail_draft":
            mail_to = str(route.get("mailTo") or "").strip()
            if not mail_to:
                recorded = record_notification_delivery(event_id, "mail_draft", "skipped", detail="missing mailTo")
                if isinstance(recorded, dict):
                    deliveries.append(recorded)
                continue
            subject = _notification_subject(event)
            args = ["draft", "--to", mail_to, "--subject", subject, "--body", body]
            allowed, reason = check_command_policy("steer", "mail", args)
            if not allowed:
                recorded = record_notification_delivery(event_id, "mail_draft", "blocked", detail=reason, target=mail_to)
                if isinstance(recorded, dict):
                    deliveries.append(recorded)
                continue
            result = run_steer("mail", *args, "--json")
            ok, payload = parse_json_result(result)
            final = payload if ok and isinstance(payload, dict) else structured_process_failure(result, "mail draft failed")
            status = "drafted" if final.get("ok") else "failed"
            detail = None if final.get("ok") else str(final.get("error") or "mail draft failed")
            recorded = record_notification_delivery(event_id, "mail_draft", status, detail=detail, target=mail_to)
            if isinstance(recorded, dict):
                deliveries.append(recorded)
            continue

    return deliveries


def execute_step(step: dict[str, Any], job: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
    step_type = str(step.get("type", "")).strip()
    if not step_type:
        raise ValueError("workflow step type is required")
    if step_type == "steer":
        command = str(step.get("command", "")).strip()
        args = [str(item) for item in step.get("args", [])]
        allowed, reason = check_command_policy("steer", command, args, dangerous=bool(step.get("dangerous", False)))
        if not allowed:
            raise PolicyError(reason or "steer step blocked by policy")
        result = run_steer(command, *args, "--json")
        ok, payload = parse_json_result(result)
        return payload if ok and isinstance(payload, dict) else structured_process_failure(result, "steer command failed")
    if step_type == "drive":
        command = str(step.get("command", "")).strip()
        args = [str(item) for item in step.get("args", [])]
        allowed, reason = check_command_policy("drive", command, args, dangerous=bool(step.get("dangerous", False)))
        if not allowed:
            raise PolicyError(reason or "drive step blocked by policy")
        result = run_drive(command, *args)
        ok, payload = parse_json_result(result)
        return payload if ok and isinstance(payload, dict) else structured_process_failure(result, "drive command failed")
    if step_type == "agent":
        target_agent = str(step.get("targetAgent") or job.get("targetAgent") or "main")
        prompt = str(step.get("prompt", "")).strip()
        thinking = str(step.get("thinking", "")).strip() or None
        local = bool(step.get("local", job.get("local", False)))
        result = run_openclaw_agent(target_agent, prompt, thinking, local)
        ok, payload = parse_json_result(result)
        return payload if ok else structured_process_failure(result, "OpenClaw agent run failed")
    if step_type == "shell":
        prompt = str(step.get("prompt", "")).strip()
        session = str(step.get("session") or job.get("session") or f"listen-{job['id']}")
        timeout_seconds = float(step.get("timeoutSeconds", 120))
        return run_shell_prompt(session, prompt, timeout_seconds=timeout_seconds)
    if step_type == "note":
        message = str(step.get("message", "")).strip()
        append_update(job, message or "note", level="info", step_id=str(step.get("id", "")) or None)
        return {"ok": True, "message": message}
    if step_type == "wait":
        run_spec = step.get("run")
        if not isinstance(run_spec, dict):
            raise ValueError("wait step requires an object run field")
        timeout_seconds = float(step.get("timeoutSeconds", 30))
        interval_seconds = float(step.get("intervalSeconds", 0.75))
        until = step.get("until", {})
        path = str(until.get("path", "ok")) if isinstance(until, dict) else "ok"
        contains = str(until.get("contains", "")) if isinstance(until, dict) else ""
        equals = until.get("equals") if isinstance(until, dict) and "equals" in until else None
        deadline = time.time() + timeout_seconds
        last_result: Any = None
        while time.time() <= deadline:
            last_result = execute_step(deep_resolve(run_spec, context), job, context)
            current: Any = last_result
            for part in path.split("."):
                if isinstance(current, dict):
                    current = current.get(part)
                else:
                    current = None
                    break
            matched = bool(current)
            if contains:
                matched = contains in json.dumps(current)
            elif equals is not None:
                matched = current == equals
            if matched:
                return {"ok": True, "matched": True, "result": last_result}
            time.sleep(interval_seconds)
        return {"ok": False, "matched": False, "timedOut": True, "result": last_result}
    raise ValueError(f"Unsupported workflow step type: {step_type}")


def execute_workflow_spec(spec: dict[str, Any], job: dict[str, Any], job_id: str) -> dict[str, Any]:
    steps = spec.get("steps", [])
    if not isinstance(steps, list) or not steps:
        raise ValueError("workflowSpec.steps must be a non-empty array")

    timeout_seconds = float(spec.get("timeoutSeconds", 300))
    started_at = time.time()
    completed_context: dict[str, Any] = {}
    existing_steps = {str(item.get("id")): item for item in job.get("stepStatus", []) if isinstance(item, dict) and item.get("id")}
    start_index = 0
    resume_from_step_id = str(job.get("resumeFromStepId") or "").strip() or None
    for index, raw_step in enumerate(steps):
        if not isinstance(raw_step, dict):
            raise ValueError("workflowSpec.steps must contain objects")
        step_id = str(raw_step.get("id") or f"step_{index + 1}")
        if resume_from_step_id and step_id == resume_from_step_id:
            start_index = index
            break
        if resume_from_step_id:
            previous = existing_steps.get(step_id)
            if previous:
                completed_context[step_id] = {"result": previous.get("result")}
            continue
        previous = existing_steps.get(step_id)
        if previous and previous.get("status") == "completed":
            completed_context[step_id] = {"result": previous.get("result")}
            start_index = index + 1
            continue
        break

    for index, raw_step in enumerate(steps[start_index:], start=start_index):
        if time.time() - started_at > timeout_seconds:
            job["timedOut"] = True
            raise RuntimeError("workflow timed out")
        step = deepcopy(raw_step)
        if not isinstance(step, dict):
            raise ValueError("workflowSpec.steps must contain objects")
        step_id = str(step.get("id") or f"step_{index + 1}")
        step_name = str(step.get("name") or step_id)
        step_type = str(step.get("type") or "")
        allowed, reason = check_step_policy(step)
        if not allowed:
            set_step_state(job, step_id, name=step_name, step_type=step_type, status="failed", error=reason, dangerous=bool(step.get("dangerous", False)))
            job["policy"] = {**current_policy(), "allowed": False, "reason": reason}
            raise PolicyError(reason or "workflow step blocked by policy")
        append_update(job, f"Starting step: {step_name}", step_id=step_id)
        set_step_state(job, step_id, name=step_name, step_type=step_type, status="running", dangerous=bool(step.get("dangerous", False)), started_at=now_iso())
        persist_job(job_id, job)

        context = {"job": {"id": job["id"], "session": job.get("session")}, "steps": completed_context}
        resolved_step = deep_resolve(step, context)
        step_started = time.time()
        result = execute_step(resolved_step, job, context)
        step_duration_ms = int((time.time() - step_started) * 1000)
        artifacts = extract_step_artifacts(job_id, step_id, result)
        ok = bool(result.get("ok", True)) if isinstance(result, dict) else True
        if ok:
            append_update(job, f"Completed step: {step_name}", step_id=step_id)
            set_step_state(
                job,
                step_id,
                name=step_name,
                step_type=step_type,
                status="completed",
                result=result,
                artifacts=artifacts,
                dangerous=bool(step.get("dangerous", False)),
                completed_at=now_iso(),
                duration_ms=step_duration_ms,
            )
            completed_context[step_id] = {"result": result}
            persist_job(job_id, job)
            continue

        error = str(result.get("error") or result.get("stderr") or result.get("stdout") or f"{step_name} failed")
        append_update(job, f"Failed step: {step_name}", level="error", step_id=step_id)
        set_step_state(
            job,
            step_id,
            name=step_name,
            step_type=step_type,
            status="failed",
            result=result,
            error=error,
            artifacts=artifacts,
            dangerous=bool(step.get("dangerous", False)),
            completed_at=now_iso(),
            duration_ms=step_duration_ms,
        )
        persist_job(job_id, job)
        if str(step.get("onFailure", "stop")) != "continue":
            raise RuntimeError(error)
        completed_context[step_id] = {"result": result}

    return {
        "ok": True,
        "steps": job.get("stepStatus", []),
        "final": (job.get("stepStatus") or [])[-1] if job.get("stepStatus") else None,
        "resumeFromStepId": resume_from_step_id,
    }


def finalize_job(job_id: str, job: dict[str, Any], started: float) -> None:
    completed = now_iso()
    job["completedAt"] = completed
    job["updatedAt"] = completed
    job["durationMs"] = int((time.time() - started) * 1000)
    notification_event = emit_job_notification(job)
    if notification_event is not None:
        job["notificationEventId"] = notification_event.get("id")
        job["notificationDeliveries"] = dispatch_notification_event(job, notification_event)
    write_job(job_id, job)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--job-id", required=True)
    args = parser.parse_args()
    job = read_job(args.job_id)
    prompt = str(job.get("prompt", ""))
    mode = str(job.get("mode", "agent"))
    command = str(job.get("command") or "").strip()
    workflow = str(job.get("workflow") or "").strip()
    cmd_args = [str(item) for item in job.get("args", []) if str(item).strip()]
    workflow_spec = job.get("workflowSpec")
    template_id = str(job.get("templateId") or "").strip()
    template_inputs = job.get("templateInputs") if isinstance(job.get("templateInputs"), dict) else {}
    session = str(job.get("session", f"listen-{args.job_id}"))
    target_agent = str(job.get("targetAgent", "main"))
    thinking_raw = job.get("thinking")
    thinking = thinking_raw.strip() if isinstance(thinking_raw, str) and thinking_raw.strip() else None
    local = bool(job.get("local", False))
    started = time.time()
    job["policy"] = {**current_policy(), "allowed": True}
    job["timedOut"] = False

    try:
        if mode == "shell":
            append_update(job, f"Running shell prompt in {session}")
            persist_job(args.job_id, job)
            payload = run_shell_prompt(session, prompt)
            job["status"] = "completed" if payload.get("ok") else "failed"
            job["result"] = payload
            job["error"] = None if payload.get("ok") else str(payload.get("error") or payload.get("output") or "shell command failed")
            job["summary"] = f"Shell job {'completed' if payload.get('ok') else 'failed'} in session {session}"
        elif mode == "agent":
            append_update(job, f"Running OpenClaw agent {target_agent}")
            persist_job(args.job_id, job)
            result = run_openclaw_agent(target_agent, prompt, thinking, local)
            ok, payload = parse_json_result(result)
            job["status"] = "completed" if ok else "failed"
            job["result"] = payload if ok else structured_process_failure(result, "OpenClaw agent run failed")
            job["error"] = None if ok else str(job["result"]["error"])
            job["summary"] = f"Agent job {'completed' if ok else 'failed'} for {target_agent}"
        elif mode == "steer":
            allowed, reason = check_command_policy("steer", command, cmd_args)
            if not allowed:
                raise PolicyError(reason or "steer command blocked by policy")
            append_update(job, f"Running steer {command}")
            persist_job(args.job_id, job)
            result = run_steer(command, *cmd_args, "--json")
            ok, payload = parse_json_result(result)
            final = payload if ok and isinstance(payload, dict) else structured_process_failure(result, "steer command failed")
            job["status"] = "completed" if final.get("ok") else "failed"
            job["result"] = final
            job["error"] = None if final.get("ok") else str(final.get("error") or "steer command failed")
            job["summary"] = f"Steer command {command} {'completed' if final.get('ok') else 'failed'}"
        elif mode == "drive":
            allowed, reason = check_command_policy("drive", command, cmd_args)
            if not allowed:
                raise PolicyError(reason or "drive command blocked by policy")
            append_update(job, f"Running drive {command}")
            persist_job(args.job_id, job)
            result = run_drive(command, *cmd_args)
            ok, payload = parse_json_result(result)
            final = payload if ok and isinstance(payload, dict) else structured_process_failure(result, "drive command failed")
            job["status"] = "completed" if final.get("ok") else "failed"
            job["result"] = final
            job["error"] = None if final.get("ok") else str(final.get("error") or "drive command failed")
            job["summary"] = f"Drive command {command} {'completed' if final.get('ok') else 'failed'}"
        elif mode == "workflow":
            if template_id:
                spec, normalized_inputs = resolve_template(template_id, template_inputs)
                job["templateInputs"] = normalized_inputs
            elif isinstance(workflow_spec, dict):
                spec = workflow_spec
            else:
                allowed, reason = check_workflow_policy(workflow)
                if not allowed:
                    raise PolicyError(reason or "workflow blocked by policy")
                spec = legacy_workflow_spec(workflow, cmd_args)
            payload = execute_workflow_spec(spec, job, args.job_id)
            job["status"] = "completed"
            job["result"] = payload
            job["error"] = None
            job["summary"] = f"Workflow {template_id or ('spec' if isinstance(workflow_spec, dict) else workflow)} completed"
        else:
            job["status"] = "completed"
            job["result"] = {"ok": True, "message": f"Recorded prompt: {prompt}"}
            job["error"] = None
            job["summary"] = "Note job recorded"
    except PolicyError as exc:
        job["status"] = "failed"
        job["result"] = None
        job["error"] = str(exc)
        job["summary"] = f"Blocked by policy: {exc}"
        job["policy"] = {**current_policy(), "allowed": False, "reason": str(exc)}
    except (ValueError, RuntimeError) as exc:
        job["status"] = "failed"
        job["result"] = job.get("result")
        job["error"] = str(exc)
        if "timed out" in str(exc).lower():
            job["timedOut"] = True
        if mode == "workflow":
            job["summary"] = f"Workflow {template_id or ('spec' if isinstance(workflow_spec, dict) else workflow)} failed"
        else:
            job["summary"] = f"{mode.capitalize()} job failed"

    finalize_job(args.job_id, job, started)


if __name__ == "__main__":
    main()
