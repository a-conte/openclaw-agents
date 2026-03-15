'use client';

import useSWR from 'swr';
import { Radar, AlertTriangle, Eye, Lightbulb } from 'lucide-react';
import { Badge } from '@/components/shared/Badge';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { InlineError } from '@/components/shared/InlineError';
import { useDashboardFilters } from '@/components/providers/DashboardProviders';
import { usePollingInterval } from '@/hooks/usePageVisibility';
import { cn } from '@/lib/utils';
import { relativeTime } from '@/lib/utils';
import type { RadarItem } from '@/lib/types';

const fetcher = (url: string) => fetch(url).then(r => r.json());

const TYPE_CONFIG = {
  alert: { icon: AlertTriangle, color: '#e94560', label: 'Alert' },
  watch: { icon: Eye, color: '#ffd166', label: 'Watch' },
  opportunity: { icon: Lightbulb, color: '#FB5656', label: 'Opportunity' },
};

const SIGNAL_COLORS = {
  high: '#e94560',
  medium: '#ffd166',
  low: '#555555',
};

function RadarContent() {
  const { filters } = useDashboardFilters();
  const refreshInterval = usePollingInterval(30000);
  const { data, isLoading, error, mutate } = useSWR('/api/radar', fetcher, { refreshInterval });
  const items: RadarItem[] = (data?.items || []).filter((item: RadarItem) => {
    const needle = filters.search.trim().toLowerCase();
    if (filters.focus === 'signals' && item.signal === 'low') return false;
    if (!needle) return true;
    return [item.title, item.body || '', item.source, item.type].join(' ').toLowerCase().includes(needle);
  });

  return (
    <div className="p-6 max-w-5xl overflow-auto h-full">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-text-primary font-[var(--font-heading)]">Radar</h1>
        <p className="text-sm text-text-tertiary mt-1">
          {items.length} signal{items.length !== 1 ? 's' : ''} detected
        </p>
      </div>

      {error && <div className="mb-4"><InlineError message="Failed to load radar data." onRetry={() => mutate()} /></div>}

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-surface-2 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Radar size={32} />}
          title={filters.search || filters.focus ? 'No signals match the current filters' : 'Radar is clear'}
          description={filters.search || filters.focus ? `Try clearing search or focus${filters.focus ? ` (${filters.focus})` : ''}.` : 'No signals detected. Agent inboxes are empty.'}
        />
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.opportunity;
            const Icon = config.icon;
            return (
              <div
                key={item.id}
                className="bg-surface-1 border border-border rounded-lg p-4 hover:border-border-hover transition-colors"
                style={{ borderLeftColor: config.color, borderLeftWidth: 3 }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <Icon size={16} style={{ color: config.color }} className="mt-0.5 shrink-0" />
                    <div>
                      <h3 className="text-sm font-medium text-text-primary">{item.title}</h3>
                      {item.body && (
                        <p className="text-xs text-text-tertiary mt-1 line-clamp-2">{item.body}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-text-tertiary">{item.source}</span>
                        <span className="text-xs text-text-tertiary">{relativeTime(item.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    <Badge color={config.color}>{config.label}</Badge>
                    <Badge color={SIGNAL_COLORS[item.signal]}>{item.signal}</Badge>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function RadarPage() {
  return (
    <ErrorBoundary name="Radar">
      <RadarContent />
    </ErrorBoundary>
  );
}
