# Memory Consolidation Prompt

## Purpose

This template guides the memory consolidation process — distilling raw daily logs into curated long-term memory.

## Process

For each agent, perform the following:

### 1. Gather Recent Logs

Read the last 7 days of `memory/YYYY-MM-DD.md` files from the target agent's workspace.

### 2. Extract Patterns

Look for:
- **Recurring themes** — tasks or topics that come up repeatedly
- **Key decisions** — choices made that affect future behavior
- **New facts** — information learned about the user, tools, or environment
- **Lessons learned** — mistakes made and how they were resolved
- **Tool discoveries** — new capabilities or workarounds found
- **Preferences** — user preferences expressed or inferred

### 3. Compare Against MEMORY.md

For each finding:
- Is this already captured in MEMORY.md? → Skip
- Does it update/contradict something in MEMORY.md? → Propose update
- Is it genuinely new and worth keeping long-term? → Propose addition
- Is something in MEMORY.md now outdated? → Propose removal

### 4. Draft Proposed Changes

Format proposed changes as:
```
## Consolidation Proposals for {agent}

### Additions
- [NEW] {description of what to add}

### Updates
- [UPDATE] {existing entry} → {proposed change}

### Removals
- [REMOVE] {entry to remove} — Reason: {why it's outdated}
```

### 5. Write Summary

Write the consolidation summary to `memory/consolidation-log.md` with:
- Date of consolidation
- Agents reviewed
- Number of proposals per agent
- Key highlights

### 6. Approval Gate

Send a summary message to the human via Telegram for review before applying changes. Include:
- Total proposed changes per agent
- Top 3 most significant findings
- Ask for approval before writing to any MEMORY.md

## Schedule

- **Daily quick pass:** During the 11pm cron job, review today's logs only
- **Weekly deep pass:** Every Sunday, review the full 7-day window
- **Monthly cleanup:** First of the month, review and prune MEMORY.md for all agents
