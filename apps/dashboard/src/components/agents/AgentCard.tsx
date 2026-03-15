'use client';

import Link from 'next/link';
import { Circle, Clock, MessageSquare, ListTodo } from 'lucide-react';
import { cn, relativeTime, getAgentStatus } from '@/lib/utils';
import { AGENT_COLORS, AGENT_ROLES, AGENT_EMOJIS } from '@/lib/constants';
import { Badge } from '@/components/shared/Badge';
import type { Agent } from '@/lib/types';

interface AgentCardProps {
  agent: Agent;
  hero?: boolean;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  online: { label: 'working', color: 'text-status-online' },
  warning: { label: 'idle', color: 'text-status-warning' },
  offline: { label: 'offline', color: 'text-status-offline' },
};

export function AgentCard({ agent, hero }: AgentCardProps) {
  const lastActivity = agent.sessions.recent[0]?.updatedAt;
  const status = getAgentStatus(lastActivity);
  const color = AGENT_COLORS[agent.agentId] || '#555';
  const role = AGENT_ROLES[agent.agentId] || '';
  const emoji = AGENT_EMOJIS[agent.agentId] || '';
  const mapped = STATUS_MAP[status] || STATUS_MAP.offline;

  return (
    <Link href={`/agents/${agent.agentId}`}>
      <div
        className={cn(
          'group relative bg-surface-1 border border-border rounded-lg hover:border-border-hover transition-all duration-200 cursor-pointer',
          hero ? 'p-5' : 'p-4',
        )}
        style={{ borderLeftColor: color, borderLeftWidth: 3 }}
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            {hero && emoji && (
              <span className="text-2xl">{emoji}</span>
            )}
            <div>
              <h3 className={cn('font-semibold text-text-primary', hero ? 'text-base' : 'text-sm')}>
                {agent.agentId}
              </h3>
              {role && (
                <p className={cn('text-text-tertiary mt-0.5 leading-relaxed', hero ? 'text-sm' : 'text-xs')}>
                  {role}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Circle size={8} className={cn('fill-current', mapped.color)} />
            <span className={cn('text-xs', mapped.color)}>{mapped.label}</span>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-3">
          <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
            <Clock size={12} />
            <span>{lastActivity ? relativeTime(lastActivity) : 'No activity'}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
            <MessageSquare size={12} />
            <span>{agent.sessions.count} sessions</span>
          </div>
          {agent.heartbeat.enabled && (
            <div className="text-xs text-text-tertiary">
              HB: {agent.heartbeat.every}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
