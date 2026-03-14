'use client';

import { useAgents } from '@/hooks/useAgents';
import { AgentOrgChart } from '@/components/agents/AgentOrgChart';
import { useDashboardFilters } from '@/components/providers/DashboardProviders';
import { Bot } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { InlineError } from '@/components/shared/InlineError';
import { MISSION_STATEMENT } from '@/lib/constants';
import { getAgentStatus } from '@/lib/utils';

export default function AgentsPage() {
  const { filters } = useDashboardFilters();
  const { agents, isLoading, error } = useAgents();
  const searchNeedle = filters.search.trim().toLowerCase();

  const filteredAgents = agents.filter((agent: any) => {
    if (filters.agentId && agent.agentId !== filters.agentId) return false;
    if (filters.focus === 'quiet-agents') {
      const lastActivity = agent.sessions?.recent?.[0]?.updatedAt;
      if (getAgentStatus(lastActivity) === 'online') return false;
    }
    if (!searchNeedle) return true;
    return [agent.agentId, agent.name || '', agent.model || ''].join(' ').toLowerCase().includes(searchNeedle);
  });

  return (
    <div className="p-6 max-w-5xl overflow-auto h-full">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-text-primary font-[var(--font-heading)]">Agents</h1>
        <p className="text-sm text-text-tertiary mt-1">
          {filteredAgents.length} agent{filteredAgents.length !== 1 ? 's' : ''} shown
        </p>
      </div>

      {/* Team Mission Statement */}
      <div className="bg-surface-1 border border-border rounded-lg p-4 mb-6">
        <h2 className="text-xs uppercase tracking-[0.1em] text-text-tertiary font-medium mb-2">Team Mission</h2>
        <p className="text-sm text-text-secondary leading-relaxed">{MISSION_STATEMENT}</p>
      </div>

      {error && <InlineError message="Failed to load agents." />}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="h-[160px] bg-surface-2 border border-border rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filteredAgents.length === 0 ? (
        <EmptyState
          icon={<Bot size={32} />}
          title="No agents match the current filters"
          description={`No agents match the current workspace filters${filters.focus ? ` (${filters.focus})` : ''}. Try clearing search, agent, or focus.`}
        />
      ) : (
        <AgentOrgChart agents={filteredAgents} />
      )}
    </div>
  );
}
