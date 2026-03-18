# Troubleshooting

## Dashboard won't load

**Check if the process is running:**
```bash
launchctl list | grep openclaw
```
If not listed, load it:
```bash
launchctl load ~/Library/LaunchAgents/com.openclaw.dashboard.plist
```

**Check if port 3000 is in use:**
```bash
lsof -ti:3000
```
Kill the stale process if needed:
```bash
lsof -ti:3000 | xargs kill
```
Then reload:
```bash
launchctl unload ~/Library/LaunchAgents/com.openclaw.dashboard.plist
launchctl load ~/Library/LaunchAgents/com.openclaw.dashboard.plist
```

**Check logs:**
```bash
tail -50 ~/Library/Logs/openclaw-dashboard.log
```

## Agent cards show "Gateway Offline"

The gateway CLI is slow or not running.

**Test manually:**
```bash
openclaw gateway call health --json
```
This should return JSON within ~5 seconds. If it hangs or errors, the gateway needs restarting (not the dashboard).

## Agents page loads but cards are empty

Config file might be missing or malformed:
```bash
cat ~/.openclaw/openclaw.json | python3 -m json.tool
```

## Task board changes not saving

Check file permissions:
```bash
ls -la ~/openclaw-agents/apps/dashboard/data/tasks.json
```
Should be writable by your user. If missing:
```bash
mkdir -p ~/openclaw-agents/apps/dashboard/data
echo '[]' > ~/openclaw-agents/apps/dashboard/data/tasks.json
```

## Sessions page shows "No sessions found"

Verify session files exist for the selected agent:
```bash
ls ~/.openclaw/agents/main/sessions/
```
Should contain `sessions.json` and `.jsonl` files.

## File editor won't save

Only these files are editable: `SOUL.md`, `IDENTITY.md`, `TOOLS.md`, `HEARTBEAT.md`, `MEMORY.md`.

Check the agent directory exists:
```bash
ls ~/openclaw-agents/main/
```

## Can't access from another machine

**Verify the server is listening:**
```bash
curl http://localhost:3000
```

**Check your local IP:**
```bash
ipconfig getifaddr en0
```
Use that IP from your other machine: `http://<ip>:3000`

**Firewall blocking?**
System Settings → Network → Firewall — make sure incoming connections aren't blocked for Node.

## Restart everything

```bash
cd ~/openclaw-agents
./scripts/local-stack.sh restart
```

For day-to-day startup and status, prefer [`docs/local-startup.md`](/Users/a_conte/dev/openclaw-agents/docs/local-startup.md) over manual process management.

## Full reset (rebuild)

```bash
cd ~/openclaw-agents/apps/dashboard
rm -rf .next
npm run build
launchctl unload ~/Library/LaunchAgents/com.openclaw.dashboard.plist
launchctl load ~/Library/LaunchAgents/com.openclaw.dashboard.plist
```

## LaunchAgent reference

- **Plist:** `~/Library/LaunchAgents/com.openclaw.dashboard.plist`
- **Logs:** `~/Library/Logs/openclaw-dashboard.log`
- **Working dir:** `~/openclaw-agents/apps/dashboard/`
- **Port:** 3000
- **Network access:** `http://192.168.1.209:3000`
