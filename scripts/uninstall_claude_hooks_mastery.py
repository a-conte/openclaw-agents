#!/usr/bin/env python3

from __future__ import annotations

import json
from pathlib import Path


CLAUDE_SETTINGS = Path.home() / ".claude" / "settings.json"
DEFAULT_REPO = Path(__file__).resolve().parent.parent


def load_settings() -> dict:
    if not CLAUDE_SETTINGS.exists():
        return {}
    data = json.loads(CLAUDE_SETTINGS.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise SystemExit(f"{CLAUDE_SETTINGS} must contain a JSON object")
    return data


def clean_managed_hooks(settings: dict, repo: Path) -> None:
    managed_prefix = f"uv run {repo / '.claude' / 'hooks'}"
    hooks = settings.get("hooks")
    if not isinstance(hooks, dict):
        return
    cleaned: dict[str, list[dict]] = {}
    for event_name, matchers in hooks.items():
        if not isinstance(matchers, list):
            continue
        next_matchers = []
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
                updated = dict(matcher)
                updated["hooks"] = retained
                next_matchers.append(updated)
        if next_matchers:
            cleaned[event_name] = next_matchers
    settings["hooks"] = cleaned


def clean_status_line(settings: dict, repo: Path) -> None:
    status_line = settings.get("statusLine")
    if not isinstance(status_line, dict):
        return
    command = status_line.get("command")
    managed = f"uv run {repo / '.claude' / 'status_lines'}"
    if isinstance(command, str) and command.startswith(managed):
        settings.pop("statusLine", None)


def main() -> None:
    repo = DEFAULT_REPO.resolve()
    settings = load_settings()
    clean_managed_hooks(settings, repo)
    clean_status_line(settings, repo)
    CLAUDE_SETTINGS.write_text(json.dumps(settings, indent=2) + "\n", encoding="utf-8")
    print(f"Updated {CLAUDE_SETTINGS}")


if __name__ == "__main__":
    main()
