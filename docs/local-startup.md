# Stable Local Startup Flow

Use the dashboard as the primary Mission Control and treat the iPad app as a supplemental surface for alerts, quick job review, and lightweight control.

## Daily Start

From the repo root:

```bash
cd /Users/a_conte/dev/openclaw-agents
./scripts/local-stack.sh start
```

That starts:

- the dashboard in a tmux session named `openclaw-dashboard`
- the `listen` runtime in a tmux session named `openclaw-listen`

Default addresses:

- primary dashboard: `http://127.0.0.1:3000/command`
- `listen`: `http://127.0.0.1:7600`

## Daily Checks

Check service status:

```bash
./scripts/local-stack.sh status
```

Read recent service output:

```bash
./scripts/local-stack.sh logs dashboard
./scripts/local-stack.sh logs listen
```

Restart cleanly:

```bash
./scripts/local-stack.sh restart
```

Stop both services:

```bash
./scripts/local-stack.sh stop
```

## Network Model

Recommended operating model:

- dashboard is the main Mission Control surface
- iPad is supplemental
- `listen` stays bound to `127.0.0.1`
- other devices should talk to the dashboard, not directly to `listen`

For another device on your LAN, use the dashboard via:

```bash
http://<your-mac-lan-ip>:3000/command
```

Set the iPad app base URL to that dashboard address in [`Local.xcconfig`](/Users/a_conte/dev/openclaw-agents/apps/ios/Local.xcconfig).

## If Something Looks Off

1. Run `./scripts/local-stack.sh status`
2. Check `./scripts/local-stack.sh logs dashboard`
3. Check `./scripts/local-stack.sh logs listen`
4. Restart with `./scripts/local-stack.sh restart`
5. If needed, rerun [`scripts/bootstrap-mac.sh`](/Users/a_conte/dev/openclaw-agents/scripts/bootstrap-mac.sh) in check mode:

```bash
./scripts/bootstrap-mac.sh --check
```
