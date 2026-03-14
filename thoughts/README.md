# Thoughts System

The `thoughts/` directory is the persistent knowledge layer for this project. All research, plans, and notes are saved here — never kept only in context.

## Directory Structure

```
thoughts/
├── shared/           # Team-wide documents (version-controlled)
│   ├── research/     # Output from research sessions
│   ├── plans/        # Implementation plans
│   ├── tickets/      # Ticket documentation
│   └── prs/          # PR descriptions
├── anthony/          # Personal notes (git-ignored)
│   ├── tickets/
│   └── notes/
├── global/           # Cross-repo thoughts (version-controlled)
└── searchable/       # Read-only symlinked view of all above (git-ignored)
```

## Frontmatter Conventions

### Research Documents

Save to: `thoughts/shared/research/YYYY-MM-DD_topic-name.md`

```yaml
---
date: <ISO timestamp with timezone>
researcher: <your name>
git_commit: <current commit hash>
branch: <current branch>
repository: <repo name>
topic: "<research question>"
tags: [research, codebase, relevant-component-names]
status: complete
last_updated: <YYYY-MM-DD>
last_updated_by: <your name>
---
```

### Plan Documents

Save to: `thoughts/shared/plans/YYYY-MM-DD-description.md`

```yaml
---
date: <ISO timestamp with timezone>
topic: "<plan title>"
tags: [plan, relevant-tags]
status: planned | in-progress | complete
last_updated: <YYYY-MM-DD>
---
```

## Workflow: Research → Plan → Implement → Validate

### Phase 1 — Research
- Spawn parallel sub-agents to explore different aspects of the codebase concurrently.
- Agents are documentarians only — describe what exists, do not suggest improvements.
- Save output to `thoughts/shared/research/`.

### Phase 2 — Plan
- Start a fresh context. Reference the research doc, do not re-read the codebase.
- Produce an interactive, iterative plan. Ask clarifying questions before writing.
- Plan must include: phases, success criteria, edge cases, and verification steps.

### Phase 3 — Implement
- Start a fresh context. Reference the plan doc only.
- Prefer `make` commands for all build/test/lint steps.
- Do not exceed 60% context — create a handoff doc if needed before cutoff.

### Phase 4 — Validate
- Run automated checks first (lint, typecheck, tests).
- Flag anything requiring manual/human verification explicitly.
- Update plan status in `thoughts/shared/plans/` when complete.

## Core Rules

- **Never exceed 60% context.** When approaching the limit, wrap up and hand off.
- **Always clear context between phases.** Each phase starts fresh with only the relevant thoughts doc.
- **All outputs must be saved to `thoughts/`.** Nothing meaningful should exist only in context.
- When referencing a file found in `searchable/`, strip the `searchable/` prefix to get the real path.

## Sub-Agents for Research

| Agent | Purpose |
|---|---|
| `codebase-analyzer` | Deep-dive on how a specific component works |
| `codebase-locator` | Find which files/dirs are relevant to a topic |
| `codebase-pattern-finder` | Find existing patterns without evaluating them |
| `thoughts-locator` | Find relevant docs already in `thoughts/` |
| `thoughts-analyzer` | Extract key decisions and rationale from a thoughts doc |
| `web-search-researcher` | External research — must return links in findings |

## When to Use `thoughts/`

| Situation | Action |
|---|---|
| Starting research | Check `thoughts/searchable/` first — it may already exist |
| Finishing research | Save to `thoughts/shared/research/` before clearing context |
| Approaching 60% context | Write a handoff doc to `thoughts/{your-name}/notes/` |
| Starting a new session | Load the relevant plan or research doc first |
| Completing a phase | Update the doc's `status` field |
