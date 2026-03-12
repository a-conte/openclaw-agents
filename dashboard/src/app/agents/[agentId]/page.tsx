'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { useAgent } from '@/hooks/useAgents';
import { ArrowLeft, Circle, Zap, Clock, ListTodo, Lightbulb, Workflow } from 'lucide-react';
import { cn, getAgentStatus, relativeTime } from '@/lib/utils';
import { MODEL_DISPLAY, AGENT_FILES, AGENT_COLORS, AGENT_ROLES } from '@/lib/constants';
import { Badge } from '@/components/shared/Badge';
import { Button } from '@/components/shared/Button';
import { FileEditor } from '@/components/agents/FileEditor';

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface Recommendation {
  type: 'workflow' | 'cron' | 'task' | 'suggestion';
  title: string;
  description: string;
  source?: string;
  status?: 'active' | 'available' | 'suggested';
}

const TYPE_CONFIG: Record<string, { icon: typeof Zap; color: string; label: string }> = {
  workflow: { icon: Workflow, color: '#8338ec', label: 'Workflow' },
  cron: { icon: Clock, color: '#4A9EFF', label: 'Cron Job' },
  task: { icon: ListTodo, color: '#ffd166', label: 'Task' },
  suggestion: { icon: Lightbulb, color: '#06d6a0', label: 'Suggestion' },
};

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-status-online/10 text-status-online border-status-online/20',
  available: 'bg-accent/10 text-accent border-accent/20',
  suggested: 'bg-[#06d6a0]/10 text-[#06d6a0] border-[#06d6a0]/20',
};

const TABS = ['Overview', 'SOUL.md', 'IDENTITY.md', 'TOOLS.md', 'HEARTBEAT.md', 'MEMORY.md', 'Sessions'] as const;

export default function AgentDetailPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const router = useRouter();
  const { agent, isLoading, mutate } = useAgent(agentId);
  const [activeTab, setActiveTab] = useState<string>('Overview');
  const { data: recData } = useSWR<{ recommendations: Recommendation[] }>(
    agentId ? `/api/agents/${agentId}/recommendations` : null,
    fetcher
  );
  const recommendations = recData?.recommendations || [];
  const role = AGENT_ROLES[agentId] || '';

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
            {role && (
              <p className="text-sm text-text-secondary mb-3">{role}</p>
            )}
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

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <div className="bg-surface-2 border border-border rounded-lg p-4">
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Zap size={14} className="text-accent" />
                Assignments & Recommendations
              </h3>

              {/* Current assignments */}
              {recommendations.filter(r => r.status === 'active').length > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs uppercase tracking-[0.1em] text-text-tertiary font-medium mb-2">Currently Assigned</h4>
                  <div className="space-y-2">
                    {recommendations.filter(r => r.status === 'active').map((rec, i) => {
                      const config = TYPE_CONFIG[rec.type] || TYPE_CONFIG.suggestion;
                      const Icon = config.icon;
                      return (
                        <div key={`active-${i}`} className="flex items-start gap-3 p-2.5 rounded-md bg-surface-1 border border-border">
                          <div className="mt-0.5 shrink-0" style={{ color: config.color }}>
                            <Icon size={14} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-text-primary truncate">{rec.title}</span>
                              <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border', STATUS_STYLES.active)}>
                                {config.label}
                              </span>
                            </div>
                            <p className="text-xs text-text-tertiary mt-0.5 truncate">{rec.description}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Available (unassigned tasks) */}
              {recommendations.filter(r => r.status === 'available').length > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs uppercase tracking-[0.1em] text-text-tertiary font-medium mb-2">Available to Pick Up</h4>
                  <div className="space-y-2">
                    {recommendations.filter(r => r.status === 'available').map((rec, i) => {
                      const config = TYPE_CONFIG[rec.type] || TYPE_CONFIG.suggestion;
                      const Icon = config.icon;
                      return (
                        <div key={`available-${i}`} className="flex items-start gap-3 p-2.5 rounded-md bg-surface-1 border border-border border-dashed">
                          <div className="mt-0.5 shrink-0" style={{ color: config.color }}>
                            <Icon size={14} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-text-secondary truncate">{rec.title}</span>
                              <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border', STATUS_STYLES.available)}>
                                Unassigned
                              </span>
                            </div>
                            <p className="text-xs text-text-tertiary mt-0.5 truncate">{rec.description}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Suggestions */}
              {recommendations.filter(r => r.status === 'suggested').length > 0 && (
                <div>
                  <h4 className="text-xs uppercase tracking-[0.1em] text-text-tertiary font-medium mb-2">Suggested</h4>
                  <div className="space-y-2">
                    {recommendations.filter(r => r.status === 'suggested').map((rec, i) => {
                      const config = TYPE_CONFIG[rec.type] || TYPE_CONFIG.suggestion;
                      const Icon = config.icon;
                      return (
                        <div key={`suggested-${i}`} className="flex items-start gap-3 p-2.5 rounded-md bg-surface-1/50 border border-border/50">
                          <div className="mt-0.5 shrink-0" style={{ color: config.color }}>
                            <Icon size={14} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-text-secondary truncate">{rec.title}</span>
                              <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border', STATUS_STYLES.suggested)}>
                                Idea
                              </span>
                            </div>
                            <p className="text-xs text-text-tertiary mt-0.5 truncate">{rec.description}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

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
