'use client';

import { useAgents } from '@/hooks/useAgents';
import { AgentGrid } from '@/components/agents/AgentGrid';
import { Bot } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { MISSION_STATEMENT } from '@/lib/constants';

export default function AgentsPage() {
  const { agents, isLoading } = useAgents();

  return (
    <div className="p-6 max-w-5xl overflow-auto h-full">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-text-primary font-[var(--font-heading)]">Agents</h1>
        <p className="text-sm text-text-tertiary mt-1">
          {agents.length} agent{agents.length !== 1 ? 's' : ''} configured
        </p>
      </div>

      {/* Team Mission Statement */}
      <div className="bg-surface-1 border border-border rounded-lg p-4 mb-6">
        <h2 className="text-xs uppercase tracking-[0.1em] text-text-tertiary font-medium mb-2">Team Mission</h2>
        <p className="text-sm text-text-secondary leading-relaxed">{MISSION_STATEMENT}</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="h-[160px] bg-surface-2 border border-border rounded-lg animate-pulse" />
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
  );
}
