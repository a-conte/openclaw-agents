#!/usr/bin/env python3
from __future__ import annotations

import argparse
import calendar
import json
import mimetypes
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

from artifacts import (
    archive_all_active_artifacts,
    archive_job_artifacts,
    artifact_summary,
    list_job_artifacts,
    prune_archived_artifacts,
    resolve_job_artifact,
)
from policy import check_command_policy, check_workflow_policy, current_policy, policy_admin_details
from workflow_templates import (
    clone_custom_template,
    delete_custom_template,
    diff_template_versions,
    get_template,
    list_custom_templates,
    list_template_versions,
    list_templates,
    restore_template_version,
    save_custom_template,
)


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


def _duration_ms(job: dict[str, object]) -> int | None:
    started_at = clean_str(job.get("startedAt"))
    completed_at = clean_str(job.get("completedAt"))
    if not started_at or not completed_at:
        return None
    try:
        started = calendar.timegm(time.strptime(started_at, "%Y-%m-%dT%H:%M:%SZ"))
        completed = calendar.timegm(time.strptime(completed_at, "%Y-%m-%dT%H:%M:%SZ"))
    except ValueError:
        return None
    if completed < started:
        return None
    return int((completed - started) * 1000)


def _percentile(values: list[int], ratio: float) -> int | None:
    if not values:
        return None
    ordered = sorted(values)
    index = max(0, min(len(ordered) - 1, int(round((len(ordered) - 1) * ratio))))
    return int(ordered[index])


def _job_root_id(job: dict[str, object]) -> str:
    root = clean_str(job.get("retryOf"))
    history = job.get("history")
    if isinstance(history, list) and history:
        first = history[0]
        if isinstance(first, dict):
            root = clean_str(first.get("jobId")) or root
    return root or clean_str(job.get("id")) or "unknown"


def collect_job_metrics() -> dict[str, object]:
    active_jobs = list_jobs_in(JOBS_DIR)
    archived_jobs = list_jobs_in(ARCHIVED_DIR)
    all_jobs = [*active_jobs, *archived_jobs]
    status_counts: dict[str, int] = {}
    mode_counts: dict[str, int] = {}
    template_counts: dict[str, int] = {}
    template_success: dict[str, dict[str, int]] = {}
    step_failures: dict[str, int] = {}
    step_artifacts: dict[str, dict[str, int]] = {}
    policy_block_reasons: dict[str, int] = {}
    completed_durations: list[int] = []
    long_running: list[dict[str, object]] = []
    daily: dict[str, dict[str, int]] = {}
    lineage: dict[str, dict[str, object]] = {}

    for job in all_jobs:
        status = clean_str(job.get("status")) or "unknown"
        status_counts[status] = status_counts.get(status, 0) + 1
        mode = clean_str(job.get("mode")) or "unknown"
        mode_counts[mode] = mode_counts.get(mode, 0) + 1
        template_id = clean_str(job.get("templateId"))
        if template_id:
            template_counts[template_id] = template_counts.get(template_id, 0) + 1
            stats = template_success.setdefault(template_id, {"completed": 0, "failed": 0, "total": 0})
            stats["total"] += 1
            if status == "completed":
                stats["completed"] += 1
            if status in {"failed", "stopped"}:
                stats["failed"] += 1
        duration = _duration_ms(job)
        if duration is not None and status == "completed":
            completed_durations.append(duration)
        if status == "running":
            long_running.append(
                {
                    "id": job.get("id"),
                    "mode": mode,
                    "templateId": job.get("templateId"),
                    "workflow": job.get("workflow"),
                    "ageMs": _duration_ms({"startedAt": job.get("startedAt"), "completedAt": now_iso()}) or 0,
                }
            )
        step_status = job.get("stepStatus")
        if isinstance(step_status, list):
            for step in step_status:
                if not isinstance(step, dict):
                    continue
                step_name = clean_str(step.get("name")) or clean_str(step.get("id")) or "unknown"
                if clean_str(step.get("status")) == "failed":
                    step_failures[step_name] = step_failures.get(step_name, 0) + 1
                artifacts = step.get("artifacts")
                if isinstance(artifacts, dict) and artifacts:
                    stats = step_artifacts.setdefault(step_name, {"count": 0, "bytes": 0})
                    for value in artifacts.values():
                        if isinstance(value, dict):
                            stats["count"] += 1
                            size = value.get("size")
                            if isinstance(size, int):
                                stats["bytes"] += size
        policy = job.get("policy")
        if isinstance(policy, dict) and policy.get("allowed") is False:
            reason = clean_str(policy.get("reason")) or "blocked"
            policy_block_reasons[reason] = policy_block_reasons.get(reason, 0) + 1
        created_at = clean_str(job.get("createdAt"))
        day = created_at[:10] if len(created_at) >= 10 else ""
        if day:
            bucket = daily.setdefault(day, {"total": 0, "completed": 0, "failed": 0, "blocked": 0})
            bucket["total"] += 1
            if status == "completed":
                bucket["completed"] += 1
            if status in {"failed", "stopped"}:
                bucket["failed"] += 1
            if isinstance(policy, dict) and policy.get("allowed") is False:
                bucket["blocked"] += 1
        root_id = _job_root_id(job)
        chain = lineage.setdefault(
            root_id,
            {"rootJobId": root_id, "attempts": 0, "latestJobId": None, "latestStatus": None, "templateId": None, "updatedAt": "", "jobIds": []},
        )
        chain["attempts"] = int(chain.get("attempts", 0)) + 1
        chain["latestJobId"] = job.get("id")
        chain["latestStatus"] = status
        chain["templateId"] = job.get("templateId")
        chain["updatedAt"] = clean_str(job.get("updatedAt") or job.get("completedAt") or job.get("createdAt"))
        job_ids = chain.get("jobIds")
        if isinstance(job_ids, list):
            job_ids.append(job.get("id"))

    avg_duration_ms = int(sum(completed_durations) / len(completed_durations)) if completed_durations else None
    return {
        "jobs": {
            "active": len(active_jobs),
            "archived": len(archived_jobs),
            "total": len(all_jobs),
            "statusCounts": status_counts,
            "modeCounts": mode_counts,
            "averageCompletedDurationMs": avg_duration_ms,
            "medianCompletedDurationMs": _percentile(completed_durations, 0.5),
            "p95CompletedDurationMs": _percentile(completed_durations, 0.95),
        },
        "templates": {
            "total": len(list_templates()),
            "custom": len(list_custom_templates()),
            "usage": sorted(
                [{"templateId": template_id, "count": count} for template_id, count in template_counts.items()],
                key=lambda item: (-int(item["count"]), str(item["templateId"])),
            )[:10],
            "performance": sorted(
                [
                    {
                        "templateId": template_id,
                        "total": stats["total"],
                        "completed": stats["completed"],
                        "failed": stats["failed"],
                        "successRate": round((stats["completed"] / stats["total"]) * 100, 1) if stats["total"] else 0.0,
                    }
                    for template_id, stats in template_success.items()
                ],
                key=lambda item: (-int(item["total"]), str(item["templateId"])),
            )[:10],
        },
        "steps": {
            "topFailures": sorted(
                [{"name": name, "count": count} for name, count in step_failures.items()],
                key=lambda item: (-int(item["count"]), str(item["name"])),
            )[:10],
            "artifactVolume": sorted(
                [{"name": name, "count": stats["count"], "bytes": stats["bytes"]} for name, stats in step_artifacts.items()],
                key=lambda item: (-int(item["bytes"]), str(item["name"])),
            )[:10],
        },
        "policy": {
            "blockedJobs": sum(policy_block_reasons.values()),
            "topBlockReasons": sorted(
                [{"reason": reason, "count": count} for reason, count in policy_block_reasons.items()],
                key=lambda item: (-int(item["count"]), str(item["reason"])),
            )[:10],
        },
        "longRunning": sorted(long_running, key=lambda item: -int(item.get("ageMs") or 0))[:10],
        "trends": sorted(
            [{"date": day, **counts} for day, counts in daily.items()],
            key=lambda item: str(item["date"]),
        )[-14:],
        "lineage": {
            "recentChains": sorted(
                list(lineage.values()),
                key=lambda item: str(item.get("updatedAt") or ""),
            )[-10:],
        },
        "artifacts": artifact_summary(),
    }


def wait_for_job(job_id: str, *, timeout: float = 300.0, poll_interval: float = 1.0) -> dict[str, object]:
    deadline = time.time() + max(timeout, 0.1)
    while True:
        job = read_job(job_id)
        if not job:
            raise FileNotFoundError(f"job not found: {job_id}")
        if clean_str(job.get("status")) in {"completed", "failed", "stopped"}:
            return job
        if time.time() >= deadline:
            raise TimeoutError(f"timed out waiting for job {job_id}")
        time.sleep(max(poll_interval, 0.1))


def archive_jobs() -> int:
    count = 0
    for path in JOBS_DIR.glob("*.json"):
        shutil.move(str(path), str(ARCHIVED_DIR / path.name))
        archive_job_artifacts(path.stem)
        count += 1
    archive_all_active_artifacts()
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
    template_id_raw = data.get("templateId")
    template_inputs_raw = data.get("templateInputs")
    command = command_raw.strip() if isinstance(command_raw, str) else ""
    workflow = workflow_raw.strip() if isinstance(workflow_raw, str) else ""
    template_id = template_id_raw.strip() if isinstance(template_id_raw, str) else ""
    template_inputs = template_inputs_raw if isinstance(template_inputs_raw, dict) else {}
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
        "templateId": template_id or None,
        "templateInputs": template_inputs or None,
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
    template_id = clean_str(data.get("templateId"))
    raw_args = data.get("args", [])
    cmd_args = [str(item) for item in raw_args] if isinstance(raw_args, list) else []

    if mode not in {"agent", "shell", "steer", "drive", "workflow", "note"}:
        return "mode must be one of: agent, shell, steer, drive, workflow, note"
    if mode in {"agent", "shell", "note"} and not prompt:
        return "prompt is required"
    if mode in {"steer", "drive"} and not command:
        return "command is required"
    if mode == "workflow" and not workflow and not isinstance(workflow_spec, dict) and not template_id:
        return "workflow, workflowSpec, or templateId is required"
    if mode in {"steer", "drive"}:
        allowed, reason = check_command_policy(mode, command, cmd_args)
        if not allowed:
            return reason
    if mode == "workflow" and template_id and get_template(template_id) is None:
        return f"Unknown workflow template: {template_id}"
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
        if parsed.path == "/artifacts/prune":
            try:
                data = self._read_json()
            except json.JSONDecodeError:
                self._json(HTTPStatus.BAD_REQUEST, {"error": "invalid json"})
                return
            days = data.get("olderThanDays", 30)
            try:
                result = prune_archived_artifacts(int(days))
            except ValueError as exc:
                self._json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})
                return
            self._json(HTTPStatus.OK, result)
            return
        if parsed.path == "/templates":
            try:
                data = self._read_json()
            except json.JSONDecodeError:
                self._json(HTTPStatus.BAD_REQUEST, {"error": "invalid json"})
                return
            try:
                template = save_custom_template(data)
            except ValueError as exc:
                self._json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})
                return
            self._json(HTTPStatus.CREATED, template)
            return
        if parsed.path.startswith("/templates/") and parsed.path.endswith("/clone"):
            template_id = parsed.path.split("/")[2]
            try:
                data = self._read_json()
            except json.JSONDecodeError:
                data = {}
            try:
                template = clone_custom_template(
                    template_id,
                    new_template_id=clean_str(data.get("id")) or None,
                    new_name=clean_str(data.get("name")) or None,
                )
            except ValueError as exc:
                self._json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})
                return
            self._json(HTTPStatus.CREATED, template)
            return
        if parsed.path.startswith("/templates/") and parsed.path.endswith("/restore"):
            template_id = parsed.path.split("/")[2]
            try:
                data = self._read_json()
            except json.JSONDecodeError:
                self._json(HTTPStatus.BAD_REQUEST, {"error": "invalid json"})
                return
            version = int(data.get("version", 0))
            try:
                template = restore_template_version(template_id, version)
            except ValueError as exc:
                self._json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})
                return
            self._json(HTTPStatus.OK, template)
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
        if parsed.path == "/agent/execute":
            try:
                data = self._read_json()
            except json.JSONDecodeError:
                self._json(HTTPStatus.BAD_REQUEST, {"error": "invalid json"})
                return
            wait = bool(data.get("wait", False))
            timeout = float(data.get("timeout", 300.0))
            poll_interval = float(data.get("pollInterval", 1.0))
            job_data = data.get("job") if isinstance(data.get("job"), dict) else data
            if not isinstance(job_data, dict):
                self._json(HTTPStatus.BAD_REQUEST, {"error": "job payload must be an object"})
                return
            error = validate_job_request(job_data)
            if error:
                self._json(HTTPStatus.BAD_REQUEST, {"error": error})
                return
            job_id, job = new_job_payload(job_data)
            write_job(job_id, job)
            spawn_worker(job_id)
            if wait:
                try:
                    completed = wait_for_job(job_id, timeout=timeout, poll_interval=poll_interval)
                except TimeoutError as exc:
                    self._json(HTTPStatus.REQUEST_TIMEOUT, {"error": str(exc), "job_id": job_id})
                    return
                self._json(HTTPStatus.OK, {"job_id": job_id, "job": completed, "waited": True})
                return
            self._json(HTTPStatus.CREATED, {"job_id": job_id, "waited": False})
            return
        if parsed.path.startswith("/agent/job/") and parsed.path.endswith("/wait"):
            job_id = parsed.path.split("/")[3]
            job = read_job(job_id) or read_job(job_id, archived=True)
            if not job:
                self._json(HTTPStatus.NOT_FOUND, {"error": "job not found"})
                return
            try:
                data = self._read_json()
            except json.JSONDecodeError:
                data = {}
            timeout = float(data.get("timeout", 300.0))
            poll_interval = float(data.get("pollInterval", 1.0))
            try:
                completed = wait_for_job(job_id, timeout=timeout, poll_interval=poll_interval)
            except TimeoutError as exc:
                self._json(HTTPStatus.REQUEST_TIMEOUT, {"error": str(exc), "job_id": job_id})
                return
            self._json(HTTPStatus.OK, {"job_id": job_id, "job": completed, "waited": True})
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
                "templateId": job.get("templateId"),
                "templateInputs": job.get("templateInputs"),
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
        if parsed.path.startswith("/agent/job/") and parsed.path.endswith("/retry"):
            job_id = parsed.path.split("/")[3]
            job = read_job(job_id) or read_job(job_id, archived=True)
            if not job:
                self._json(HTTPStatus.NOT_FOUND, {"error": "job not found"})
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
                "templateId": job.get("templateId"),
                "templateInputs": job.get("templateInputs"),
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
            self._json(HTTPStatus.CREATED, {"job_id": new_job_id, "job": new_job})
            return
        self._json(HTTPStatus.NOT_FOUND, {"error": "not found"})

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path == "/artifacts/admin":
            self._json(HTTPStatus.OK, artifact_summary())
            return
        if parsed.path == "/metrics":
            self._json(HTTPStatus.OK, collect_job_metrics())
            return
        if parsed.path == "/policy":
            self._json(HTTPStatus.OK, current_policy())
            return
        if parsed.path == "/policy/admin":
            self._json(HTTPStatus.OK, policy_admin_details())
            return
        if parsed.path == "/templates":
            self._json(HTTPStatus.OK, {"templates": list_templates()})
            return
        if parsed.path == "/agent/templates":
            self._json(HTTPStatus.OK, {"templates": list_templates()})
            return
        if parsed.path == "/templates/custom":
            self._json(HTTPStatus.OK, {"templates": list_custom_templates()})
            return
        if parsed.path.startswith("/agent/templates/") and parsed.path.endswith("/versions"):
            template_id = parsed.path.split("/")[3]
            versions = list_template_versions(template_id)
            if not versions:
                self._json(HTTPStatus.NOT_FOUND, {"error": "template not found"})
                return
            self._json(HTTPStatus.OK, {"versions": versions})
            return
        if parsed.path.startswith("/templates/") and parsed.path.endswith("/diff"):
            template_id = parsed.path.split("/")[2]
            query = parse_qs(parsed.query)
            try:
                from_version = int(query.get("from", ["0"])[0])
                to_raw = query.get("to", [""])[0]
                to_version = int(to_raw) if to_raw else None
                payload = diff_template_versions(template_id, from_version, to_version)
            except ValueError as exc:
                self._json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})
                return
            self._json(HTTPStatus.OK, payload)
            return
        if parsed.path.startswith("/agent/templates/") and parsed.path.endswith("/diff"):
            template_id = parsed.path.split("/")[3]
            query = parse_qs(parsed.query)
            try:
                from_version = int(query.get("from", ["0"])[0])
                to_raw = query.get("to", [""])[0]
                to_version = int(to_raw) if to_raw else None
                payload = diff_template_versions(template_id, from_version, to_version)
            except ValueError as exc:
                self._json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})
                return
            self._json(HTTPStatus.OK, payload)
            return
        if parsed.path.startswith("/templates/") and parsed.path.endswith("/versions"):
            template_id = parsed.path.split("/")[2]
            versions = list_template_versions(template_id)
            if not versions:
                self._json(HTTPStatus.NOT_FOUND, {"error": "template not found"})
                return
            self._json(HTTPStatus.OK, {"versions": versions})
            return
        if parsed.path == "/jobs":
            archived = parse_qs(parsed.query).get("archived", ["false"])[0] == "true"
            self._json(HTTPStatus.OK, {"jobs": list_jobs_in(ARCHIVED_DIR if archived else JOBS_DIR)})
            return
        if parsed.path.startswith("/job/") and parsed.path.endswith("/artifacts"):
            job_id = parsed.path.split("/")[2]
            job = read_job(job_id)
            archived = False
            if not job:
                job = read_job(job_id, archived=True)
                archived = True
            if not job:
                self._json(HTTPStatus.NOT_FOUND, {"error": "job not found"})
                return
            self._json(HTTPStatus.OK, {"artifacts": list_job_artifacts(job_id, archived=archived)})
            return
        if parsed.path.startswith("/agent/job/") and parsed.path.endswith("/artifacts"):
            job_id = parsed.path.split("/")[3]
            job = read_job(job_id)
            archived = False
            if not job:
                job = read_job(job_id, archived=True)
                archived = True
            if not job:
                self._json(HTTPStatus.NOT_FOUND, {"error": "job not found"})
                return
            self._json(HTTPStatus.OK, {"artifacts": list_job_artifacts(job_id, archived=archived)})
            return
        if parsed.path.startswith("/job/") and parsed.path.endswith("/artifact"):
            job_id = parsed.path.split("/")[2]
            job = read_job(job_id)
            archived = False
            if not job:
                job = read_job(job_id, archived=True)
                archived = True
            if not job:
                self._json(HTTPStatus.NOT_FOUND, {"error": "job not found"})
                return
            relative_path = parse_qs(parsed.query).get("path", [""])[0]
            artifact_path = resolve_job_artifact(job_id, relative_path, archived=archived)
            if artifact_path is None:
                self._json(HTTPStatus.NOT_FOUND, {"error": "artifact not found"})
                return
            body = artifact_path.read_bytes()
            mime_type, _ = mimetypes.guess_type(str(artifact_path))
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", mime_type or "application/octet-stream")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if parsed.path.startswith("/agent/job/"):
            job_id = parsed.path.split("/")[3]
            job = read_job(job_id)
            if not job:
                job = read_job(job_id, archived=True)
            if not job:
                self._json(HTTPStatus.NOT_FOUND, {"error": "job not found"})
                return
            self._json(HTTPStatus.OK, job)
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
        if parsed.path.startswith("/templates/"):
            template_id = parsed.path.rsplit("/", 1)[-1]
            if not template_id:
                self._json(HTTPStatus.BAD_REQUEST, {"error": "template id required"})
                return
            deleted = delete_custom_template(template_id)
            if not deleted:
                self._json(HTTPStatus.NOT_FOUND, {"error": "template not found"})
                return
            self._json(HTTPStatus.OK, {"ok": True, "deleted": template_id})
            return
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

    def do_PUT(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path.startswith("/templates/"):
            template_id = parsed.path.rsplit("/", 1)[-1]
            try:
                data = self._read_json()
            except json.JSONDecodeError:
                self._json(HTTPStatus.BAD_REQUEST, {"error": "invalid json"})
                return
            data["id"] = template_id
            try:
                template = save_custom_template(data)
            except ValueError as exc:
                self._json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})
                return
            self._json(HTTPStatus.OK, template)
            return
        self._json(HTTPStatus.NOT_FOUND, {"error": "not found"})


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
