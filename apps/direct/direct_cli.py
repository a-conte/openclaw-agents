#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import urllib.request


def request_json(url: str, method: str = "GET", payload: dict[str, object] | None = None) -> dict[str, object]:
    headers = {"Content-Type": "application/json"}
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main() -> None:
    parser = argparse.ArgumentParser(prog="direct", description="CLI client for the listen job server")
    parser.add_argument("--base-url", default="http://127.0.0.1:7600")
    sub = parser.add_subparsers(dest="command", required=True)

    start = sub.add_parser("start")
    start.add_argument("--prompt")
    start.add_argument("--mode", default="agent")
    start.add_argument("--agent", default="main")
    start.add_argument("--thinking")
    start.add_argument("--local", action="store_true")
    start.add_argument("--command")
    start.add_argument("--arg", action="append", default=[])

    get = sub.add_parser("get")
    get.add_argument("--job-id", required=True)

    sub.add_parser("list")

    stop = sub.add_parser("stop")
    stop.add_argument("--job-id", required=True)

    args = parser.parse_args()
    base = args.base_url.rstrip("/")
    if args.command == "start":
        if args.mode in {"agent", "shell", "note"} and not args.prompt:
            raise SystemExit("--prompt is required for agent, shell, and note modes")
        if args.mode in {"steer", "drive"} and not args.command:
            raise SystemExit("--command is required for steer and drive modes")
        payload = {
            "prompt": args.prompt,
            "mode": args.mode,
            "targetAgent": args.agent,
            "thinking": args.thinking,
            "local": args.local,
            "command": args.command,
            "args": args.arg,
        }
        print(json.dumps(request_json(f"{base}/job", "POST", payload), indent=2))
        return
    if args.command == "get":
        print(json.dumps(request_json(f"{base}/job/{args.job_id}"), indent=2))
        return
    if args.command == "list":
        print(json.dumps(request_json(f"{base}/jobs"), indent=2))
        return
    if args.command == "stop":
        print(json.dumps(request_json(f"{base}/job/{args.job_id}", "DELETE"), indent=2))
        return


if __name__ == "__main__":
    main()
