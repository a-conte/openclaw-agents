'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAgent } from '@/hooks/useAgents';
import { ArrowLeft, Circle } from 'lucide-react';
import { cn, getAgentStatus, relativeTime } from '@/lib/utils';
import { MODEL_DISPLAY, AGENT_FILES, AGENT_COLORS } from '@/lib/constants';
import { Badge } from '@/components/shared/Badge';
import { Button } from '@/components/shared/Button';
import { FileEditor } from '@/components/agents/FileEditor';

const TABS = ['Overview', 'SOUL.md', 'IDENTITY.md', 'TOOLS.md', 'HEARTBEAT.md', 'MEMORY.md', 'Sessions'] as const;

export default function AgentDetailPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const router = useRouter();
  const { agent, isLoading, mutate } = useAgent(agentId);
  const [activeTab, setActiveTab] = useState<string>('Overview');

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="h-8 w-48 bg-surface-3 rounded animate-pulse mb-6" />
        <div className="h-64 bg-surface-2 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="p-6 text-text-tertiary">Agent not found</div>
    );
  }

  const health = agent.health;
  const lastActivity = health?.sessions?.recent?.[0]?.updatedAt;
  const status = getAgentStatus(lastActivity);
  const model = MODEL_DISPLAY[health?.model || ''] || { label: 'Unknown', color: '#6b7280' };
  const color = AGENT_COLORS[agentId] || '#6b7280';

  return (
    <div className="p-6 max-w-5xl">
      <button
        onClick={() => router.push('/agents')}
        className="flex items-center gap-1.5 text-xs text-text-tertiary hover:text-text-secondary mb-4 transition-colors"
      >
        <ArrowLeft size={14} />
        Back to agents
      </button>

      <div className="flex items-center gap-3 mb-6">
        <span className="text-2xl">{agent.emoji}</span>
        <div>
          <h1 className="text-lg font-semibold">{agentId}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Circle size={8} className={cn('fill-current', status === 'online' ? 'text-status-online' : status === 'warning' ? 'text-status-warning' : 'text-status-offline')} />
            <Badge color={model.color}>{model.label}</Badge>
            {lastActivity && <span className="text-xs text-text-tertiary">{relativeTime(lastActivity)}</span>}
          </div>
        </div>
      </div>

      <div className="flex gap-1 border-b border-border mb-6">
        {TABS.map((tab) => {
          const hasFile = tab.endsWith('.md') && agent.files[tab];
          if (tab.endsWith('.md') && !hasFile && tab !== 'Sessions' && tab !== 'Overview') return null;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px',
                activeTab === tab
                  ? 'text-text-primary border-accent'
                  : 'text-text-tertiary border-transparent hover:text-text-secondary'
              )}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {activeTab === 'Overview' && (
        <div className="space-y-4">
          <div className="bg-surface-2 border border-border rounded-lg p-4">
            <h3 className="text-sm font-medium mb-3">Agent Details</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-text-tertiary">Sessions:</span>{' '}
                <span className="text-text-secondary">{health?.sessions?.count || 0}</span>
              </div>
              <div>
                <span className="text-text-tertiary">Heartbeat:</span>{' '}
                <span className="text-text-secondary">
                  {health?.heartbeat?.enabled ? `Every ${health.heartbeat.every}` : 'Disabled'}
                </span>
              </div>
              <div>
                <span className="text-text-tertiary">Default:</span>{' '}
                <span className="text-text-secondary">{health?.isDefault ? 'Yes' : 'No'}</span>
              </div>
            </div>
          </div>
          {agent.files['IDENTITY.md'] && (
            <div className="bg-surface-2 border border-border rounded-lg p-4">
              <h3 className="text-sm font-medium mb-3">Identity</h3>
              <FileEditor agentId={agentId} filename="IDENTITY.md" content={agent.files['IDENTITY.md']} onSave={() => mutate()} />
            </div>
          )}
        </div>
      )}

      {activeTab.endsWith('.md') && agent.files[activeTab] && (
        <FileEditor
          agentId={agentId}
          filename={activeTab}
          content={agent.files[activeTab]}
          onSave={() => mutate()}
        />
      )}

      {activeTab === 'Sessions' && (
        <div className="space-y-2">
          {health?.sessions?.recent?.map((session: any) => (
            <div key={session.key} className="bg-surface-2 border border-border rounded-lg p-3 text-sm">
              <div className="font-mono text-xs text-text-tertiary">{session.key}</div>
              <div className="text-text-secondary mt-1">{relativeTime(session.updatedAt)}</div>
            </div>
          )) || <div className="text-text-tertiary text-sm">No sessions</div>}
        </div>
      )}
    </div>
  );
}
