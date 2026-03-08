# MemoClaw usage examples

## Example 1: CLI basics

```bash
npm install -g memoclaw
memoclaw init
memoclaw status

memoclaw store "User prefers vim keybindings" --importance 0.8 --tags tools,preferences --memory-type preference
memoclaw recall "editor preferences" --limit 5
memoclaw search "vim" --namespace default
```

## Example 2: OpenClaw agent session

```bash
# Session start
memoclaw context "user preferences and recent decisions" --limit 10

# User says "I switched to Neovim last week"
memoclaw recall "editor preferences"
memoclaw store "User switched to Neovim (Feb 2026)" \
  --importance 0.85 --tags preferences,tools --memory-type preference

# Session end
memoclaw store "Session 2026-02-16: Discussed editor migration, reviewed DB schema" \
  --importance 0.6 --tags session-summary --memory-type observation

memoclaw consolidate --namespace default --dry-run
memoclaw suggested --category stale --limit 5
```

## Example 3: Ingesting raw text

```bash
memoclaw ingest --text "User's name is Ana. She lives in Sao Paulo. She works with TypeScript."
cat conversation.txt | memoclaw ingest --namespace default --auto-relate
memoclaw extract "I prefer dark mode and use 2-space indentation"
```

## Example 4: Project namespaces

```bash
memoclaw store "Team chose PostgreSQL over MongoDB for ACID requirements" \
  --importance 0.9 --tags architecture,database --namespace project-alpha --memory-type decision

memoclaw recall "what database did we choose?" --namespace project-alpha
memoclaw namespace list
memoclaw export --format markdown --namespace project-alpha
```

## Example 5: Memory lifecycle

```bash
memoclaw store "User timezone is America/Sao_Paulo (UTC-3)" \
  --importance 0.7 --tags user-info --memory-type preference

memoclaw update <uuid> --content "User timezone is America/New_York (UTC-5)" --importance 0.8
memoclaw update <uuid> --pinned true
memoclaw relations create <uuid-1> <uuid-2> supersedes
memoclaw history <uuid>
memoclaw delete <uuid>
```

## Example 6: Consolidation and maintenance

```bash
memoclaw consolidate --namespace default --dry-run
memoclaw consolidate --namespace default
memoclaw suggested --category stale --limit 10
memoclaw purge --namespace old-project
```

## Example 7: Migrating from local markdown files

```bash
memoclaw migrate ./memory/
memoclaw list --limit 50
memoclaw recall "user preferences"
memoclaw update <id> --pinned true
```

## Cost breakdown

| Activity | Operations | Cost |
|----------|-----------|------|
| 10 stores | 10 x $0.005 | $0.05 |
| 20 recalls | 20 x $0.005 | $0.10 |
| 2 list queries | Free | $0.00 |
| **Total** | | **~$0.15/day** |

Under $5/month for continuous agent memory. First 100 calls are free.
