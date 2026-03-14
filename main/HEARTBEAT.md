# HEARTBEAT.md - Periodic Tasks

## Timing

Record the current epoch milliseconds at the very start of the heartbeat (before any other work).
At the end, compute `duration_ms = end_epoch_ms - start_epoch_ms`. Use this value in the activity log.
Never hardcode or estimate `duration_ms`.

## State Management

Before starting, read `heartbeat-state.json` from this agent's directory. Use it to:
- Skip messages already in `processedMessages` (by filename)
- Track `lastRun` and `lastInboxCheck` timestamps
- Increment `counters.messagesProcessed` for each new message handled

After completing all steps, write the updated state back to `heartbeat-state.json`.

## State Cleanup

Remove any entries from `processedMessages` that reference files no longer present in `shared/inbox/main/`. This prevents unbounded state growth.

## Resilience

If any step fails (tool not found, command error, timeout), log the failure and continue to the next step. Never abort the entire heartbeat because one step failed. Record which steps succeeded and which failed in the activity log's `details` field.

## Routine Checks

1. **Email triage** - Run `himalaya list -s unseen` to check for unread/urgent messages. Summarize anything important. If himalaya is not configured, skip gracefully.
2. **Calendar** - Check today's upcoming events via `gog cal today`. Flag anything in the next 2 hours. If gog is not configured, skip gracefully.
3. **Weather** - Quick weather check for current location if relevant to upcoming plans.

## Self-Improvement

4. **Memory maintenance** - Review any recent daily memory files. Consolidate useful patterns into MEMORY.md. Remove stale entries.
5. **Tools check** - If new skills were installed or removed, update TOOLS.md to reflect current state.
6. **SOUL.md review** - If SOUL.md feels outdated or incomplete based on recent interactions, propose updates (notify user first).

## Inter-Agent Inbox

7. **Check inbox** - Read all `*.json` files in `shared/inbox/main/`. Process unread messages by priority (urgent first). Update each message's `status` to `"read"` or `"actioned"`. Reply by writing to the sender's inbox if needed. See `shared/PROTOCOL.md` for format.
8. **Pipeline orchestration** - If an inbox message is part of a pipeline (has `pipeline` field), check `shared/pipelines/` for the pipeline definition and route the next step to the appropriate agent.

## Daily Briefing

9. **Daily briefing** - Check `heartbeat-state.json` for `lastBriefingDate`. If it is not today's date (YYYY-MM-DD):
    - Read `shared/pipelines/daily-briefing.json` and execute its steps in order.
    - After completion, update `lastBriefingDate` to today's date in `heartbeat-state.json`.
    - This ensures the briefing runs exactly once per day, on the first heartbeat of the day.

## Workspace Hygiene

10. **Git status** - Check `git -C ~/openclaw-agents status`. If there are uncommitted changes, commit and push via `~/openclaw-agents/scripts/push.sh`.

## Power Workflows

11. **Workflow dispatch** - If the user sends one of these trigger phrases, read the matching workflow definition from `shared/workflows/` and execute its steps in order:
    - `"prep my day"` → `shared/workflows/prep-my-day.json`
    - `"what needs attention"` → `shared/workflows/needs-attention.json`
    - `"clean workspace"` → `shared/workflows/clean-workspace.json`
    - `"review repos"` → `shared/workflows/review-repos.json`
    - `"weekly review"` → `shared/workflows/weekly-review.json`

    For each step: send an inbox message to the target agent with the action as `body`, `workflow` field set to the workflow name, and wait for a response before proceeding to the next step. If `approvalRequired` is true, ask the human for confirmation before executing destructive actions.

## Logging

12. **Activity log** - After completing all steps, append one JSONL line to `shared/logs/activity.jsonl`:
    ```json
    {"timestamp":"...","type":"heartbeat","agent":"main","inbox_processed":N,"duration_ms":N,"details":{"steps_ok":[...],"steps_failed":[...]}}
    ```
