#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import signal
import subprocess
import sys
import time
import uuid
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
JOBS_DIR = Path(__file__).resolve().parent / "jobs"
JOBS_DIR.mkdir(exist_ok=True)
WORKERS: dict[str, subprocess.Popen[str]] = {}


def now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def write_job(job_id: str, payload: dict[str, object]) -> None:
    (JOBS_DIR / f"{job_id}.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")


def read_job(job_id: str) -> dict[str, object] | None:
    path = JOBS_DIR / f"{job_id}.json"
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def list_jobs() -> list[dict[str, object]]:
    jobs: list[dict[str, object]] = []
    for path in sorted(JOBS_DIR.glob("*.json"), reverse=True):
        jobs.append(json.loads(path.read_text(encoding="utf-8")))
    return jobs


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


class Handler(BaseHTTPRequestHandler):
    server_version = "openclaw-listen/0.1"

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
        if self.path != "/job":
            self._json(HTTPStatus.NOT_FOUND, {"error": "not found"})
            return
        try:
            data = self._read_json()
        except json.JSONDecodeError:
            self._json(HTTPStatus.BAD_REQUEST, {"error": "invalid json"})
            return
        prompt = str(data.get("prompt", "")).strip()
        mode = str(data.get("mode", "agent")).strip() or "agent"
        target_agent = str(data.get("targetAgent", "main")).strip() or "main"
        thinking_raw = data.get("thinking")
        thinking = ""
        if isinstance(thinking_raw, str):
            thinking = thinking_raw.strip()
        local = bool(data.get("local", False))
        if not prompt:
            self._json(HTTPStatus.BAD_REQUEST, {"error": "prompt is required"})
            return
        job_id = uuid.uuid4().hex[:10]
        job = {
            "id": job_id,
            "prompt": prompt,
            "mode": mode,
            "targetAgent": target_agent,
            "status": "running",
            "createdAt": now_iso(),
            "startedAt": now_iso(),
            "updatedAt": now_iso(),
            "result": None,
            "error": None,
            "session": f"listen-{job_id}",
            "thinking": thinking or None,
            "local": local,
        }
        write_job(job_id, job)
        spawn_worker(job_id)
        self._json(HTTPStatus.CREATED, {"job_id": job_id})

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/jobs":
            self._json(HTTPStatus.OK, {"jobs": list_jobs()})
            return
        if self.path.startswith("/job/"):
            job_id = self.path.rsplit("/", 1)[-1]
            job = read_job(job_id)
            if not job:
                self._json(HTTPStatus.NOT_FOUND, {"error": "job not found"})
                return
            self._json(HTTPStatus.OK, job)
            return
        self._json(HTTPStatus.NOT_FOUND, {"error": "not found"})

    def do_DELETE(self) -> None:  # noqa: N802
        if not self.path.startswith("/job/"):
            self._json(HTTPStatus.NOT_FOUND, {"error": "not found"})
            return
        job_id = self.path.rsplit("/", 1)[-1]
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
        job["status"] = "stopped"
        job["updatedAt"] = now_iso()
        write_job(job_id, job)
        self._json(HTTPStatus.OK, {"ok": True, "job_id": job_id})


def main() -> None:
    parser = argparse.ArgumentParser(prog="listen", description="HTTP job server for OpenClaw automation")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=7600)
    args = parser.parse_args()
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"listen running on http://{args.host}:{args.port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
