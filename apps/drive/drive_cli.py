#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import shlex
import signal
import subprocess
import sys
import time
import uuid
from dataclasses import asdict, dataclass


def run_cmd(args: list[str], *, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(args, text=True, capture_output=True, check=check)


def fail(message: str, code: int = 1) -> None:
    print(message, file=sys.stderr)
    raise SystemExit(code)


def tmux(args: list[str], *, check: bool = True) -> subprocess.CompletedProcess[str]:
    return run_cmd(["tmux", *args], check=check)


@dataclass
class Pane:
    session: str
    pane_id: str
    pane_pid: int
    pane_current_command: str


def list_panes() -> list[Pane]:
    result = tmux(
        [
            "list-panes",
            "-a",
            "-F",
            "#{session_name}\t#{pane_id}\t#{pane_pid}\t#{pane_current_command}",
        ],
        check=False,
    )
    if result.returncode != 0:
        return []
    panes: list[Pane] = []
    for line in result.stdout.strip().splitlines():
        if not line.strip():
            continue
        session, pane_id, pane_pid, pane_current_command = line.split("\t", 3)
        panes.append(
            Pane(
                session=session,
                pane_id=pane_id,
                pane_pid=int(pane_pid),
                pane_current_command=pane_current_command,
            )
        )
    return panes


def session_exists(name: str) -> bool:
    return tmux(["has-session", "-t", name], check=False).returncode == 0


def ensure_session(name: str) -> None:
    if not session_exists(name):
        fail(f'tmux session "{name}" not found')


def create_session(name: str, cwd: str | None) -> dict[str, object]:
    if session_exists(name):
        return {"ok": True, "created": False, "session": name}
    args = ["new-session", "-d", "-s", name]
    if cwd:
        args.extend(["-c", cwd])
    tmux(args)
    return {"ok": True, "created": True, "session": name}


def list_sessions() -> list[dict[str, object]]:
    result = tmux(
        ["list-sessions", "-F", "#{session_name}\t#{session_id}\t#{session_windows}\t#{session_created}"],
        check=False,
    )
    if result.returncode != 0:
        return []
    out: list[dict[str, object]] = []
    for line in result.stdout.strip().splitlines():
        if not line.strip():
            continue
        name, session_id, windows, created = line.split("\t", 3)
        out.append(
            {
                "name": name,
                "sessionId": session_id,
                "windows": int(windows),
                "createdEpoch": int(created),
            }
        )
    return out


def shell_join(command: str) -> str:
    token = f"__DONE_{uuid.uuid4().hex[:10]}"
    wrapped = f"{command}; printf '\\n{token}:%s\\n' \"$?\""
    return token, wrapped


def cmd_run(session: str, command: str, timeout: float, poll_interval: float) -> dict[str, object]:
    ensure_session(session)
    token, wrapped = shell_join(command)
    tmux(["send-keys", "-t", session, wrapped, "C-m"])
    deadline = time.time() + timeout
    output = ""
    exit_code: int | None = None
    while time.time() < deadline:
        output = tmux(["capture-pane", "-p", "-t", session, "-S", "-200"]).stdout
        marker = next((line for line in output.splitlines() if line.startswith(f"{token}:")), None)
        if marker:
            try:
                exit_code = int(marker.split(":", 1)[1])
            except ValueError:
                exit_code = None
            break
        time.sleep(poll_interval)
    if exit_code is None:
        return {"ok": False, "session": session, "timedOut": True, "token": token, "output": output}
    cleaned = "\n".join(line for line in output.splitlines() if not line.startswith(token))
    return {"ok": exit_code == 0, "session": session, "exitCode": exit_code, "timedOut": False, "output": cleaned}


def cmd_logs(session: str, lines: int) -> dict[str, object]:
    ensure_session(session)
    start = f"-{max(lines, 1)}"
    output = tmux(["capture-pane", "-p", "-t", session, "-S", start]).stdout
    return {"ok": True, "session": session, "lines": lines, "output": output}


@dataclass
class ProcInfo:
    pid: int
    ppid: int
    name: str
    command: str
    cpu: float
    memory_mb: float
    elapsed: str
    session: str | None


def parse_ps() -> list[ProcInfo]:
    fmt = "pid=,ppid=,%cpu=,rss=,etime=,comm=,args="
    result = run_cmd(["ps", "-axo", fmt], check=True)
    pane_sessions = {pane.pane_pid: pane.session for pane in list_panes()}
    processes: list[ProcInfo] = []
    for raw in result.stdout.splitlines():
        line = raw.strip()
        if not line:
            continue
        parts = line.split(None, 6)
        if len(parts) < 7:
            continue
        pid, ppid, cpu, rss, elapsed, comm, args = parts
        processes.append(
            ProcInfo(
                pid=int(pid),
                ppid=int(ppid),
                name=os.path.basename(comm),
                command=args,
                cpu=float(cpu),
                memory_mb=round(int(rss) / 1024, 1),
                elapsed=elapsed,
                session=pane_sessions.get(int(ppid)) or pane_sessions.get(int(pid)),
            )
        )
    return processes


def descendants(pid: int, processes: list[ProcInfo]) -> list[int]:
    by_parent: dict[int, list[int]] = {}
    for proc in processes:
        by_parent.setdefault(proc.ppid, []).append(proc.pid)
    ordered: list[int] = []
    stack = [pid]
    seen = set()
    while stack:
        current = stack.pop()
        for child in by_parent.get(current, []):
            if child in seen:
                continue
            seen.add(child)
            ordered.append(child)
            stack.append(child)
    return ordered


def cmd_proc_list(name: str | None, session: str | None, parent: int | None) -> dict[str, object]:
    processes = parse_ps()
    filtered = processes
    if name:
        needle = name.lower()
        filtered = [p for p in filtered if needle in p.name.lower() or needle in p.command.lower()]
    if session:
        filtered = [p for p in filtered if p.session == session]
    if parent is not None:
        filtered = [p for p in filtered if p.ppid == parent]
    return {"ok": True, "processes": [asdict(p) for p in filtered]}


def cmd_proc_kill(pid: int | None, name: str | None, sig: int, tree: bool) -> dict[str, object]:
    if pid is None and not name:
        fail("provide a pid or --name")
    processes = parse_ps()
    matches: list[int] = []
    if pid is not None:
        matches.append(pid)
    if name:
        needle = name.lower()
        matches.extend(p.pid for p in processes if needle in p.name.lower() or needle in p.command.lower())
    unique: list[int] = []
    for item in matches:
        if item not in unique:
            unique.append(item)
    if tree:
        expanded = list(unique)
        for root in list(unique):
            expanded.extend(descendants(root, processes))
        unique = []
        for item in expanded:
            if item not in unique:
                unique.append(item)
    killed: list[int] = []
    failed: list[dict[str, object]] = []
    for target in unique:
        try:
            os.kill(target, sig)
            killed.append(target)
        except OSError as exc:
            failed.append({"pid": target, "error": str(exc)})
    return {"ok": not failed, "action": "kill", "signal": sig, "killed": killed, "failed": failed}


def print_result(data: dict[str, object], as_json: bool) -> None:
    if as_json:
        print(json.dumps(data, indent=2))
        return
    if "output" in data and isinstance(data["output"], str):
        meta = {k: v for k, v in data.items() if k != "output"}
        print(json.dumps(meta, indent=2))
        print(data["output"])
        return
    print(json.dumps(data, indent=2))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="drive", description="tmux and process control for OpenClaw")
    subparsers = parser.add_subparsers(dest="command", required=True)

    session = subparsers.add_parser("session")
    session_sub = session.add_subparsers(dest="session_command", required=True)
    session_create = session_sub.add_parser("create")
    session_create.add_argument("--name", required=True)
    session_create.add_argument("--cwd")
    session_create.add_argument("--json", action="store_true")
    session_list = session_sub.add_parser("list")
    session_list.add_argument("--json", action="store_true")
    session_kill = session_sub.add_parser("kill")
    session_kill.add_argument("--name", required=True)
    session_kill.add_argument("--json", action="store_true")

    run = subparsers.add_parser("run")
    run.add_argument("--session", required=True)
    run.add_argument("--timeout", type=float, default=120.0)
    run.add_argument("--poll-interval", type=float, default=0.5)
    run.add_argument("--json", action="store_true")
    run.add_argument("command_text")

    logs = subparsers.add_parser("logs")
    logs.add_argument("--session", required=True)
    logs.add_argument("--lines", type=int, default=80)
    logs.add_argument("--json", action="store_true")

    proc = subparsers.add_parser("proc")
    proc_sub = proc.add_subparsers(dest="proc_command", required=True)
    proc_list = proc_sub.add_parser("list")
    proc_list.add_argument("--name")
    proc_list.add_argument("--session")
    proc_list.add_argument("--parent", type=int)
    proc_list.add_argument("--json", action="store_true")
    proc_kill = proc_sub.add_parser("kill")
    proc_kill.add_argument("pid", nargs="?", type=int)
    proc_kill.add_argument("--name")
    proc_kill.add_argument("--signal", type=int, default=signal.SIGTERM)
    proc_kill.add_argument("--tree", action="store_true")
    proc_kill.add_argument("--json", action="store_true")

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    if args.command == "session":
        if args.session_command == "create":
            print_result(create_session(args.name, args.cwd), args.json)
            return
        if args.session_command == "list":
            print_result({"ok": True, "sessions": list_sessions()}, args.json)
            return
        if args.session_command == "kill":
            ensure_session(args.name)
            tmux(["kill-session", "-t", args.name])
            print_result({"ok": True, "killed": args.name}, args.json)
            return

    if args.command == "run":
        print_result(cmd_run(args.session, args.command_text, args.timeout, args.poll_interval), args.json)
        return

    if args.command == "logs":
        print_result(cmd_logs(args.session, args.lines), args.json)
        return

    if args.command == "proc":
        if args.proc_command == "list":
            print_result(cmd_proc_list(args.name, args.session, args.parent), args.json)
            return
        if args.proc_command == "kill":
            print_result(cmd_proc_kill(args.pid, args.name, args.signal, args.tree), args.json)
            return


if __name__ == "__main__":
    main()
