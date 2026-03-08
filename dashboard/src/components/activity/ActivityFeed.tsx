'use client';

import { useActivity } from '@/hooks/useAgents';
import { relativeTime } from '@/lib/utils';
import { AGENT_COLORS } from '@/lib/constants';
import { Activity } from 'lucide-react';

export function ActivityFeed() {
  const { events, isLoading } = useActivity();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 bg-surface-3 rounded-md animate-pulse" />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-text-tertiary text-sm">
        No recent activity
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {events.map((event: any) => (
        <div
          key={event.id}
          className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-surface-3 transition-colors"
        >
          <span className="text-base">{event.emoji}</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-text-secondary truncate">{event.message}</p>
          </div>
          <span className="text-[11px] text-text-tertiary whitespace-nowrap">
            {relativeTime(event.timestamp)}
          </span>
        </div>
      ))}
    </div>
  );
}
