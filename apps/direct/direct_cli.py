#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import time
import urllib.request


def request_json(url: str, method: str = "GET", payload: dict[str, object] | None = None) -> dict[str, object]:
    headers = {"Content-Type": "application/json"}
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))


def wait_for_job(base: str, job_id: str, *, timeout: float, poll_interval: float) -> dict[str, object]:
    deadline = time.time() + timeout
    while True:
        payload = request_json(f"{base}/job/{job_id}")
        status = str(payload.get("status") or "")
        if status in {"completed", "failed", "stopped"}:
            return payload
        if time.time() >= deadline:
            raise SystemExit(f"timed out waiting for job {job_id}")
        time.sleep(poll_interval)


def main() -> None:
    parser = argparse.ArgumentParser(prog="direct", description="CLI client for the listen job server")
    parser.add_argument("--base-url", default="http://127.0.0.1:7600")
    sub = parser.add_subparsers(dest="subcommand", required=True)

    start = sub.add_parser("start")
    start.add_argument("--prompt")
    start.add_argument("--mode", default="agent")
    start.add_argument("--agent", default="main")
    start.add_argument("--thinking")
    start.add_argument("--local", action="store_true")
    start.add_argument("--command")
    start.add_argument("--workflow")
    start.add_argument("--template")
    start.add_argument("--input", action="append", default=[])
    start.add_argument("--arg", action="append", default=[])
    start.add_argument("--workflow-spec-file")
    start.add_argument("--wait", action="store_true")
    start.add_argument("--timeout", type=float, default=300.0)
    start.add_argument("--poll-interval", type=float, default=1.0)

    sub.add_parser("templates")

    get = sub.add_parser("get")
    get.add_argument("--job-id", required=True)

    list_cmd = sub.add_parser("list")
    list_cmd.add_argument("--archived", action="store_true")

    latest = sub.add_parser("latest")
    latest.add_argument("count", nargs="?", type=int, default=1)
    latest.add_argument("--archived", action="store_true")

    sub.add_parser("clear")

    stop = sub.add_parser("stop")
    stop.add_argument("--job-id", required=True)

    retry = sub.add_parser("retry")
    retry.add_argument("--job-id", required=True)
    retry.add_argument("--wait", action="store_true")
    retry.add_argument("--timeout", type=float, default=300.0)
    retry.add_argument("--poll-interval", type=float, default=1.0)

    wait_cmd = sub.add_parser("wait")
    wait_cmd.add_argument("--job-id", required=True)
    wait_cmd.add_argument("--timeout", type=float, default=300.0)
    wait_cmd.add_argument("--poll-interval", type=float, default=1.0)

    args = parser.parse_args()
    base = args.base_url.rstrip("/")

    if args.subcommand == "start":
        if args.mode in {"agent", "shell", "note"} and not args.prompt:
            raise SystemExit("--prompt is required for agent, shell, and note modes")
        if args.mode in {"steer", "drive"} and not args.command:
            raise SystemExit("--command is required for steer and drive modes")
        if args.mode == "workflow" and not args.workflow and not args.workflow_spec_file and not args.template:
            raise SystemExit("--workflow, --template, or --workflow-spec-file is required for workflow mode")
        workflow_spec = None
        if args.workflow_spec_file:
            with open(args.workflow_spec_file, "r", encoding="utf-8") as handle:
                workflow_spec = json.load(handle)
        template_inputs: dict[str, str] = {}
        for item in args.input:
            if "=" not in item:
                raise SystemExit("--input must use key=value")
            key, value = item.split("=", 1)
            template_inputs[key.strip()] = value.strip()
        payload = {
            "prompt": args.prompt,
            "mode": args.mode,
            "targetAgent": args.agent,
            "thinking": args.thinking,
            "local": args.local,
            "command": args.command,
            "workflow": args.workflow,
            "templateId": args.template,
            "templateInputs": template_inputs or None,
            "args": args.arg,
            "workflowSpec": workflow_spec,
        }
        created = request_json(f"{base}/job", "POST", payload)
        if args.wait:
            job_id = str(created.get("job_id") or "")
            if not job_id:
                raise SystemExit("listen did not return a job_id")
            print(json.dumps(wait_for_job(base, job_id, timeout=max(args.timeout, 0.1), poll_interval=max(args.poll_interval, 0.1)), indent=2))
            return
        print(json.dumps(created, indent=2))
        return

    if args.subcommand == "templates":
        print(json.dumps(request_json(f"{base}/templates"), indent=2))
        return

    if args.subcommand == "get":
        print(json.dumps(request_json(f"{base}/job/{args.job_id}"), indent=2))
        return

    if args.subcommand == "list":
        suffix = "?archived=true" if args.archived else ""
        print(json.dumps(request_json(f"{base}/jobs{suffix}"), indent=2))
        return

    if args.subcommand == "latest":
        suffix = "?archived=true" if args.archived else ""
        payload = request_json(f"{base}/jobs{suffix}")
        jobs = payload.get("jobs", [])
        latest_jobs = jobs[: max(args.count, 0)]
        print(json.dumps({"jobs": latest_jobs}, indent=2))
        return

    if args.subcommand == "clear":
        print(json.dumps(request_json(f"{base}/jobs/clear", "POST"), indent=2))
        return

    if args.subcommand == "stop":
        print(json.dumps(request_json(f"{base}/job/{args.job_id}", "DELETE"), indent=2))
        return

    if args.subcommand == "retry":
        created = request_json(f"{base}/job/{args.job_id}/retry", "POST")
        if args.wait:
            job_id = str(created.get("job_id") or "")
            if not job_id:
                raise SystemExit("listen did not return a job_id")
            print(json.dumps(wait_for_job(base, job_id, timeout=max(args.timeout, 0.1), poll_interval=max(args.poll_interval, 0.1)), indent=2))
            return
        print(json.dumps(created, indent=2))
        return

    if args.subcommand == "wait":
        print(json.dumps(wait_for_job(base, args.job_id, timeout=max(args.timeout, 0.1), poll_interval=max(args.poll_interval, 0.1)), indent=2))
        return


if __name__ == "__main__":
    main()
