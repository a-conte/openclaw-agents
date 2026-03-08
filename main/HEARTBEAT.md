# HEARTBEAT.md - Periodic Tasks

## Routine Checks

1. **Email triage** - Run `himalaya list -s unseen` to check for unread/urgent messages. Summarize anything important.
2. **Calendar** - Check today's upcoming events via `gog cal today`. Flag anything in the next 2 hours.
3. **Weather** - Quick weather check for current location if relevant to upcoming plans.

## Self-Improvement

4. **Memory maintenance** - Review any recent daily memory files. Consolidate useful patterns into MEMORY.md. Remove stale entries.
5. **Tools check** - If new skills were installed or removed, update TOOLS.md to reflect current state.
6. **SOUL.md review** - If SOUL.md feels outdated or incomplete based on recent interactions, propose updates (notify user first).

## Workspace Hygiene

7. **Git status** - Check `git -C ~/openclaw-agents status`. If there are uncommitted changes, commit and push via `~/openclaw-agents/scripts/push.sh`.
