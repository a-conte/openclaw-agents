'use client';

import Link from 'next/link';
import { Circle, Clock, MessageSquare } from 'lucide-react';
import { cn, relativeTime, getAgentStatus } from '@/lib/utils';
import { MODEL_DISPLAY, AGENT_COLORS } from '@/lib/constants';
import { Badge } from '@/components/shared/Badge';
import type { Agent } from '@/lib/types';

interface AgentCardProps {
  agent: Agent;
}

export function AgentCard({ agent }: AgentCardProps) {
  const lastActivity = agent.sessions.recent[0]?.updatedAt;
  const status = getAgentStatus(lastActivity);
  const model = MODEL_DISPLAY[agent.model || ''] || { label: agent.model || 'Unknown', color: '#6b7280' };
  const color = AGENT_COLORS[agent.agentId] || '#6b7280';

  return (
    <Link href={`/agents/${agent.agentId}`}>
      <div
        className="group relative bg-surface-2 border border-border rounded-lg p-4 hover:border-border-hover transition-all cursor-pointer"
        style={{ borderLeftColor: color, borderLeftWidth: 3 }}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">{agent.emoji || '🤖'}</span>
            <div>
              <h3 className="text-sm font-semibold text-text-primary">
                {agent.agentId}
              </h3>
              <Badge color={model.color}>{model.label}</Badge>
            </div>
          </div>
          <Circle
            size={8}
            className={cn(
              'fill-current mt-1',
              status === 'online' && 'text-status-online',
              status === 'warning' && 'text-status-warning',
              status === 'offline' && 'text-status-offline'
            )}
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
            <Clock size={12} />
            <span>{lastActivity ? relativeTime(lastActivity) : 'No activity'}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
            <MessageSquare size={12} />
            <span>{agent.sessions.count} session{agent.sessions.count !== 1 ? 's' : ''}</span>
          </div>
          {agent.heartbeat.enabled && (
            <div className="text-xs text-text-tertiary">
              Heartbeat: every {agent.heartbeat.every}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
