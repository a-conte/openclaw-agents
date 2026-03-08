# HEARTBEAT.md - Security Agent Periodic Tasks

1. **Secret scan** - Scan git repos for exposed secrets (API keys, tokens, passwords in code or config).
2. **Bot token validation** - Verify all Telegram bot tokens are valid (hit getMe endpoint for each).
3. **Config integrity** - Check `~/.openclaw/openclaw.json` integrity — compare hash against known-good baseline in memory.
4. **Auth log review** - Review gateway auth logs for unauthorized access attempts.
5. **Healthcheck** - Run `healthcheck` skill for host security hardening.
6. **Memory maintenance** - Consolidate security findings and patterns into MEMORY.md.
