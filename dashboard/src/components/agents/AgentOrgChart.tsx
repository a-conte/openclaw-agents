'use client';

import { AgentCard } from './AgentCard';
import type { Agent } from '@/lib/types';

interface AgentOrgChartProps {
  agents: Agent[];
}

export function AgentOrgChart({ agents }: AgentOrgChartProps) {
  const mainAgent = agents.find((a) => a.agentId === 'main');
  const subordinates = agents.filter((a) => a.agentId !== 'main');

  // If main isn't in the filtered list, fall back to a simple grid
  if (!mainAgent) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {agents.map((agent) => (
          <AgentCard key={agent.agentId} agent={agent} />
        ))}
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* === Desktop org chart (md+) === */}
      <div className="hidden md:block">
        {/* Main hero card — centered */}
        <div className="flex justify-center">
          <div className="w-full max-w-md">
            <AgentCard agent={mainAgent} hero />
          </div>
        </div>

        {subordinates.length > 0 && (
          <>
            {/* Vertical connector from main */}
            <div className="flex justify-center">
              <div className="w-px h-6 bg-border" />
            </div>

            {/* Horizontal bar + vertical drops + subordinate cards */}
            <div className="relative">
              {/* Horizontal bar spanning from first to last subordinate center */}
              <div
                className="absolute top-0 border-t border-border"
                style={{
                  left: `calc(${100 / subordinates.length / 2}%)`,
                  right: `calc(${100 / subordinates.length / 2}%)`,
                }}
              />

              {/* Subordinate cards with vertical drops */}
              <div
                className="grid gap-4"
                style={{ gridTemplateColumns: `repeat(${subordinates.length}, minmax(0, 1fr))` }}
              >
                {subordinates.map((agent) => (
                  <div key={agent.agentId} className="flex flex-col items-center">
                    {/* Vertical drop line */}
                    <div className="w-px h-6 bg-border" />
                    <AgentCard agent={agent} />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* === Mobile layout (below md) === */}
      <div className="md:hidden space-y-3">
        <AgentCard agent={mainAgent} hero />
        {subordinates.length > 0 && (
          <div className="ml-4 border-l-2 border-border pl-4 space-y-3">
            {subordinates.map((agent) => (
              <AgentCard key={agent.agentId} agent={agent} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
