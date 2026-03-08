# MemoClaw Skill

Semantic memory API for AI agents. Wallet = identity.

## Install

```bash
clawhub install memoclaw
```

Or manually copy `SKILL.md` to your agent's skills directory.

## Quick Start

```bash
# Setup (one-time, interactive)
npm install -g memoclaw
memoclaw init

# Store a memory
memoclaw store "Meeting notes: discussed Q1 roadmap" \
  --importance 0.8 --tags work --memory-type project

# Recall memories
memoclaw recall "what did we discuss about roadmap"

# Session start - load context
memoclaw context "user preferences and recent decisions" --limit 10
```

## Key Features

- **Semantic Search** - Natural language recall across all memories
- **Auto-Deduplication** - Built-in consolidate to merge similar memories
- **Importance Scoring** - Rank memories by significance (0-1)
- **Memory Types** - Automatic decay based on type
- **Namespaces** - Organize memories per project or context
- **Relations** - Link related memories (supersedes, contradicts, supports)

## Pricing

**Free Tier:** 100 calls per wallet.
After free tier: Store/Recall $0.005, Ingest/Context $0.01. Many operations are free.

## Links

- **Docs**: https://docs.memoclaw.com
- **Skill**: https://clawhub.ai/anajuliabit/memoclaw

## License

MIT
