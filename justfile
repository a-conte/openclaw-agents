# OpenClaw Agents — task runner
# Install: brew install just
# Usage:  just <target>

# Default: list available targets
default:
    @just --list

# ─── Dashboard ───────────────────────────────────────────────────────

# Run dashboard unit tests
test:
    npm run dashboard:test

# TypeScript type checking
typecheck:
    npm run dashboard:typecheck

# Production build
build:
    npm run dashboard:build

# Verify dashboard path migration
check-dashboard-paths:
    ./scripts/check-dashboard-paths.sh

# ─── Contracts ───────────────────────────────────────────────────────

# Run contract schema + fixture tests
contracts-test:
    npm run test --workspace @openclaw/contracts

# ─── Agents ──────────────────────────────────────────────────────────

# Run the watchdog health-check loop
watchdog:
    ./scripts/watchdog.sh

# Backup agent data
backup:
    ./scripts/backup.sh

# Validate shared JSON configs
validate-json:
    #!/usr/bin/env bash
    set -euo pipefail
    for f in shared/workflows/*.json shared/pipelines/*.json shared/repos.json; do
        python3 -m json.tool "$f" > /dev/null && echo "OK: $f" || exit 1
    done

# Restart all agents via gateway heartbeat
restart-agents:
    #!/usr/bin/env bash
    set -euo pipefail
    for agent in main mail docs research ai-research dev security; do
        echo "Restarting $agent..."
        openclaw gateway call heartbeat --agent "$agent" 2>/dev/null || echo "Failed: $agent"
    done

# ─── iOS ─────────────────────────────────────────────────────────────

# Generate Xcode project from project.yml
ios-generate:
    cd apps/ios && xcodegen generate --spec project.yml

# Build iOS app for simulator
ios-build: ios-generate
    xcodebuild -project apps/ios/OpenClawMissionControl.xcodeproj \
        -scheme OpenClawMissionControl \
        -destination 'platform=iOS Simulator,name=iPad Pro 13-inch (M4)' \
        -configuration Debug \
        build

# Run iOS unit tests in simulator
ios-test: ios-generate
    xcodebuild -project apps/ios/OpenClawMissionControl.xcodeproj \
        -scheme OpenClawMissionControlTests \
        -destination 'platform=iOS Simulator,name=iPad Pro 13-inch (M4)' \
        test

# ─── Jobs ────────────────────────────────────────────────────────────

# Submit a job to an agent (usage: just job-submit <agent> <prompt>)
job-submit agent prompt:
    curl -s -X POST http://localhost:3000/api/jobs \
        -H 'Content-Type: application/json' \
        -d '{"targetAgent":"{{agent}}","prompt":"{{prompt}}"}' | python3 -m json.tool

# List all jobs
job-list:
    curl -s http://localhost:3000/api/jobs | python3 -m json.tool

# Get job status (usage: just job-status <id>)
job-status id:
    curl -s http://localhost:3000/api/jobs/{{id}} | python3 -m json.tool

# ─── Listen ──────────────────────────────────────────────────────────

# Start the listen server locally
listen-server:
    python3 apps/listen/listen_server.py --host ${OPENCLAW_LISTEN_HOST:-127.0.0.1} --port ${OPENCLAW_LISTEN_PORT:-7600}

# List workflow templates exposed by listen
listen-templates:
    python3 apps/direct/direct_cli.py --base-url ${OPENCLAW_LISTEN_BASE_URL:-http://127.0.0.1:7600} templates

# Submit a prompt job to listen (usage: just listen-send "do the thing")
listen-send prompt:
    python3 apps/direct/direct_cli.py --base-url ${OPENCLAW_LISTEN_BASE_URL:-http://127.0.0.1:7600} start --prompt "{{prompt}}"

# Submit and wait for completion
listen-send-wait prompt:
    python3 apps/direct/direct_cli.py --base-url ${OPENCLAW_LISTEN_BASE_URL:-http://127.0.0.1:7600} start --prompt "{{prompt}}" --wait

# List active jobs
listen-jobs:
    python3 apps/direct/direct_cli.py --base-url ${OPENCLAW_LISTEN_BASE_URL:-http://127.0.0.1:7600} list

# Show a specific job
listen-job id:
    python3 apps/direct/direct_cli.py --base-url ${OPENCLAW_LISTEN_BASE_URL:-http://127.0.0.1:7600} get --job-id {{id}}

# Show latest jobs
listen-latest count='1':
    python3 apps/direct/direct_cli.py --base-url ${OPENCLAW_LISTEN_BASE_URL:-http://127.0.0.1:7600} latest {{count}}

# Wait for a job to finish
listen-wait id:
    python3 apps/direct/direct_cli.py --base-url ${OPENCLAW_LISTEN_BASE_URL:-http://127.0.0.1:7600} wait --job-id {{id}}

# Stop a job
listen-stop id:
    python3 apps/direct/direct_cli.py --base-url ${OPENCLAW_LISTEN_BASE_URL:-http://127.0.0.1:7600} stop --job-id {{id}}

# Clear active jobs
listen-clear:
    python3 apps/direct/direct_cli.py --base-url ${OPENCLAW_LISTEN_BASE_URL:-http://127.0.0.1:7600} clear

# ─── Meta ────────────────────────────────────────────────────────────

# Run all checks (typecheck + tests + contracts + json validation)
check-all: typecheck test contracts-test validate-json
