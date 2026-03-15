'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { Brain } from 'lucide-react';
import { AGENT_EMOJIS, AGENT_COLORS } from '@/lib/constants';
import { Badge } from '@/components/shared/Badge';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { InlineError } from '@/components/shared/InlineError';
import { usePollingInterval } from '@/hooks/usePageVisibility';
import { cn } from '@/lib/utils';
import type { MemoryCategory } from '@/lib/types';

const fetcher = (url: string) => fetch(url).then(r => r.json());

function MemoryContent() {
  const refreshInterval = usePollingInterval(60000);
  const { data, isLoading, error, mutate } = useSWR('/api/memory', fetcher, { refreshInterval });
  const [agentFilter, setAgentFilter] = useState('');

  const categories: MemoryCategory[] = data?.categories || [];

  const agents = useMemo(() => {
    return [...new Set(categories.map(c => c.agentId))].sort();
  }, [categories]);

  const filtered = agentFilter
    ? categories.filter(c => c.agentId === agentFilter)
    : categories;

  return (
    <div className="p-6 max-w-5xl overflow-auto h-full">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-text-primary font-[var(--font-heading)]">Memory</h1>
        <p className="text-sm text-text-tertiary mt-1">
          {categories.length} categories across {agents.length} agents
        </p>
      </div>

      {error && <div className="mb-4"><InlineError message="Failed to load memory data." onRetry={() => mutate()} /></div>}

      {/* Agent filter */}
      <div className="flex items-center gap-1.5 mb-6 flex-wrap">
        <button
          onClick={() => setAgentFilter('')}
          className={cn(
            'px-2.5 py-1 text-xs rounded-full transition-colors',
            !agentFilter ? 'bg-accent/15 text-accent' : 'bg-surface-3 text-text-tertiary hover:text-text-secondary'
          )}
        >
          All
        </button>
        {agents.map(id => (
          <button
            key={id}
            onClick={() => setAgentFilter(id)}
            className={cn(
              'px-2.5 py-1 text-xs rounded-full transition-colors',
              agentFilter === id ? 'bg-accent/15 text-accent' : 'bg-surface-3 text-text-tertiary hover:text-text-secondary'
            )}
          >
            {AGENT_EMOJIS[id] || '🤖'} {id}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-40 bg-surface-2 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Brain size={32} />} title="No memories" description="Agent MEMORY.md files are empty" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((cat, i) => (
            <div key={`${cat.agentId}-${cat.category}-${i}`} className="bg-surface-1 border border-border rounded-lg p-4 hover:border-border-hover transition-colors">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-text-primary">{cat.category}</h3>
                <Badge color={AGENT_COLORS[cat.agentId] || '#555'}>
                  {AGENT_EMOJIS[cat.agentId] || '🤖'} {cat.agentId}
                </Badge>
              </div>
              <ul className="space-y-1.5">
                {cat.entries.slice(0, 8).map((entry, j) => (
                  <li key={j} className="text-xs text-text-secondary flex items-start gap-2">
                    <span className="text-text-tertiary mt-0.5 shrink-0">•</span>
                    <span>{entry}</span>
                  </li>
                ))}
                {cat.entries.length > 8 && (
                  <li className="text-xs text-text-tertiary">+{cat.entries.length - 8} more</li>
                )}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MemoryPage() {
  return (
    <ErrorBoundary name="Memory">
      <MemoryContent />
    </ErrorBoundary>
  );
}
