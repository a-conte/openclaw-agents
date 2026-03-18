#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
JOBS_DIR = Path(__file__).resolve().parent / "jobs"


def read_job(job_id: str) -> dict[str, object]:
    return json.loads((JOBS_DIR / f"{job_id}.json").read_text(encoding="utf-8"))


def write_job(job_id: str, payload: dict[str, object]) -> None:
    (JOBS_DIR / f"{job_id}.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")


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
    return subprocess.run(
        args,
        text=True,
        capture_output=True,
        cwd=str(REPO_ROOT),
        check=False,
    )


def parse_json_result(result: subprocess.CompletedProcess[str]) -> tuple[bool, object]:
    try:
        payload = json.loads(result.stdout)
    except json.JSONDecodeError:
        payload = None
    ok = result.returncode == 0 and payload is not None
    return ok, payload


def require_arg(cmd_args: list[str], index: int, message: str) -> str:
    if len(cmd_args) <= index or not cmd_args[index].strip():
        raise ValueError(message)
    return cmd_args[index].strip()


def execute_workflow(workflow: str, cmd_args: list[str]) -> dict[str, object]:
    steps: list[dict[str, object]] = []

    def run_step(label: str, runner, *runner_args: str) -> dict[str, object]:
        result = runner(*runner_args)
        ok, payload = parse_json_result(result)
        step = {
            "label": label,
            "ok": ok,
            "stdout": result.stdout.strip(),
            "stderr": result.stderr.strip(),
            "result": payload,
        }
        steps.append(step)
        if not ok:
            raise RuntimeError(step["stderr"] or step["stdout"] or f"{label} failed")
        return payload if isinstance(payload, dict) else {"value": payload}

    if workflow == "safari_reload_wait_url":
        url = require_arg(cmd_args, 0, "workflow safari_reload_wait_url requires <url-substring>")
        run_step("focus Safari", run_steer, "focus", "--app", "Safari", "--json")
        run_step("reload Safari", run_steer, "safari", "reload", "--json")
        final = run_step(
            "wait for Safari URL",
            run_steer,
            "wait",
            "url",
            "--url",
            url,
            "--contains",
            "--timeout",
            "10",
            "--interval",
            "0.75",
            "--json",
        )
        return {"ok": True, "workflow": workflow, "steps": steps, "final": final}

    if workflow == "safari_open_wait_url":
        url = require_arg(cmd_args, 0, "workflow safari_open_wait_url requires <url>")
        expected = cmd_args[1].strip() if len(cmd_args) > 1 and cmd_args[1].strip() else url
        run_step("open URL in Safari", run_steer, "open-url", "--app", "Safari", "--url", url, "--json")
        final = run_step(
            "wait for Safari URL",
            run_steer,
            "wait",
            "url",
            "--url",
            expected,
            "--contains",
            "--timeout",
            "12",
            "--interval",
            "0.75",
            "--json",
        )
        return {"ok": True, "workflow": workflow, "steps": steps, "final": final}

    if workflow == "safari_open_command_page":
        url = cmd_args[0].strip() if cmd_args and cmd_args[0].strip() else "http://localhost:3000/command"
        run_step("open command page", run_steer, "open-url", "--app", "Safari", "--url", url, "--json")
        final = run_step(
            "wait for command URL",
            run_steer,
            "wait",
            "url",
            "--url",
            "/command",
            "--contains",
            "--timeout",
            "12",
            "--interval",
            "0.75",
            "--json",
        )
        return {"ok": True, "workflow": workflow, "steps": steps, "final": final}

    if workflow == "safari_recover_localhost_command":
        url = cmd_args[0].strip() if cmd_args and cmd_args[0].strip() else "http://localhost:3000/command"
        run_step("open localhost command page", run_steer, "open-url", "--app", "Safari", "--url", url, "--json")
        run_step("wait for reload button", run_steer, "wait", "ui", "--app", "Safari", "--name", "Reload this page", "--role", "button", "--timeout", "8", "--interval", "0.75", "--json")
        run_step("click reload button", run_steer, "ui", "click", "--app", "Safari", "--name", "Reload this page", "--role", "button", "--json")
        final = run_step(
            "wait for command URL",
            run_steer,
            "wait",
            "url",
            "--url",
            "/command",
            "--contains",
            "--timeout",
            "12",
            "--interval",
            "0.75",
            "--json",
        )
        return {"ok": True, "workflow": workflow, "steps": steps, "final": final}

    if workflow == "safari_wait_and_click_ui":
        name = require_arg(cmd_args, 0, "workflow safari_wait_and_click_ui requires <label>")
        role = cmd_args[1].strip() if len(cmd_args) > 1 and cmd_args[1].strip() else "button"
        run_step("focus Safari", run_steer, "focus", "--app", "Safari", "--json")
        found = run_step(
            "wait for Safari UI",
            run_steer,
            "wait",
            "ui",
            "--app",
            "Safari",
            "--name",
            name,
            "--role",
            role,
            "--timeout",
            "10",
            "--interval",
            "0.75",
            "--json",
        )
        clicked = run_step(
            "click Safari UI",
            run_steer,
            "ui",
            "click",
            "--app",
            "Safari",
            "--name",
            name,
            "--role",
            role,
            "--json",
        )
        return {"ok": True, "workflow": workflow, "steps": steps, "found": found, "clicked": clicked}

    if workflow == "safari_open_and_wait_ui":
        url = require_arg(cmd_args, 0, "workflow safari_open_and_wait_ui requires <url> <label> [role]")
        name = require_arg(cmd_args, 1, "workflow safari_open_and_wait_ui requires <url> <label> [role]")
        role = cmd_args[2].strip() if len(cmd_args) > 2 and cmd_args[2].strip() else "button"
        run_step("open URL in Safari", run_steer, "open-url", "--app", "Safari", "--url", url, "--json")
        found = run_step(
            "wait for Safari UI",
            run_steer,
            "wait",
            "ui",
            "--app",
            "Safari",
            "--name",
            name,
            "--role",
            role,
            "--timeout",
            "12",
            "--interval",
            "0.75",
            "--json",
        )
        return {"ok": True, "workflow": workflow, "steps": steps, "found": found}

    if workflow == "textedit_new_set_text":
        body = require_arg(cmd_args, 0, "workflow textedit_new_set_text requires <text>")
        created = run_step("create TextEdit document", run_steer, "textedit", "new", "--text", body, "--json")
        return {"ok": True, "workflow": workflow, "steps": steps, "final": created}

    if workflow == "notes_create":
        title = require_arg(cmd_args, 0, "workflow notes_create requires <title> <body>")
        body = require_arg(cmd_args, 1, "workflow notes_create requires <title> <body>")
        created = run_step("create Notes note", run_steer, "notes", "create", "--title", title, "--body", body, "--json")
        return {"ok": True, "workflow": workflow, "steps": steps, "final": created}

    raise ValueError(f"Unknown workflow: {workflow}")


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
    session = str(job.get("session", f"listen-{args.job_id}"))
    target_agent = str(job.get("targetAgent", "main"))
    thinking_raw = job.get("thinking")
    thinking = thinking_raw.strip() if isinstance(thinking_raw, str) and thinking_raw.strip() else None
    local = bool(job.get("local", False))
    started = time.time()

    if mode == "shell":
        run_drive("session", "create", "--name", session, "--json")
        result = run_drive("run", "--session", session, "--json", prompt)
        try:
            payload = json.loads(result.stdout)
        except json.JSONDecodeError:
            payload = {"ok": False, "exitCode": result.returncode, "output": result.stdout, "timedOut": False}
        job["status"] = "completed" if payload.get("ok") else "failed"
        job["result"] = payload.get("output")
        job["error"] = None if payload.get("ok") else payload.get("output")
    elif mode == "agent":
        result = run_openclaw_agent(target_agent, prompt, thinking, local)
        ok, payload = parse_json_result(result)
        job["status"] = "completed" if ok else "failed"
        job["result"] = payload if ok else result.stdout.strip() or result.stderr.strip()
        job["error"] = None if ok else result.stderr.strip() or "OpenClaw agent run failed"
    elif mode == "steer":
        result = run_steer(command, *cmd_args, "--json")
        ok, payload = parse_json_result(result)
        job["status"] = "completed" if ok else "failed"
        job["result"] = payload if ok else result.stdout.strip() or result.stderr.strip()
        job["error"] = None if ok else result.stderr.strip() or "steer command failed"
    elif mode == "drive":
        result = run_drive(command, *cmd_args)
        ok, payload = parse_json_result(result)
        job["status"] = "completed" if ok else "failed"
        job["result"] = payload if ok else result.stdout.strip() or result.stderr.strip()
        job["error"] = None if ok else result.stderr.strip() or "drive command failed"
    elif mode == "workflow":
        try:
            payload = execute_workflow(workflow, cmd_args)
            job["status"] = "completed"
            job["result"] = payload
            job["error"] = None
        except (ValueError, RuntimeError) as exc:
            job["status"] = "failed"
            job["result"] = None
            job["error"] = str(exc)
    else:
        job["status"] = "completed"
        job["result"] = f"Recorded prompt: {prompt}"
        job["error"] = None

    completed = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    job["completedAt"] = completed
    job["updatedAt"] = completed
    job["durationMs"] = int((time.time() - started) * 1000)
    write_job(args.job_id, job)


if __name__ == "__main__":
    main()
