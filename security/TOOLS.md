# TOOLS.md - Security Agent Skills

## Primary Tools
- **healthcheck** - Host security hardening checks
- **github** - GitHub ops via `gh` CLI (repo scanning, secret detection)
- **1password** - 1Password CLI secrets management

## Supporting Tools
- **gotify** - Push notifications for critical alerts
- **session-logs** - Search own session logs for audit trail
- **tmux** - Remote-control tmux sessions for interactive CLIs

## Network Monitoring
- **lsof** - Check open ports: `lsof -i -P -n | grep LISTEN`
- **tailscale** - Verify Tailscale status and device list: `tailscale status`
- **socketfilterfw** - Check macOS firewall: `sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate`
- **nmap** - Network scanning (if installed): `nmap -sT localhost`

## Boundaries
- Never expose secrets, tokens, or passwords in reports — always redact
- Ask before taking remediation actions (revoking tokens, changing configs)
- Read, scan, and audit freely
