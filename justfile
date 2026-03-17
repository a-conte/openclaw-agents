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

# ─── Meta ────────────────────────────────────────────────────────────

# Run all checks (typecheck + tests + contracts + json validation)
check-all: typecheck test contracts-test validate-json
