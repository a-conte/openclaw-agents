.PHONY: test lint typecheck build watchdog backup validate-json

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
