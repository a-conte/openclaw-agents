# HEARTBEAT.md - Security Agent Periodic Tasks

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

Remove any entries from `processedMessages` that reference files no longer present in `shared/inbox/security/`. This prevents unbounded state growth.

## Resilience

If any step fails (tool not found, command error, timeout), log the failure and continue to the next step. Never abort the entire heartbeat because one step failed.

## Tasks

1. **Check inbox** - Read all `*.json` files in `shared/inbox/security/`. Process unread messages. For security incidents, escalate to `shared/inbox/main/` and `shared/inbox/dev/` with priority `"urgent"`. See `shared/PROTOCOL.md`.
2. **Secret scan** - Scan git repos for exposed secrets (API keys, tokens, passwords in code or config).
3. **Bot token validation** - Verify all Telegram bot tokens are valid (hit getMe endpoint for each).
4. **Config integrity** - Check `~/.openclaw/openclaw.json` integrity — compare hash against known-good baseline in memory.
5. **Auth log review** - Review gateway auth logs for unauthorized access attempts.
6. **Healthcheck** - Run `healthcheck` skill for host security hardening.
7. **Network scan** - Check for unexpected open ports: `lsof -i -P -n | grep LISTEN`. Compare against known-good baseline (gateway 18789, SSH 22). Alert on any unknown listeners.
8. **Proactive reporting** - If unexpected open ports are found in step 7, or any security issues in steps 2-6, write a message to both `shared/inbox/main/` AND `shared/inbox/dev/` with priority `"urgent"` and subject `"Security Alert: {issue}"`.
9. **Tailscale check** - If Tailscale is installed, run `tailscale status` to verify device list. Alert if any unknown devices are connected.
10. **Firewall status** - Check macOS firewall is enabled: `sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate`. Alert if disabled.
11. **Memory maintenance** - Consolidate security findings and patterns into MEMORY.md.

## Logging

12. **Activity log** - After completing all steps, append one JSONL line to `shared/logs/activity.jsonl`:
    ```json
    {"timestamp":"...","type":"heartbeat","agent":"security","inbox_processed":N,"duration_ms":N,"details":{"steps_ok":[...],"steps_failed":[...]}}
    ```
