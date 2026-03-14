---
date: "2026-03-14T00:00:00-04:00"
topic: "Dashboard reliability and efficiency improvements"
tags: [plan, dashboard, reliability]
status: planned
last_updated: "2026-03-14"
---

# OpenClaw Dashboard — Reliability & Efficiency Improvements

**Created:** 2026-03-14
**Status:** Planned

## Context

The dashboard is a Next.js 16 / React 19 app with SWR polling, file-based JSON storage, and SSE for chat streaming. It works well but has several reliability gaps (no error boundaries, silent failures, race conditions on file writes) and efficiency issues (aggressive polling even when tab is hidden, redundant sidebar requests, synchronous git calls blocking the event loop). This plan addresses the highest-impact issues without over-engineering — no database migration, no auth layer, no test framework.

---

## Phase 1: Error Boundaries & Crash Recovery

**Why:** A rendering error in any component currently crashes the entire app with no recovery path.

- **Create** `src/components/shared/ErrorBoundary.tsx` — class component with fallback UI and "Retry" button
- **Create** `src/app/error.tsx` — App Router catch-all error page with reset
- **Wrap** independent sections in `command/page.tsx`, `Sidebar.tsx` layout so one panel failure doesn't take down the page

## Phase 2: Visibility-Based Polling Pause

**Why:** The single biggest efficiency win — eliminates all background network requests when the tab is hidden.

- **Create** `src/hooks/usePageVisibility.ts` — returns `boolean` from `document.visibilityState`
- **Add** `usePollingInterval(baseInterval)` helper that returns `0` (SWR = don't poll) when hidden
- **Apply** to all 8 SWR hooks in `src/hooks/` and the 3 inline `useSWR` calls in `Sidebar.tsx`

## Phase 3: Consolidate Sidebar Polling (3 requests → 1)

**Why:** Sidebar independently polls `/api/health`, `/api/dashboard-summary`, `/api/radar` every 15-30s. Summary already calls health internally.

- **Extend** `/api/dashboard-summary/route.ts` to include `radarCount` in its response
- **Create** `src/hooks/useDashboardSummary.ts` — single SWR hook for all sidebar data
- **Refactor** `Sidebar.tsx` to use the single hook instead of 3 separate `useSWR` calls

## Phase 4: Memoize CommandPalette Fuse Index

**Why:** `new Fuse(commands, ...)` is recreated on every render. Commands list is static.

- **Modify** `src/components/layout/CommandPalette.tsx` — wrap `commands` and `fuse` in `useMemo`

## Phase 5: File Write Safety (In-Process Locking)

**Why:** Concurrent API requests can read-modify-write `tasks.json` simultaneously, causing data loss.

- **Create** `src/lib/file-lock.ts` — per-file in-process mutex using promise chaining
- **Wrap** write operations in `tasks-store.ts` and `workflow-runs-store.ts` with `withFileLock()`

## Phase 6: Input Validation on Write Endpoints

**Why:** POST/PATCH endpoints accept arbitrary JSON with no validation, risking data corruption.

- **Modify** `/api/tasks/route.ts` — validate `title` (non-empty string), `status` (∈ TASK_STATUSES), `priority` (∈ TASK_PRIORITIES)
- **Modify** `/api/tasks/[taskId]/route.ts` — same validation for updates
- **Add** try/catch around `request.json()` calls, return 400 on parse failure

## Phase 7: Surface SWR Errors to Users

**Why:** When API calls fail, components silently show stale or empty data with no indication of the problem.

- **Create** `src/components/shared/InlineError.tsx` — subtle error banner with optional "Retry" button
- **Add** error state rendering in `command/page.tsx`, `agents/page.tsx`, `pipeline/page.tsx`

## Phase 8: Cache Expensive Endpoints & Async Git

**Why:** Content and metrics APIs re-scan the filesystem on every request. Git status calls block the event loop.

- **Modify** `/api/content/route.ts` — wrap directory scan in `getCached('content', { ttlMs: 30000, staleMs: 60000 })`
- **Modify** `/api/metrics/route.ts` — wrap in `getCached('metrics', { ttlMs: 15000, staleMs: 30000 })`
- **Modify** `dashboard-data.ts` — replace `execSync` git calls with async `execFile` (already used by `openclaw-cli.ts`)

## Phase 9: Structured Logging

**Why:** Scattered `console.error` and silent catch blocks make debugging difficult.

- **Create** `src/lib/logger.ts` — JSON-structured logger with timestamps and context
- **Replace** `console.error` in `gateway.ts`, `chat-executor.ts`, and empty catches in store files

---

## Implementation Order & Risk

| Phase | Effort | Risk | Impact |
|-------|--------|------|--------|
| 1. Error boundaries | ~1h | Very low | High — crash recovery |
| 2. Visibility polling | ~30m | Very low | High — eliminates background requests |
| 3. Sidebar consolidation | ~30m | Low | Medium — 2 fewer requests/cycle |
| 4. Fuse memoization | ~5m | Zero | Low — micro-optimization |
| 5. File locking | ~1h | Low | Medium — prevents data corruption |
| 6. Input validation | ~30m | Zero | Medium — prevents bad data |
| 7. Error UI | ~1h | Very low | Medium — user-visible errors |
| 8. Cache + async git | ~1h | Low | Medium — reduces I/O |
| 9. Structured logging | ~30m | Zero | Low — debugging foundation |

**Batch 1 (do first):** Phases 1-4 — all low-risk, high-confidence, visually verifiable
**Batch 2:** Phases 5-6 — data integrity protection
**Batch 3:** Phases 7-9 — observability and polish

## Critical Files

| File | Role |
|------|------|
| `dashboard/src/components/providers/DashboardProviders.tsx` | SWR config, global context |
| `dashboard/src/components/layout/Sidebar.tsx` | 3 independent polling endpoints |
| `dashboard/src/lib/tasks-store.ts` | File-based writes with race condition risk |
| `dashboard/src/lib/workflow-runs-store.ts` | Same |
| `dashboard/src/lib/dashboard-data.ts` | Sync git calls, server-side loaders |
| `dashboard/src/lib/server-cache.ts` | Existing cache utility to reuse |
| `dashboard/src/lib/constants.ts` | `POLL_INTERVAL`, `TASK_STATUSES`, `TASK_PRIORITIES` |
| `dashboard/src/hooks/*` | All 8 SWR hooks need visibility-aware polling |

## Deliberately Excluded

- **Database migration** — file-based stores are fine for a solo dashboard; locking (Phase 5) addresses the main risk
- **Rate limiting / auth** — personal tool on a private network
- **Test framework** — important eventually, but orthogonal to reliability/efficiency goals
- **React.memo everywhere** — without profiling data, premature; polling reduction has much larger effect

## Verification

| Phase | How to verify |
|-------|---------------|
| 1 | Intentionally throw in a component → error boundary catches it, shows retry |
| 2 | Open Network tab → switch tabs → no requests fire → switch back → polling resumes |
| 3 | Open Network tab → sidebar makes 1 request instead of 3 |
| 5 | Fire rapid concurrent task updates → no data loss in `tasks.json` |
| 7 | Stop the backend → error banners appear in the UI |
| 8 | Check Network tab for `/api/content` and `/api/metrics` → cached responses |
