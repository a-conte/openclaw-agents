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


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--job-id", required=True)
    args = parser.parse_args()
    job = read_job(args.job_id)
    prompt = str(job.get("prompt", ""))
    mode = str(job.get("mode", "agent"))
    command = str(job.get("command") or "").strip()
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
        try:
            payload = json.loads(result.stdout)
        except json.JSONDecodeError:
            payload = None
        ok = result.returncode == 0 and payload is not None
        job["status"] = "completed" if ok else "failed"
        job["result"] = payload if ok else result.stdout.strip() or result.stderr.strip()
        job["error"] = None if ok else result.stderr.strip() or "OpenClaw agent run failed"
    elif mode == "steer":
        result = run_steer(command, *cmd_args, "--json")
        try:
            payload = json.loads(result.stdout)
        except json.JSONDecodeError:
            payload = None
        ok = result.returncode == 0 and payload is not None
        job["status"] = "completed" if ok else "failed"
        job["result"] = payload if ok else result.stdout.strip() or result.stderr.strip()
        job["error"] = None if ok else result.stderr.strip() or "steer command failed"
    elif mode == "drive":
        result = run_drive(command, *cmd_args)
        try:
            payload = json.loads(result.stdout)
        except json.JSONDecodeError:
            payload = None
        ok = result.returncode == 0 and payload is not None
        job["status"] = "completed" if ok else "failed"
        job["result"] = payload if ok else result.stdout.strip() or result.stderr.strip()
        job["error"] = None if ok else result.stderr.strip() or "drive command failed"
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
