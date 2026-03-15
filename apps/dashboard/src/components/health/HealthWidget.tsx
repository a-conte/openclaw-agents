'use client';

import useSWR from 'swr';
import { Heart, Server, HardDrive, Clock } from 'lucide-react';
import { AGENT_EMOJIS } from '@/lib/constants';
import { cn } from '@/lib/utils';

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface AgentHealth {
  agentId: string;
  lastActivity: number | null;
  status: 'online' | 'warning' | 'offline';
}

export function HealthWidget() {
  const { data: health } = useSWR('/api/health', fetcher, { refreshInterval: 15000 });
  const { data: metrics } = useSWR('/api/metrics', fetcher, { refreshInterval: 30000 });

  const agents: AgentHealth[] = (metrics?.agents || []).map((a: { agentId: string; lastActivity: number | null }) => ({
    agentId: a.agentId,
    lastActivity: a.lastActivity,
    status: getStatus(a.lastActivity),
  }));

  const onlineCount = agents.filter(a => a.status === 'online').length;
  const warningCount = agents.filter(a => a.status === 'warning').length;

  return (
    <div className="bg-surface-2 border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Heart size={14} className="text-text-tertiary" />
        <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">System Health</h3>
      </div>

      {/* Gateway Status */}
      <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border">
        <Server size={14} className="text-text-tertiary" />
        <span className="text-sm text-text-secondary">Gateway</span>
        <span className={cn(
          'ml-auto text-xs font-medium',
          health?.ok ? 'text-status-online' : 'text-status-error'
        )}>
          {health?.ok ? 'Online' : 'Offline'}
        </span>
      </div>

      {/* Agent Health Grid */}
      <div className="space-y-1.5">
        {agents.map((agent) => (
          <div key={agent.agentId} className="flex items-center gap-2">
            <span className="text-xs">{AGENT_EMOJIS[agent.agentId] || '🤖'}</span>
            <span className="text-xs text-text-secondary flex-1">{agent.agentId}</span>
            <div className={cn(
              'w-2 h-2 rounded-full',
              agent.status === 'online' && 'bg-status-online',
              agent.status === 'warning' && 'bg-amber-400',
              agent.status === 'offline' && 'bg-status-error',
            )} />
            <span className="text-[10px] text-text-tertiary w-14 text-right">
              {agent.lastActivity ? formatAge(agent.lastActivity) : 'never'}
            </span>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="mt-3 pt-3 border-t border-border flex items-center gap-3 text-[10px] text-text-tertiary">
        <span className="text-status-online">{onlineCount} online</span>
        {warningCount > 0 && <span className="text-amber-400">{warningCount} warning</span>}
        <span className="ml-auto">{agents.length} total</span>
      </div>
    </div>
  );
}

function getStatus(lastActivity: number | null): 'online' | 'warning' | 'offline' {
  if (!lastActivity) return 'offline';
  const age = Date.now() - lastActivity;
  if (age < 5 * 60 * 1000) return 'online';
  if (age < 60 * 60 * 1000) return 'warning';
  return 'offline';
}

function formatAge(ts: number): string {
  const age = Math.floor((Date.now() - ts) / 1000);
  if (age < 60) return `${age}s`;
  if (age < 3600) return `${Math.floor(age / 60)}m`;
  if (age < 86400) return `${Math.floor(age / 3600)}h`;
  return `${Math.floor(age / 86400)}d`;
}
