# DEPRECATED: Use `just <target>` instead. Install: brew install just
# This Makefile is kept for backwards compatibility and will be removed.
.PHONY: test typecheck build watchdog backup validate-json restart-agents check-dashboard-paths

test:
	npm run dashboard:test

typecheck:
	npm run dashboard:typecheck

build:
	npm run dashboard:build

check-dashboard-paths:
	./scripts/check-dashboard-paths.sh

watchdog:
	./scripts/watchdog.sh

backup:
	./scripts/backup.sh

validate-json:
	@for f in shared/workflows/*.json shared/pipelines/*.json shared/repos.json; do \
		python3 -m json.tool "$$f" > /dev/null && echo "OK: $$f" || exit 1; \
	done

restart-agents:
	@for agent in main mail docs research ai-research dev security; do \
		echo "Restarting $$agent..."; \
		openclaw gateway call heartbeat --agent $$agent 2>/dev/null || echo "Failed: $$agent"; \
	done
