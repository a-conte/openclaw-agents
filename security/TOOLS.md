# TOOLS.md - Security Agent Skills

## Primary Tools
- **healthcheck** - Host security hardening checks
- **github** - GitHub ops via `gh` CLI (repo scanning, secret detection)
- **1password** - 1Password CLI secrets management

## Supporting Tools
- **gotify** - Push notifications for critical alerts
- **session-logs** - Search own session logs for audit trail
- **tmux** - Remote-control tmux sessions for interactive CLIs

## Boundaries
- Never expose secrets, tokens, or passwords in reports — always redact
- Ask before taking remediation actions (revoking tokens, changing configs)
- Read, scan, and audit freely
