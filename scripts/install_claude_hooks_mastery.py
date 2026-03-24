#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import shutil
import time
from pathlib import Path


CLAUDE_SETTINGS = Path.home() / ".claude" / "settings.json"
CLAUDE_BACKUPS = Path.home() / ".claude" / "backups"
DEFAULT_REPO = Path(__file__).resolve().parent.parent

UPSTREAM_ALLOW_PERMISSIONS = [
    "Bash(mkdir:*)",
    "Bash(uv:*)",
    "Bash(find:*)",
    "Bash(mv:*)",
    "Bash(grep:*)",
    "Bash(npm:*)",
    "Bash(ls:*)",
    "Bash(cp:*)",
    "Write",
    "Edit",
    "Bash(chmod:*)",
    "Bash(touch:*)",
]

HOOK_COMMANDS = {
    "PreToolUse": ["pre_tool_use.py"],
    "PostToolUse": ["post_tool_use.py"],
    "Notification": ["notification.py"],
    "Stop": ["stop.py", "--chat"],
    "SubagentStop": ["subagent_stop.py"],
    "UserPromptSubmit": ["user_prompt_submit.py", "--log-only", "--store-last-prompt", "--name-agent"],
    "PreCompact": ["pre_compact.py"],
    "SessionStart": ["session_start.py"],
    "SessionEnd": ["session_end.py"],
    "PermissionRequest": ["permission_request.py", "--log-only"],
    "PostToolUseFailure": ["post_tool_use_failure.py"],
    "SubagentStart": ["subagent_start.py"],
    "Setup": ["setup.py"],
}


def load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"{path} must contain a JSON object")
    return data


def backup_settings(path: Path) -> None:
    if not path.exists():
        return
    CLAUDE_BACKUPS.mkdir(parents=True, exist_ok=True)
    backup_path = CLAUDE_BACKUPS / f"settings.json.backup.{int(time.time())}"
    shutil.copy2(path, backup_path)


def build_hook_command(repo: Path, parts: list[str]) -> str:
    script = repo / ".claude" / "hooks" / parts[0]
    args = " ".join(parts[1:])
    return f"uv run {script}{(' ' + args) if args else ''}"


def clean_existing_managed_hooks(hooks: dict, repo: Path) -> dict:
    managed_prefix = f"uv run {repo / '.claude' / 'hooks'}"
    cleaned: dict[str, list[dict]] = {}
    for event_name, matchers in hooks.items():
        if not isinstance(matchers, list):
            continue
        next_matchers: list[dict] = []
        for matcher in matchers:
            if not isinstance(matcher, dict):
                continue
            existing_hooks = matcher.get("hooks")
            if not isinstance(existing_hooks, list):
                next_matchers.append(matcher)
                continue
            retained = []
            for hook in existing_hooks:
                if not isinstance(hook, dict):
                    continue
                command = hook.get("command")
                if isinstance(command, str) and command.startswith(managed_prefix):
                    continue
                retained.append(hook)
            if retained:
                new_matcher = dict(matcher)
                new_matcher["hooks"] = retained
                next_matchers.append(new_matcher)
        if next_matchers:
            cleaned[event_name] = next_matchers
    return cleaned


def ensure_permissions(settings: dict) -> None:
    permissions = settings.setdefault("permissions", {})
    allow = permissions.setdefault("allow", [])
    if not isinstance(allow, list):
        allow = permissions["allow"] = []
    existing = {item for item in allow if isinstance(item, str)}
    for item in UPSTREAM_ALLOW_PERMISSIONS:
        if item not in existing:
            allow.append(item)
            existing.add(item)
    deny = permissions.setdefault("deny", [])
    if not isinstance(deny, list):
        permissions["deny"] = []


def install_hooks(settings: dict, repo: Path) -> None:
    hooks = settings.setdefault("hooks", {})
    if not isinstance(hooks, dict):
        hooks = settings["hooks"] = {}
    cleaned = clean_existing_managed_hooks(hooks, repo)
    hooks.clear()
    hooks.update(cleaned)
    for event_name, parts in HOOK_COMMANDS.items():
        hooks[event_name] = [
            {
                "matcher": "",
                "hooks": [
                    {
                        "type": "command",
                        "command": build_hook_command(repo, parts),
                    }
                ],
            }
        ]


def maybe_install_status_line(settings: dict, repo: Path, mode: str) -> None:
    if mode == "off":
        settings.pop("statusLine", None)
        return
    if mode == "if-missing" and "statusLine" in settings:
        return
    settings["statusLine"] = {
        "type": "command",
        "command": f"uv run {repo / '.claude' / 'status_lines' / 'status_line_v6.py'}",
        "padding": 0,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Install Claude Code Hooks Mastery additively")
    parser.add_argument("--repo", default=str(DEFAULT_REPO), help="Path to the claude-code-hooks-mastery repo")
    parser.add_argument(
        "--status-line",
        choices=["if-missing", "always", "off"],
        default="if-missing",
        help="Whether to install the hooks mastery status line",
    )
    args = parser.parse_args()

    repo = Path(args.repo).expanduser().resolve()
    if not repo.exists():
        raise SystemExit(f"Repo not found: {repo}")
    if not (repo / ".claude" / "hooks").exists():
        raise SystemExit(f"Hooks directory not found under: {repo}")

    settings = load_json(CLAUDE_SETTINGS)
    backup_settings(CLAUDE_SETTINGS)
    ensure_permissions(settings)
    install_hooks(settings, repo)
    maybe_install_status_line(settings, repo, args.status_line)

    CLAUDE_SETTINGS.parent.mkdir(parents=True, exist_ok=True)
    CLAUDE_SETTINGS.write_text(json.dumps(settings, indent=2) + "\n", encoding="utf-8")
    print(f"Updated {CLAUDE_SETTINGS}")


if __name__ == "__main__":
    main()
