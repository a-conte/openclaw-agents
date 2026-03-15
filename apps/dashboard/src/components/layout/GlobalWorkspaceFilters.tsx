'use client';

import { Filter, Search, X } from 'lucide-react';
import { ACTIVE_AGENT_IDS, AGENT_EMOJIS } from '@/lib/constants';
import { useDashboardFilters } from '@/components/providers/DashboardProviders';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

const VISIBLE_PATHS = new Set(['/command', '/agents', '/projects', '/pipeline', '/radar', '/system']);
const FOCUS_PATHS: Record<string, string> = {
  attention: '/command',
  'quiet-agents': '/agents',
  'active-projects': '/projects',
  'pipeline-hotspots': '/pipeline',
  signals: '/radar',
  'system-check': '/system',
};

export function GlobalWorkspaceFilters() {
  const pathname = usePathname();
  const { filters, setSearch, setAgentId, setFocus, resetFilters } = useDashboardFilters();

  useEffect(() => {
    if (!filters.focus) return;
    const expectedPath = FOCUS_PATHS[filters.focus];
    if (expectedPath && expectedPath !== pathname) {
      setFocus('');
    }
  }, [filters.focus, pathname, setFocus]);

  if (!VISIBLE_PATHS.has(pathname)) return null;

  return (
    <div className="sticky top-0 z-20 border-b border-border bg-surface-1/88 px-4 py-3 backdrop-blur xl:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-text-tertiary">
          <Filter size={13} />
          Workspace filters
        </div>

        <div className="relative min-w-[220px] flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            value={filters.search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search agents, tasks, projects, and signals..."
            className="w-full rounded-md border border-border bg-surface-3 pl-9 pr-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-border-active"
          />
        </div>

        <select
          value={filters.agentId}
          onChange={(event) => setAgentId(event.target.value)}
          className="rounded-md border border-border bg-surface-3 px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-border-active"
        >
          <option value="">All agents</option>
          {ACTIVE_AGENT_IDS.map((id) => (
            <option key={id} value={id}>{AGENT_EMOJIS[id]} {id}</option>
          ))}
        </select>

        {filters.focus && (
          <button onClick={() => setFocus('')} className="inline-flex items-center gap-1 rounded-full border border-accent/25 bg-accent/10 px-2.5 py-1 text-xs text-accent transition hover:bg-accent/15">
            Focus: {filters.focus}
            <X size={11} />
          </button>
        )}

        {(filters.search || filters.agentId || filters.focus) && (
          <button onClick={resetFilters} className="inline-flex items-center gap-1 rounded-md px-2.5 py-2 text-xs text-text-secondary transition hover:bg-surface-3 hover:text-text-primary">
            <X size={12} />
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
