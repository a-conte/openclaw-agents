.PHONY: test lint typecheck build watchdog backup validate-json restart-agents

test:
	cd dashboard && npm run test

lint:
	cd dashboard && npm run lint

typecheck:
	cd dashboard && npm run typecheck

build:
	cd dashboard && npm run build

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
