'use client';

import { cn } from '@/lib/utils';
import { AGENT_COLORS, AGENT_EMOJIS } from '@/lib/constants';

interface HeartbeatGridProps {
  heartbeats: Array<{
    agentId: string;
    heartbeat: {
      enabled: boolean;
      every: string;
      everyMs: number;
    };
  }>;
}

export function HeartbeatGrid({ heartbeats }: HeartbeatGridProps) {
  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="bg-surface-2 border border-border rounded-lg p-4 overflow-x-auto">
      <h3 className="text-sm font-medium mb-4">Heartbeat Schedule</h3>
      <div className="min-w-[800px]">
        <div className="flex items-center mb-2">
          <div className="w-[120px] shrink-0" />
          {hours.map(h => (
            <div key={h} className="flex-1 text-center text-[10px] text-text-tertiary">
              {h.toString().padStart(2, '0')}
            </div>
          ))}
        </div>
        {heartbeats.map(({ agentId, heartbeat }) => (
          <div key={agentId} className="flex items-center mb-1">
            <div className="w-[120px] shrink-0 flex items-center gap-2">
              <span className="text-sm">{AGENT_EMOJIS[agentId] || '🤖'}</span>
              <span className="text-xs text-text-secondary truncate">{agentId}</span>
            </div>
            {hours.map(h => (
              <div
                key={h}
                className={cn(
                  'flex-1 h-6 border border-surface-0 rounded-sm',
                  heartbeat.enabled
                    ? 'bg-accent/20'
                    : 'bg-surface-3'
                )}
                style={heartbeat.enabled ? { backgroundColor: (AGENT_COLORS[agentId] || '#7c5cfc') + '33' } : undefined}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs text-text-tertiary">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-accent/20" />
          <span>Active</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-surface-3" />
          <span>Disabled</span>
        </div>
      </div>
    </div>
  );
}
