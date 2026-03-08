'use client';

import { useAgents } from '@/hooks/useAgents';
import { AgentGrid } from '@/components/agents/AgentGrid';
import { ActivityFeed } from '@/components/activity/ActivityFeed';
import { Bot, Activity } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';

export default function AgentsPage() {
  const { agents, isLoading } = useAgents();

  return (
    <div className="flex h-full">
      <div className="flex-1 p-6 overflow-auto">
        <div className="mb-6">
          <h1 className="text-lg font-semibold text-text-primary">Agents</h1>
          <p className="text-sm text-text-tertiary mt-1">
            {agents.length} agent{agents.length !== 1 ? 's' : ''} configured
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="h-[140px] bg-surface-2 border border-border rounded-lg animate-pulse" />
            ))}
          </div>
        ) : agents.length === 0 ? (
          <EmptyState
            icon={<Bot size={32} />}
            title="No agents found"
            description="Make sure the OpenClaw gateway is running"
          />
        ) : (
          <AgentGrid agents={agents} />
        )}
      </div>

      <aside className="w-[320px] border-l border-border bg-surface-2 p-4 overflow-auto hidden xl:block">
        <div className="flex items-center gap-2 mb-4">
          <Activity size={14} className="text-text-tertiary" />
          <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Activity</h2>
        </div>
        <ActivityFeed />
      </aside>
    </div>
  );
}
