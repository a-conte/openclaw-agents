#!/usr/bin/env python3

from __future__ import annotations

from pathlib import Path


RULES_PATH = Path.home() / ".codex" / "rules" / "default.rules"
START_MARKER = "# BEGIN OPENCLAW CODEX GUARDRAILS"
END_MARKER = "# END OPENCLAW CODEX GUARDRAILS"

MANAGED_RULES = """# BEGIN OPENCLAW CODEX GUARDRAILS
# Mirrors the intent of .claude/settings.json for Codex shell commands.
prefix_rule(pattern=["git", "push", "-f"], decision="deny")
prefix_rule(pattern=["git", "push", "--force"], decision="deny")
prefix_rule(pattern=["git", "reset", "--hard"], decision="deny")
prefix_rule(pattern=["git", "clean", "-f"], decision="deny")
prefix_rule(pattern=["git", "clean", "-fd"], decision="deny")
prefix_rule(pattern=["git", "clean", "-fdx"], decision="deny")
prefix_rule(pattern=["git", "checkout", "--"], decision="deny")
prefix_rule(pattern=["git", "restore", "--source"], decision="deny")
prefix_rule(pattern=["git", "branch", "-D"], decision="deny")
# END OPENCLAW CODEX GUARDRAILS
"""


def strip_managed_block(text: str) -> str:
    start = text.find(START_MARKER)
    end = text.find(END_MARKER)
    if start == -1 or end == -1 or end < start:
        return text.rstrip()
    end += len(END_MARKER)
    before = text[:start].rstrip()
    after = text[end:].lstrip("\n")
    if before and after:
        return f"{before}\n\n{after}".rstrip()
    return (before or after).rstrip()


def main() -> None:
    RULES_PATH.parent.mkdir(parents=True, exist_ok=True)
    existing = RULES_PATH.read_text(encoding="utf-8") if RULES_PATH.exists() else ""
    cleaned = strip_managed_block(existing)
    pieces = [piece for piece in [cleaned, MANAGED_RULES.strip()] if piece]
    updated = "\n\n".join(pieces) + "\n"
    RULES_PATH.write_text(updated, encoding="utf-8")
    print(f"Updated {RULES_PATH}")


if __name__ == "__main__":
    main()
