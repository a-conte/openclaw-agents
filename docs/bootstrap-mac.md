# OpenClaw Mac Bootstrap

Use this checklist to bring a fresh macOS machine up to the current OpenClaw automation baseline.

The guided script lives at [`scripts/bootstrap-mac.sh`](/Users/a_conte/dev/openclaw-agents/scripts/bootstrap-mac.sh):

```bash
cd /Users/a_conte/dev/openclaw-agents
./scripts/bootstrap-mac.sh --install-deps --generate-ios --check
```

For a verification-only pass:

```bash
./scripts/bootstrap-mac.sh --check
```

## 1. Base Tooling

```bash
brew install tmux xcodegen
```

Install full Xcode, then activate it:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -license accept
xcodebuild -version
```

## 2. Repo Services

Start the dashboard:

```bash
cd /Users/a_conte/dev/openclaw-agents/apps/dashboard
npm install
npm run dev
```

Start the automation runtime:

```bash
cd /Users/a_conte/dev/openclaw-agents
python3 apps/listen/listen_server.py --host 127.0.0.1 --port 7600
```

## 3. macOS Permissions

Grant the calling terminal:
- Accessibility
- Screen Recording
- Automation access for Safari/System Events when prompted

These are required for `steer` app focus, UI tree access, screenshots, OCR, and click automation.

## 4. Policy and Retention

Suggested local defaults:

```bash
export OPENCLAW_LISTEN_ALLOW_DANGEROUS=false
export OPENCLAW_LISTEN_ARTIFACT_RETENTION_DAYS=30
```

Optional allowlists:

```bash
export OPENCLAW_LISTEN_ALLOWED_STEER_COMMANDS="open-url,wait.url,see,ocr"
export OPENCLAW_LISTEN_ALLOWED_DRIVE_COMMANDS="run,logs,proc.list,poll"
export OPENCLAW_LISTEN_ALLOWED_WORKFLOWS="open_command_page,recover_command_page,repo_status_check"
```

Restart `listen` after changing env vars.

## 5. iPad Client

Set [`Local.xcconfig`](/Users/a_conte/dev/openclaw-agents/apps/ios/Local.xcconfig):

```xcconfig
MISSION_CONTROL_BASE_URL = http://localhost:3000
```

Generate/open the project:

```bash
cd /Users/a_conte/dev/openclaw-agents
xcodegen generate --spec apps/ios/project.yml
open apps/ios/OpenClawMissionControl.xcodeproj
```

## 6. Quick Smoke Checks

```bash
python3 apps/steer/steer_cli.py apps --json
python3 apps/drive/drive_cli.py session list --json
python3 apps/direct/direct_cli.py templates
python3 apps/direct/direct_cli.py start --mode workflow --template open_command_page --wait
curl http://127.0.0.1:7600/metrics
curl http://127.0.0.1:7600/policy/admin
```

The bootstrap script runs these checks for you, along with basic toolchain verification.
