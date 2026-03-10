# HEARTBEAT.md - Security Agent Periodic Tasks

## State Management

Before starting, read `heartbeat-state.json` from this agent's directory. Use it to:
- Skip messages already in `processedMessages` (by filename)
- Track `lastRun` and `lastInboxCheck` timestamps
- Increment `counters.messagesProcessed` for each new message handled

After completing all steps, write the updated state back to `heartbeat-state.json`.

## Tasks

1. **Secret scan** - Scan git repos for exposed secrets (API keys, tokens, passwords in code or config).
2. **Bot token validation** - Verify all Telegram bot tokens are valid (hit getMe endpoint for each).
3. **Config integrity** - Check `~/.openclaw/openclaw.json` integrity — compare hash against known-good baseline in memory.
4. **Auth log review** - Review gateway auth logs for unauthorized access attempts.
5. **Healthcheck** - Run `healthcheck` skill for host security hardening.
6. **Check inbox** - Read all `*.json` files in `shared/inbox/security/`. Process unread messages. For security incidents, escalate to `shared/inbox/main/` and `shared/inbox/dev/` with priority `"urgent"`. See `shared/PROTOCOL.md`.
7. **Network scan** - Check for unexpected open ports: `lsof -i -P -n | grep LISTEN`. Compare against known-good baseline (gateway 18789, SSH 22). Alert on any unknown listeners.
8. **Tailscale check** - If Tailscale is installed, run `tailscale status` to verify device list. Alert if any unknown devices are connected.
9. **Firewall status** - Check macOS firewall is enabled: `sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate`. Alert if disabled.
10. **Memory maintenance** - Consolidate security findings and patterns into MEMORY.md.

## Logging

11. **Activity log** - After completing all steps, append one JSONL line to `shared/logs/activity.jsonl`:
    ```json
    {"timestamp":"...","type":"heartbeat","agent":"security","inbox_processed":N,"duration_ms":N}
    ```
