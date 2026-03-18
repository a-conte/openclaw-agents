#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import shutil
import signal
import subprocess
import sys
import time
import uuid
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from policy import check_command_policy, check_workflow_policy, current_policy


REPO_ROOT = Path(__file__).resolve().parents[2]
JOBS_DIR = Path(__file__).resolve().parent / "jobs"
JOBS_DIR.mkdir(exist_ok=True)
ARCHIVED_DIR = JOBS_DIR / "archived"
ARCHIVED_DIR.mkdir(exist_ok=True)
WORKERS: dict[str, subprocess.Popen[str]] = {}


def now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def clean_str(value: object) -> str:
    return value.strip() if isinstance(value, str) else ""


def write_job(job_id: str, payload: dict[str, object]) -> None:
    (JOBS_DIR / f"{job_id}.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")


def read_job(job_id: str, *, archived: bool = False) -> dict[str, object] | None:
    directory = ARCHIVED_DIR if archived else JOBS_DIR
    path = directory / f"{job_id}.json"
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def list_jobs_in(directory: Path) -> list[dict[str, object]]:
    jobs: list[dict[str, object]] = []
    for path in sorted(directory.glob("*.json"), key=lambda item: item.stat().st_mtime, reverse=True):
        try:
            jobs.append(json.loads(path.read_text(encoding="utf-8")))
        except FileNotFoundError:
            continue
    return jobs


def archive_jobs() -> int:
    count = 0
    for path in JOBS_DIR.glob("*.json"):
        shutil.move(str(path), str(ARCHIVED_DIR / path.name))
        count += 1
    return count


def worker_command(job_id: str) -> list[str]:
    return [sys.executable, str(Path(__file__).resolve().parent / "worker.py"), "--job-id", job_id]


def spawn_worker(job_id: str) -> None:
    proc = subprocess.Popen(
        worker_command(job_id),
        cwd=str(REPO_ROOT),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        text=True,
        start_new_session=True,
    )
    WORKERS[job_id] = proc


def new_job_payload(
    data: dict[str, object],
    *,
    attempt: int = 1,
    retry_of: str | None = None,
    prior_step_status: list[object] | None = None,
    retry_mode: str | None = None,
    resume_from_step_id: str | None = None,
    history: list[object] | None = None,
) -> tuple[str, dict[str, object]]:
    prompt = clean_str(data.get("prompt"))
    mode = clean_str(data.get("mode")) or "agent"
    command_raw = data.get("command")
    workflow_raw = data.get("workflow")
    workflow_spec = data.get("workflowSpec")
    command = command_raw.strip() if isinstance(command_raw, str) else ""
    workflow = workflow_raw.strip() if isinstance(workflow_raw, str) else ""
    raw_args = data.get("args", [])
    cmd_args = [str(item) for item in raw_args] if isinstance(raw_args, list) else []
    target_agent = clean_str(data.get("targetAgent")) or "main"
    thinking_raw = data.get("thinking")
    thinking = thinking_raw.strip() if isinstance(thinking_raw, str) else ""
    local = bool(data.get("local", False))

    job_id = uuid.uuid4().hex[:10]
    now = now_iso()
    job = {
        "id": job_id,
        "prompt": prompt,
        "mode": mode,
        "command": command or None,
        "workflow": workflow or None,
        "workflowSpec": workflow_spec if isinstance(workflow_spec, dict) else None,
        "args": cmd_args or [],
        "targetAgent": target_agent,
        "status": "running",
        "createdAt": now,
        "startedAt": now,
        "updatedAt": now,
        "updates": [],
        "summary": "",
        "result": None,
        "error": None,
        "session": f"listen-{job_id}",
        "thinking": thinking or None,
        "local": local,
        "timedOut": False,
        "attempt": attempt,
        "retryOf": retry_of,
        "retryMode": retry_mode or None,
        "resumeFromStepId": resume_from_step_id,
        "currentStepId": None,
        "stepStatus": prior_step_status or [],
        "history": history or [],
        "policy": {**current_policy(), "allowed": True},
    }
    return job_id, job


def validate_job_request(data: dict[str, object]) -> str | None:
    prompt = clean_str(data.get("prompt"))
    mode = clean_str(data.get("mode")) or "agent"
    command = clean_str(data.get("command"))
    workflow = clean_str(data.get("workflow"))
    workflow_spec = data.get("workflowSpec")
    raw_args = data.get("args", [])
    cmd_args = [str(item) for item in raw_args] if isinstance(raw_args, list) else []

    if mode not in {"agent", "shell", "steer", "drive", "workflow", "note"}:
        return "mode must be one of: agent, shell, steer, drive, workflow, note"
    if mode in {"agent", "shell", "note"} and not prompt:
        return "prompt is required"
    if mode in {"steer", "drive"} and not command:
        return "command is required"
    if mode == "workflow" and not workflow and not isinstance(workflow_spec, dict):
        return "workflow or workflowSpec is required"
    if mode in {"steer", "drive"}:
        allowed, reason = check_command_policy(mode, command, cmd_args)
        if not allowed:
            return reason
    if mode == "workflow" and workflow:
        allowed, reason = check_workflow_policy(workflow)
        if not allowed:
            return reason
    return None


def find_retry_step(job: dict[str, object]) -> list[object]:
    step_status = job.get("stepStatus", [])
    return step_status if isinstance(step_status, list) else []


def build_attempt_history(job: dict[str, object], mode: str, resume_from_step_id: str | None = None) -> list[object]:
    history = list(job.get("history", [])) if isinstance(job.get("history"), list) else []
    history.append(
        {
            "jobId": job.get("id"),
            "attempt": int(job.get("attempt", 1)),
            "status": job.get("status"),
            "mode": mode,
            "resumeFromStepId": resume_from_step_id,
            "completedAt": job.get("completedAt"),
            "summary": job.get("summary"),
        }
    )
    return history


def recover_orphaned_jobs() -> None:
    for job in list_jobs_in(JOBS_DIR):
        if job.get("status") != "running":
            continue
        job["status"] = "failed"
        job["updatedAt"] = now_iso()
        job["completedAt"] = now_iso()
        job["error"] = "listen server restarted before worker completion"
        job["summary"] = "Marked failed during server startup recovery"
        write_job(str(job["id"]), job)


class Handler(BaseHTTPRequestHandler):
    server_version = "openclaw-listen/0.2"

    def _json(self, status: int, payload: object) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self) -> dict[str, object]:
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length else b"{}"
        return json.loads(raw.decode("utf-8") or "{}")

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path == "/jobs/clear":
            self._json(HTTPStatus.OK, {"archived": archive_jobs()})
            return
        if parsed.path == "/job":
            try:
                data = self._read_json()
            except json.JSONDecodeError:
                self._json(HTTPStatus.BAD_REQUEST, {"error": "invalid json"})
                return
            error = validate_job_request(data)
            if error:
                self._json(HTTPStatus.BAD_REQUEST, {"error": error})
                return
            job_id, job = new_job_payload(data)
            write_job(job_id, job)
            spawn_worker(job_id)
            self._json(HTTPStatus.CREATED, {"job_id": job_id})
            return
        if parsed.path.startswith("/job/") and parsed.path.endswith("/retry"):
            job_id = parsed.path.split("/")[2]
            job = read_job(job_id) or read_job(job_id, archived=True)
            if not job:
                self._json(HTTPStatus.NOT_FOUND, {"error": "job not found"})
                return
            if job.get("status") not in {"failed", "stopped"}:
                self._json(HTTPStatus.BAD_REQUEST, {"error": "only failed or stopped jobs can be retried"})
                return
            try:
                request_data = self._read_json()
            except json.JSONDecodeError:
                request_data = {}
            retry_mode = clean_str(request_data.get("mode")) or "resume_failed"
            resume_from_step_id = clean_str(request_data.get("resumeFromStepId")) or None
            payload = {
                "prompt": job.get("prompt", ""),
                "mode": job.get("mode", "agent"),
                "targetAgent": job.get("targetAgent", "main"),
                "thinking": job.get("thinking"),
                "local": job.get("local", False),
                "command": job.get("command"),
                "workflow": job.get("workflow"),
                "workflowSpec": job.get("workflowSpec"),
                "args": job.get("args", []),
            }
            error = validate_job_request(payload)
            if error:
                self._json(HTTPStatus.BAD_REQUEST, {"error": error})
                return
            prior_step_status: list[object] = []
            if retry_mode == "resume_failed":
                prior_step_status = find_retry_step(job)
            elif retry_mode == "resume_from":
                prior_step_status = find_retry_step(job)
                if not resume_from_step_id:
                    self._json(HTTPStatus.BAD_REQUEST, {"error": "resumeFromStepId is required for resume_from mode"})
                    return
            elif retry_mode == "rerun_all":
                prior_step_status = []
            else:
                self._json(HTTPStatus.BAD_REQUEST, {"error": "mode must be one of: resume_failed, resume_from, rerun_all"})
                return
            new_job_id, new_job = new_job_payload(
                payload,
                attempt=int(job.get("attempt", 1)) + 1,
                retry_of=str(job.get("id")),
                prior_step_status=prior_step_status,
                retry_mode=retry_mode,
                resume_from_step_id=resume_from_step_id,
                history=build_attempt_history(job, retry_mode, resume_from_step_id),
            )
            write_job(new_job_id, new_job)
            spawn_worker(new_job_id)
            self._json(HTTPStatus.CREATED, {"job_id": new_job_id})
            return
        self._json(HTTPStatus.NOT_FOUND, {"error": "not found"})

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path == "/policy":
            self._json(HTTPStatus.OK, current_policy())
            return
        if parsed.path == "/jobs":
            archived = parse_qs(parsed.query).get("archived", ["false"])[0] == "true"
            self._json(HTTPStatus.OK, {"jobs": list_jobs_in(ARCHIVED_DIR if archived else JOBS_DIR)})
            return
        if parsed.path.startswith("/job/"):
            job_id = parsed.path.rsplit("/", 1)[-1]
            job = read_job(job_id)
            if not job:
                self._json(HTTPStatus.NOT_FOUND, {"error": "job not found"})
                return
            self._json(HTTPStatus.OK, job)
            return
        self._json(HTTPStatus.NOT_FOUND, {"error": "not found"})

    def do_DELETE(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if not parsed.path.startswith("/job/"):
            self._json(HTTPStatus.NOT_FOUND, {"error": "not found"})
            return
        job_id = parsed.path.rsplit("/", 1)[-1]
        job = read_job(job_id)
        if not job:
            self._json(HTTPStatus.NOT_FOUND, {"error": "job not found"})
            return
        proc = WORKERS.get(job_id)
        if proc and proc.poll() is None:
            try:
                os.killpg(proc.pid, signal.SIGTERM)
            except OSError:
                pass
        WORKERS.pop(job_id, None)
        job["status"] = "stopped"
        job["updatedAt"] = now_iso()
        job["completedAt"] = now_iso()
        job["summary"] = job.get("summary") or "Job stopped by operator"
        write_job(job_id, job)
        self._json(HTTPStatus.OK, {"ok": True, "job_id": job_id})


def main() -> None:
    parser = argparse.ArgumentParser(prog="listen", description="HTTP job server for OpenClaw automation")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=7600)
    args = parser.parse_args()
    recover_orphaned_jobs()
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"listen running on http://{args.host}:{args.port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
