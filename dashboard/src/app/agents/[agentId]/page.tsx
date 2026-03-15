'use client';

import { useState, useCallback, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { useAgent } from '@/hooks/useAgents';
import {
  ArrowLeft, Circle, Zap, Clock, ListTodo, Lightbulb, Workflow,
  Check, Sparkles, Loader2,
} from 'lucide-react';
import { cn, getAgentStatus, relativeTime } from '@/lib/utils';
import { MODEL_DISPLAY, AGENT_FILES, AGENT_COLORS, AGENT_ROLES } from '@/lib/constants';
import { Badge } from '@/components/shared/Badge';
import { Button } from '@/components/shared/Button';
import { FileEditor } from '@/components/agents/FileEditor';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { InlineError } from '@/components/shared/InlineError';
import { useDashboardFilters, useToast, useStatusBanners } from '@/components/providers/DashboardProviders';

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface Recommendation {
  id: string;
  type: 'workflow' | 'cron' | 'task' | 'suggestion';
  title: string;
  description: string;
  source?: string;
  status: 'active' | 'available' | 'suggested';
  action?: 'assign' | 'create' | 'view';
  taskId?: string;
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

function RecItem({ rec, agentId, onDone, variant }: {
  rec: Recommendation;
  agentId: string;
  onDone: () => void;
  variant: 'active' | 'available' | 'suggested';
}) {
  const { pushToast } = useToast();
  const { setStatusBanner, clearStatusBanner } = useStatusBanners();
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const config = TYPE_CONFIG[rec.type] || TYPE_CONFIG.suggestion;
  const Icon = config.icon;

  const borderClass = variant === 'available' ? 'border-dashed' : variant === 'suggested' ? 'border-border/50' : '';
  const bgClass = variant === 'suggested' ? 'bg-surface-1/50' : 'bg-surface-1';
  const textClass = variant === 'active' ? 'text-text-primary' : 'text-text-secondary';

  const handleRun = async () => {
    if (loading || running) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/recommendations/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'run',
          type: rec.type,
          taskId: rec.taskId,
          title: rec.title,
          description: rec.description,
        }),
      });
      if (res.ok) {
        setRunning(true);
        setStatusBanner(`rec-${agentId}-${rec.id}`, {
          title: `${agentId} is working on a recommendation`,
          description: rec.title,
          tone: 'info',
        });
        pushToast({ title: `${agentId} started work`, description: rec.title, tone: 'success' });
        setTimeout(() => {
          clearStatusBanner(`rec-${agentId}-${rec.id}`);
          onDone();
        }, 8000);
      } else {
        const data = await res.json().catch(() => ({}));
        pushToast({ title: 'Failed to start recommendation', description: data.error || rec.title, tone: 'error' });
      }
    } catch {
      pushToast({ title: 'Failed to start recommendation', description: 'Network error while triggering the agent.', tone: 'error' });
    }
    setLoading(false);
  };

  return (
    <div
      onClick={handleRun}
      className={cn(
        'flex items-start gap-3 p-2.5 rounded-md border border-border transition-all cursor-pointer group',
        bgClass, borderClass,
        running
          ? 'border-status-online/40 bg-status-online/5'
          : 'hover:border-accent/40 hover:bg-accent/5'
      )}
    >
      <div className="mt-0.5 shrink-0" style={{ color: running ? 'var(--color-status-online)' : config.color }}>
        {loading ? <Loader2 size={14} className="animate-spin" /> : running ? <Check size={14} /> : <Icon size={14} />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cn('text-sm font-medium truncate', textClass)}>{rec.title}</span>
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border', STATUS_STYLES[variant])}>
            {variant === 'active' ? config.label : variant === 'available' ? 'Unassigned' : 'Idea'}
          </span>
        </div>
        <p className="text-xs text-text-tertiary mt-0.5 truncate">
          {running ? `${agentId} is working on this...` : rec.description}
        </p>
      </div>
      {!loading && !running && (
        <div className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-accent/10 text-accent opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <Zap size={10} />
          Run
        </div>
      )}
    </div>
  );
}

function AgentDetailContent() {
  const { agentId } = useParams<{ agentId: string }>();
  const router = useRouter();
  const { setAgentId } = useDashboardFilters();
  const { pushToast } = useToast();
  const { setStatusBanner, clearStatusBanner } = useStatusBanners();
  const { agent, isLoading, error, mutate } = useAgent(agentId);
  const [activeTab, setActiveTab] = useState<string>('Overview');
  const { data: recData, error: recError, mutate: mutateRecs } = useSWR<{ recommendations: Recommendation[] }>(
    agentId ? `/api/agents/${agentId}/recommendations` : null,
    fetcher
  );
  const recommendations = recData?.recommendations || [];
  const role = AGENT_ROLES[agentId] || '';

  const [improving, setImproving] = useState(false);
  const [improveStatus, setImproveStatus] = useState<string | null>(null);

  const handleImprove = useCallback(async () => {
    if (improving) return;
    setImproving(true);
    setImproveStatus(null);
    try {
      const res = await fetch(`/api/agents/${agentId}/improve`, { method: 'POST' });
      const data = await res.json();
      setImproveStatus(data.ok ? 'Agent is reviewing its sessions and updating its files...' : data.error);
      if (data.ok) {
        setStatusBanner(`improve-${agentId}`, {
          title: `${agentId} self-improvement is running`,
          description: 'The agent is reviewing sessions and may update its files in the background.',
          tone: 'info',
        });
        pushToast({ title: 'Self-improvement started', description: `${agentId} is reviewing sessions and updating its files.`, tone: 'success' });
        // Refresh agent data after a delay to show updated files
        setTimeout(() => {
          clearStatusBanner(`improve-${agentId}`);
          mutate();
        }, 30_000);
      } else {
        pushToast({ title: 'Failed to start self-improve', description: data.error || agentId, tone: 'error' });
      }
    } catch (err: any) {
      setImproveStatus('Failed to start improvement session');
      pushToast({ title: 'Failed to start self-improve', description: 'Network error while starting the session.', tone: 'error' });
    }
    setImproving(false);
  }, [agentId, clearStatusBanner, improving, mutate, pushToast, setStatusBanner]);

  useEffect(() => {
    setAgentId(agentId);
    return () => setAgentId('');
  }, [agentId, setAgentId]);

  const handleRecDone = useCallback(() => {
    mutateRecs();
  }, [mutateRecs]);

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

  const activeRecs = recommendations.filter(r => r.status === 'active');
  const availableRecs = recommendations.filter(r => r.status === 'available');
  const suggestedRecs = recommendations.filter(r => r.status === 'suggested');

  return (
    <div className="p-6 max-w-5xl overflow-auto h-full">
      <button
        onClick={() => router.push('/agents')}
        className="flex items-center gap-1.5 text-xs text-text-tertiary hover:text-text-secondary mb-4 transition-colors"
      >
        <ArrowLeft size={14} />
        Back to agents
      </button>

      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
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

        {/* Self-improve button */}
        <button
          onClick={handleImprove}
          disabled={improving}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
            improving
              ? 'bg-surface-2 text-text-tertiary cursor-not-allowed'
              : 'bg-accent/10 text-accent hover:bg-accent/20'
          )}
        >
          {improving ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          Self-Improve
        </button>
      </div>

      {(error || recError) && <div className="mb-4"><InlineError message="Failed to load agent data." onRetry={() => mutate()} /></div>}

      {improveStatus && (
        <div className="mb-4 p-3 rounded-md bg-accent/5 border border-accent/20 text-xs text-accent">
          {improveStatus}
        </div>
      )}

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

              {activeRecs.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs uppercase tracking-[0.1em] text-text-tertiary font-medium mb-2">Currently Assigned</h4>
                  <div className="space-y-2">
                    {activeRecs.map((rec) => (
                      <RecItem key={rec.id} rec={rec} agentId={agentId} onDone={handleRecDone} variant="active" />
                    ))}
                  </div>
                </div>
              )}

              {availableRecs.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs uppercase tracking-[0.1em] text-text-tertiary font-medium mb-2">Available to Pick Up</h4>
                  <div className="space-y-2">
                    {availableRecs.map((rec) => (
                      <RecItem key={rec.id} rec={rec} agentId={agentId} onDone={handleRecDone} variant="available" />
                    ))}
                  </div>
                </div>
              )}

              {suggestedRecs.length > 0 && (
                <div>
                  <h4 className="text-xs uppercase tracking-[0.1em] text-text-tertiary font-medium mb-2">Suggested</h4>
                  <div className="space-y-2">
                    {suggestedRecs.map((rec) => (
                      <RecItem key={rec.id} rec={rec} agentId={agentId} onDone={handleRecDone} variant="suggested" />
                    ))}
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

export default function AgentDetailPage() {
  return (
    <ErrorBoundary name="Agent Detail">
      <AgentDetailContent />
    </ErrorBoundary>
  );
}
