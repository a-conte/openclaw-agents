# OpenClaw Codex Guardrails

This repo uses additive Codex guardrails that mirror the intent of the Claude hooks in [`.claude/settings.json`](/Users/a_conte/dev/openclaw-agents/.claude/settings.json).

## Protected Files

Do not modify these files unless the user explicitly asks for it in the current conversation:

- `SOUL.md`
- `IDENTITY.md`
- `USER.md`
- `PROTOCOL.md`

This applies anywhere in the repo, including agent workspaces and shared folders.

## Secrets

Do not create, edit, or overwrite `.env` files unless the user explicitly asks for it.

Treat credential, token, and secret-bearing files as high risk even if they do not use a `.env` suffix.

## Dangerous Git Operations

Do not run destructive git commands without explicit user confirmation in the current conversation.

Examples:

- `git push -f`
- `git push --force`
- `git reset --hard`
- `git clean -f`
- `git clean -fd`
- `git clean -fdx`
- `git checkout -- ...`
- `git restore --source ...`
- `git branch -D ...`

## Enforcement Model

OpenAI Codex CLI on this machine does not yet expose the same stable pre-tool hook model as Claude.

Protection is applied through:

- project instructions in this file
- Codex shell rules installed into `~/.codex/rules/default.rules`
- repo git hooks as commit-time backstops

The installer is:

- `python3 scripts/install_codex_guardrails.py`
