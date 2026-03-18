#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import re
import signal
import subprocess
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import asdict, dataclass


def run_cmd(args: list[str], *, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(args, text=True, capture_output=True, check=check)


def fail(message: str, code: int = 1) -> None:
    print(message, file=os.sys.stderr)
    raise SystemExit(code)


def tmux(args: list[str], *, check: bool = True) -> subprocess.CompletedProcess[str]:
    return run_cmd(["tmux", *args], check=check)


@dataclass
class Pane:
    session: str
    pane_id: str
    pane_pid: int
    pane_current_command: str


@dataclass
class ProcInfo:
    pid: int
    ppid: int
    name: str
    command: str
    cpu: float
    memory_mb: float
    elapsed: str
    state: str
    cwd: str | None
    session: str | None


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
        panes.append(Pane(session=session, pane_id=pane_id, pane_pid=int(pane_pid), pane_current_command=pane_current_command))
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
    result = tmux(["list-sessions", "-F", "#{session_name}\t#{session_id}\t#{session_windows}\t#{session_created}"], check=False)
    if result.returncode != 0:
        return []
    sessions = []
    for line in result.stdout.strip().splitlines():
        if not line.strip():
            continue
        name, session_id, windows, created = line.split("\t", 3)
        sessions.append({"name": name, "sessionId": session_id, "windows": int(windows), "createdEpoch": int(created)})
    return sessions


def make_sentinel(command: str) -> tuple[str, str, str]:
    token = uuid.uuid4().hex[:10]
    start_token = f"__START_{token}"
    done_token = f"__DONE_{token}"
    wrapped = f"printf '\\n{start_token}\\n'; {command}; drive_exit_code=$?; printf '\\n{done_token}:%s\\n' \"$drive_exit_code\""
    return start_token, done_token, wrapped


def extract_command_output(output: str, start_token: str, done_token: str) -> str:
    lines = output.splitlines()
    started = False
    collected: list[str] = []
    for line in lines:
        stripped = line.strip()
        if not started:
            if stripped == start_token:
                started = True
            continue
        if stripped.startswith(f"{done_token}:"):
            break
        collected.append(line)
    return "\n".join(collected).strip("\n")


def capture_pane(session: str, lines: int = 200) -> str:
    ensure_session(session)
    return tmux(["capture-pane", "-p", "-t", session, "-S", f"-{max(lines, 1)}"]).stdout


def cmd_run(session: str, command: str, timeout: float, poll_interval: float) -> dict[str, object]:
    ensure_session(session)
    start_token, done_token, wrapped = make_sentinel(command)
    tmux(["send-keys", "-t", session, wrapped, "C-m"])
    deadline = time.time() + timeout
    output = ""
    exit_code: int | None = None
    while time.time() < deadline:
        output = capture_pane(session, 400)
        marker = next((line for line in output.splitlines() if line.strip().startswith(f"{done_token}:")), None)
        if marker:
            try:
                exit_code = int(marker.strip().split(":", 1)[1])
            except ValueError:
                exit_code = None
            break
        time.sleep(poll_interval)
    if exit_code is None:
        return {"ok": False, "session": session, "timedOut": True, "token": done_token, "output": extract_command_output(output, start_token, done_token), "rawOutput": output}
    cleaned = extract_command_output(output, start_token, done_token)
    return {"ok": exit_code == 0, "session": session, "exitCode": exit_code, "timedOut": False, "output": cleaned, "rawOutput": output}


def cmd_send(session: str, text: str, enter: bool) -> dict[str, object]:
    ensure_session(session)
    args = ["send-keys", "-t", session, "-l", text]
    tmux(args)
    if enter:
        tmux(["send-keys", "-t", session, "C-m"])
    return {"ok": True, "action": "send", "session": session, "text": text, "enter": enter}


def cmd_poll(session: str, pattern: str, timeout: float, interval: float) -> dict[str, object]:
    ensure_session(session)
    compiled = re.compile(pattern)
    deadline = time.time() + timeout
    while time.time() < deadline:
        content = capture_pane(session, 400)
        match = compiled.search(content)
        if match:
            return {"ok": True, "session": session, "pattern": pattern, "match": match.group(0), "content": content}
        time.sleep(interval)
    return {"ok": False, "session": session, "pattern": pattern, "timedOut": True}


def cmd_logs(session: str, lines: int) -> dict[str, object]:
    return {"ok": True, "session": session, "lines": lines, "output": capture_pane(session, lines)}


def parse_ps() -> list[ProcInfo]:
    fmt = "pid=,ppid=,state=,%cpu=,rss=,etime=,comm=,args="
    result = run_cmd(["ps", "-axo", fmt], check=True)
    pane_sessions = {pane.pane_pid: pane.session for pane in list_panes()}
    processes: list[ProcInfo] = []
    for raw in result.stdout.splitlines():
        line = raw.strip()
        if not line:
            continue
        parts = line.split(None, 7)
        if len(parts) < 8:
            continue
        pid, ppid, state, cpu, rss, elapsed, comm, args = parts
        cwd = None
        cwd_result = run_cmd(["lsof", "-a", "-d", "cwd", "-p", pid, "-Fn"], check=False)
        if cwd_result.returncode == 0:
            for cwd_line in cwd_result.stdout.splitlines():
                if cwd_line.startswith("n"):
                    cwd = cwd_line[1:]
                    break
        processes.append(
            ProcInfo(
                pid=int(pid),
                ppid=int(ppid),
                name=os.path.basename(comm),
                command=args,
                cpu=float(cpu),
                memory_mb=round(int(rss) / 1024, 1),
                elapsed=elapsed,
                state=state,
                cwd=cwd,
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


def get_session_root_pids(session: str) -> list[int]:
    return [pane.pane_pid for pane in list_panes() if pane.session == session]


def cmd_proc_list(name: str | None, session: str | None, parent: int | None, cwd: str | None) -> dict[str, object]:
    processes = parse_ps()
    filtered = processes
    if name:
        needle = name.lower()
        filtered = [p for p in filtered if needle in p.name.lower() or needle in p.command.lower()]
    if session:
        filtered = [p for p in filtered if p.session == session]
    if parent is not None:
        filtered = [p for p in filtered if p.ppid == parent]
    if cwd:
        filtered = [p for p in filtered if p.cwd and p.cwd.startswith(cwd)]
    return {"ok": True, "count": len(filtered), "processes": [asdict(p) for p in filtered]}


def kill_targets(targets: list[int], sig: int) -> tuple[list[int], list[dict[str, object]]]:
    killed: list[int] = []
    failed: list[dict[str, object]] = []
    for target in targets:
        if target in {1, os.getpid(), os.getppid()}:
            failed.append({"pid": target, "error": "refused"})
            continue
        try:
            os.kill(target, sig)
            killed.append(target)
        except OSError as exc:
            failed.append({"pid": target, "error": str(exc)})
    return killed, failed


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
    unique = []
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
    killed, failed = kill_targets(unique, sig)
    return {"ok": not failed, "action": "kill", "signal": sig, "killed": killed, "failed": failed}


def build_tree(root: int, processes: list[ProcInfo]) -> dict[str, object]:
    proc_map = {proc.pid: proc for proc in processes}
    by_parent: dict[int, list[ProcInfo]] = {}
    for proc in processes:
        by_parent.setdefault(proc.ppid, []).append(proc)

    def build(pid: int) -> dict[str, object]:
        proc = proc_map.get(pid)
        return {
            "pid": pid,
            "name": proc.name if proc else "unknown",
            "children": [build(child.pid) for child in sorted(by_parent.get(pid, []), key=lambda item: item.pid)],
        }

    return build(root)


def cmd_proc_tree(pid: int | None, session: str | None) -> dict[str, object]:
    if pid is None and not session:
        fail("provide a pid or --session")
    if session:
        roots = get_session_root_pids(session)
        if not roots:
            fail(f"no tmux session roots found for {session}")
        pid = roots[0]
    assert pid is not None
    tree = build_tree(pid, parse_ps())
    return {"ok": True, "root": pid, "tree": tree}


def cmd_proc_top(pids: str | None, session: str | None) -> dict[str, object]:
    target_ids: list[int] = []
    if session:
        roots = get_session_root_pids(session)
        procs = parse_ps()
        for root in roots:
            target_ids.append(root)
            target_ids.extend(descendants(root, procs))
    elif pids:
        target_ids = [int(item.strip()) for item in pids.split(",") if item.strip().isdigit()]
    if not target_ids:
        fail("provide --pid or --session")
    unique = []
    for item in target_ids:
        if item not in unique:
            unique.append(item)
    snapshot = [asdict(proc) for proc in parse_ps() if proc.pid in unique]
    return {"ok": True, "snapshot": snapshot}


def cmd_fanout(command: str, targets: str, timeout: float) -> dict[str, object]:
    session_names = [item.strip() for item in targets.split(",") if item.strip()]
    if not session_names:
        fail("no targets specified")

    def run_one(session_name: str) -> dict[str, object]:
        return cmd_run(session_name, command, timeout, 0.5)

    results: list[dict[str, object]] = []
    with ThreadPoolExecutor(max_workers=len(session_names)) as pool:
        futures = {pool.submit(run_one, session): session for session in session_names}
        for future in as_completed(futures):
            results.append(future.result())
    order = {name: index for index, name in enumerate(session_names)}
    results.sort(key=lambda item: order.get(str(item.get("session")), 999))
    return {"ok": all(bool(item.get("ok")) for item in results), "command": command, "results": results}


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

    send = subparsers.add_parser("send")
    send.add_argument("--session", required=True)
    send.add_argument("--enter", dest="enter", action="store_true", default=True)
    send.add_argument("--no-enter", dest="enter", action="store_false")
    send.add_argument("--json", action="store_true")
    send.add_argument("text")

    logs = subparsers.add_parser("logs")
    logs.add_argument("--session", required=True)
    logs.add_argument("--lines", type=int, default=80)
    logs.add_argument("--json", action="store_true")

    poll = subparsers.add_parser("poll")
    poll.add_argument("--session", required=True)
    poll.add_argument("--until", required=True)
    poll.add_argument("--timeout", type=float, default=30.0)
    poll.add_argument("--interval", type=float, default=0.5)
    poll.add_argument("--json", action="store_true")

    fanout = subparsers.add_parser("fanout")
    fanout.add_argument("--targets", required=True)
    fanout.add_argument("--timeout", type=float, default=60.0)
    fanout.add_argument("--json", action="store_true")
    fanout.add_argument("command_text")

    proc = subparsers.add_parser("proc")
    proc_sub = proc.add_subparsers(dest="proc_command", required=True)
    proc_list = proc_sub.add_parser("list")
    proc_list.add_argument("--name")
    proc_list.add_argument("--session")
    proc_list.add_argument("--parent", type=int)
    proc_list.add_argument("--cwd")
    proc_list.add_argument("--json", action="store_true")
    proc_kill = proc_sub.add_parser("kill")
    proc_kill.add_argument("pid", nargs="?", type=int)
    proc_kill.add_argument("--name")
    proc_kill.add_argument("--signal", type=int, default=signal.SIGTERM)
    proc_kill.add_argument("--tree", action="store_true")
    proc_kill.add_argument("--json", action="store_true")
    proc_tree = proc_sub.add_parser("tree")
    proc_tree.add_argument("pid", nargs="?", type=int)
    proc_tree.add_argument("--session")
    proc_tree.add_argument("--json", action="store_true")
    proc_top = proc_sub.add_parser("top")
    proc_top.add_argument("--pid")
    proc_top.add_argument("--session")
    proc_top.add_argument("--json", action="store_true")

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
    if args.command == "send":
        print_result(cmd_send(args.session, args.text, args.enter), args.json)
        return
    if args.command == "logs":
        print_result(cmd_logs(args.session, args.lines), args.json)
        return
    if args.command == "poll":
        print_result(cmd_poll(args.session, args.until, args.timeout, args.interval), args.json)
        return
    if args.command == "fanout":
        print_result(cmd_fanout(args.command_text, args.targets, args.timeout), args.json)
        return
    if args.command == "proc":
        if args.proc_command == "list":
            print_result(cmd_proc_list(args.name, args.session, args.parent, args.cwd), args.json)
            return
        if args.proc_command == "kill":
            print_result(cmd_proc_kill(args.pid, args.name, args.signal, args.tree), args.json)
            return
        if args.proc_command == "tree":
            print_result(cmd_proc_tree(args.pid, args.session), args.json)
            return
        if args.proc_command == "top":
            print_result(cmd_proc_top(args.pid, args.session), args.json)
            return


if __name__ == "__main__":
    main()
