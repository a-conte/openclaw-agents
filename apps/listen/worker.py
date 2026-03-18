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


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--job-id", required=True)
    args = parser.parse_args()
    job = read_job(args.job_id)
    prompt = str(job.get("prompt", ""))
    mode = str(job.get("mode", "note"))
    session = str(job.get("session", f"listen-{args.job_id}"))
    started = time.time()

    run_drive("session", "create", "--name", session, "--json")

    if mode == "shell":
        result = run_drive("run", "--session", session, "--json", prompt)
        try:
            payload = json.loads(result.stdout)
        except json.JSONDecodeError:
            payload = {"ok": False, "exitCode": result.returncode, "output": result.stdout, "timedOut": False}
        job["status"] = "completed" if payload.get("ok") else "failed"
        job["result"] = payload.get("output")
        job["error"] = None if payload.get("ok") else payload.get("output")
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
