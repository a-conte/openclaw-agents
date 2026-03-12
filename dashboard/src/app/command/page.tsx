'use client';

import { useState } from 'react';
import { useAgents } from '@/hooks/useAgents';
import { useTasks } from '@/hooks/useTasks';
import { useWorkflows } from '@/hooks/useWorkflows';
import { useWorkflowRuns, useWorkflowRun } from '@/hooks/useWorkflowRuns';
import { useRepos } from '@/hooks/useRepos';
import { MISSION_STATEMENT, AGENT_EMOJIS } from '@/lib/constants';
import { Diamond, Users, ListTodo, GitBranch, Radar, Clock, Zap, Play, CalendarClock, ShieldAlert, GitCommitHorizontal, CheckCircle2, AlertTriangle, XCircle, Loader2, ChevronDown, ChevronRight, Circle, Minus } from 'lucide-react';
import useSWR from 'swr';
import { Badge } from '@/components/shared/Badge';
import type { Workflow, WorkflowRun, WorkflowRunStep, RepoStatus } from '@/lib/types';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function CommandPage() {
  const { agents } = useAgents();
  const { tasks } = useTasks();
  const { workflows } = useWorkflows();
  const { repos } = useRepos();
  const { runs } = useWorkflowRuns();
  const { data: briefingsData } = useSWR('/api/briefings', fetcher, { refreshInterval: 30000 });
  const { data: radarData } = useSWR('/api/radar', fetcher, { refreshInterval: 30000 });

  const activeAgents = agents.filter((a: any) => {
    const lastActivity = a.sessions?.recent?.[0]?.updatedAt;
    if (!lastActivity) return false;
    return Date.now() - lastActivity < 60 * 60 * 1000;
  }).length;

  const tasksInProgress = tasks.filter((t: any) => t.status === 'in_progress').length;
  const pipelineItems = tasks.filter((t: any) => t.status !== 'done').length;
  const radarSignals = radarData?.items?.length || 0;
  const briefings = briefingsData?.briefings || [];

  return (
    <div className="p-6 max-w-5xl overflow-auto h-full">
      {/* Mission Statement */}
      <div className="border border-border rounded-lg p-5 mb-6 bg-surface-1" style={{ borderLeftColor: '#FB5656', borderLeftWidth: 3 }}>
        <div className="flex items-center gap-2 mb-2">
          <Diamond size={14} className="text-accent" />
          <span className="text-xs uppercase tracking-[0.1em] text-text-tertiary font-medium">Mission</span>
        </div>
        <p className="text-sm text-text-secondary leading-relaxed">{MISSION_STATEMENT}</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard icon={<Users size={16} />} label="Active Agents" value={`${activeAgents}/${agents.length}`} color="#FB5656" />
        <StatCard icon={<ListTodo size={16} />} label="In Progress" value={tasksInProgress.toString()} color="#4A9EFF" />
        <StatCard icon={<GitBranch size={16} />} label="Pipeline" value={pipelineItems.toString()} color="#ffd166" />
        <StatCard icon={<Radar size={16} />} label="Radar Signals" value={radarSignals.toString()} color="#8338ec" />
      </div>

      {/* Power Workflows */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-text-primary font-[var(--font-heading)] uppercase tracking-[0.1em] mb-4">
          Power Workflows
        </h2>
        {workflows.length === 0 ? (
          <div className="bg-surface-1 border border-border rounded-lg p-8 text-center text-text-tertiary text-sm">
            No workflows defined
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {workflows.map((wf: Workflow) => (
              <WorkflowCard key={wf.name} workflow={wf} runs={runs.filter(r => r.workflowName === wf.name)} />
            ))}
          </div>
        )}
      </div>

      {/* Repo Health */}
      {repos.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-text-primary font-[var(--font-heading)] uppercase tracking-[0.1em] mb-4">
            Repo Health
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {repos.map((repo: RepoStatus) => (
              <RepoCard key={`${repo.owner}/${repo.name}`} repo={repo} />
            ))}
          </div>
        </div>
      )}

      {/* Briefings Feed */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-text-primary font-[var(--font-heading)] uppercase tracking-[0.1em] mb-4">Briefings</h2>
        <div className="bg-surface-1 border border-border rounded-lg divide-y divide-border">
          {briefings.length === 0 ? (
            <div className="p-8 text-center text-text-tertiary text-sm">No briefings scheduled</div>
          ) : (
            briefings.map((b: any) => (
              <div key={b.id} className="flex items-center justify-between px-4 py-3 hover:bg-surface-2 transition-colors">
                <div className="flex items-center gap-3">
                  <Clock size={14} className="text-text-tertiary" />
                  <div>
                    <span className="text-sm text-text-primary">{b.name}</span>
                    <span className="text-xs text-text-tertiary ml-2">{b.time}</span>
                  </div>
                </div>
                <Badge
                  color={
                    b.status === 'delivered' ? '#FB5656' :
                    b.status === 'pending' ? '#ffd166' : '#555555'
                  }
                >
                  {b.status}
                </Badge>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function StepStatusIcon({ status }: { status: WorkflowRunStep['status'] }) {
  switch (status) {
    case 'pending': return <Circle size={12} className="text-text-tertiary" />;
    case 'running': return <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" /><span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" /></span>;
    case 'done': return <CheckCircle2 size={12} className="text-green-400" />;
    case 'failed': return <XCircle size={12} className="text-red-400" />;
    case 'skipped': return <Minus size={12} className="text-text-tertiary" />;
  }
}

function RunStatusBadge({ status }: { status: WorkflowRun['status'] }) {
  const colors: Record<string, string> = {
    pending: '#555555',
    running: '#4A9EFF',
    completed: '#06d6a0',
    failed: '#e94560',
  };
  return <Badge color={colors[status] || '#555555'}>{status}</Badge>;
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDuration(start: string, end?: string): string {
  const ms = (end ? new Date(end).getTime() : Date.now()) - new Date(start).getTime();
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  return `${mins}m ${remSecs}s`;
}

function WorkflowCard({ workflow, runs }: { workflow: Workflow; runs: WorkflowRun[] }) {
  const [executingRunId, setExecutingRunId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [runState, setRunState] = useState<'idle' | 'confirm'>('idle');

  const { run: activeRun } = useWorkflowRun(executingRunId);

  // Auto-expand when a run starts, collapse when idle
  const isRunning = activeRun && (activeRun.status === 'running' || activeRun.status === 'pending');

  const triggerIcon = workflow.trigger === 'cron' ? (
    <CalendarClock size={14} />
  ) : workflow.trigger === 'event' ? (
    <Zap size={14} />
  ) : (
    <Play size={14} />
  );

  const triggerLabel = workflow.trigger === 'cron'
    ? workflow.schedule || 'scheduled'
    : workflow.trigger === 'event'
    ? 'event-triggered'
    : 'on-demand';

  const sourceColor = workflow.source === 'workflow' ? '#06d6a0' : '#4A9EFF';
  const agentList = [...new Set(workflow.steps.map(s => s.agent))];

  async function handleRun() {
    if (workflow.approvalRequired && runState !== 'confirm') {
      setRunState('confirm');
      return;
    }
    setRunState('idle');

    try {
      const res = await fetch('/api/workflows/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflowName: workflow.name }),
      });
      const data = await res.json();
      if (res.ok && data.runId) {
        setExecutingRunId(data.runId);
        setExpanded(true);
      }
    } catch {
      // Network error — will show in run history if it partially started
    }
  }

  const showSteps = expanded && (activeRun || executingRunId);
  const displayRun = activeRun;

  return (
    <div className="bg-surface-1 border border-border rounded-lg p-4 hover:border-border-hover transition-colors group">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {(showSteps || runs.length > 0) && (
            <button onClick={() => setExpanded(!expanded)} className="text-text-tertiary hover:text-text-secondary">
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          )}
          <span className="text-sm font-medium text-text-primary">{workflow.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge color={sourceColor}>{workflow.source}</Badge>
          {!isRunning && runState === 'idle' && (
            <button
              onClick={handleRun}
              className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-accent/10 text-accent hover:bg-accent/20"
              title={`Run ${workflow.name}`}
            >
              <Play size={12} />
              Run
            </button>
          )}
          {runState === 'confirm' && (
            <div className="flex items-center gap-1">
              <button
                onClick={handleRun}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30"
              >
                Confirm
              </button>
              <button
                onClick={() => setRunState('idle')}
                className="px-2 py-1 rounded text-xs font-medium text-text-tertiary hover:text-text-secondary"
              >
                Cancel
              </button>
            </div>
          )}
          {isRunning && (
            <span className="flex items-center gap-1 text-xs text-text-tertiary">
              <Loader2 size={12} className="animate-spin" />
              Running...
            </span>
          )}
        </div>
      </div>
      <p className="text-xs text-text-tertiary mb-3 leading-relaxed">{workflow.description}</p>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
          <span className="text-text-tertiary">{triggerIcon}</span>
          <span>{triggerLabel}</span>
        </div>
        <div className="flex items-center gap-1">
          {agentList.map(a => (
            <span key={a} className="text-xs" title={a}>
              {AGENT_EMOJIS[a] || a}
            </span>
          ))}
        </div>
      </div>
      {workflow.approvalRequired && runState !== 'confirm' && (
        <div className="flex items-center gap-1 mt-2 text-xs text-yellow-500">
          <ShieldAlert size={12} />
          <span>{workflow.approvalReason || 'Requires approval'}</span>
        </div>
      )}

      {/* Step-by-step progress */}
      {showSteps && displayRun && (
        <div className="mt-3 pt-3 border-t border-border space-y-1.5">
          {displayRun.steps.map((step) => (
            <div key={step.stepIndex} className="flex items-center gap-2 text-xs">
              <StepStatusIcon status={step.status} />
              <span>{AGENT_EMOJIS[step.agent] || step.agent}</span>
              <span className="text-text-secondary truncate flex-1">{step.action}</span>
              {step.status === 'running' && step.startedAt && (
                <span className="text-text-tertiary">{formatDuration(step.startedAt)}</span>
              )}
              {step.status === 'done' && step.startedAt && step.completedAt && (
                <span className="text-text-tertiary">{formatDuration(step.startedAt, step.completedAt)}</span>
              )}
            </div>
          ))}
          {displayRun.status === 'completed' && (
            <div className="flex items-center gap-1 text-xs text-green-400 pt-1">
              <CheckCircle2 size={12} />
              Completed in {formatDuration(displayRun.startedAt, displayRun.completedAt)}
            </div>
          )}
          {displayRun.status === 'failed' && (
            <div className="flex items-center gap-1 text-xs text-red-400 pt-1">
              <XCircle size={12} />
              Failed{displayRun.error ? `: ${displayRun.error.slice(0, 100)}` : ''}
            </div>
          )}
        </div>
      )}

      {/* Run history */}
      {expanded && runs.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border">
          <span className="text-xs text-text-tertiary font-medium">Recent Runs</span>
          <div className="mt-1.5 space-y-1">
            {runs.slice(0, 5).map((r) => (
              <div
                key={r.id}
                className={`flex items-center justify-between text-xs cursor-pointer hover:bg-surface-2 rounded px-1 py-0.5 ${r.id === executingRunId ? 'bg-surface-2' : ''}`}
                onClick={() => { setExecutingRunId(r.id); setExpanded(true); }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-text-tertiary">{relativeTime(r.startedAt)}</span>
                  <RunStatusBadge status={r.status} />
                </div>
                <span className="text-text-tertiary">
                  {r.completedAt ? formatDuration(r.startedAt, r.completedAt) : r.status === 'running' ? formatDuration(r.startedAt) : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RepoCard({ repo }: { repo: RepoStatus }) {
  const statusIcon = repo.status === 'clean' ? (
    <CheckCircle2 size={14} className="text-green-500" />
  ) : repo.status === 'dirty' ? (
    <AlertTriangle size={14} className="text-yellow-500" />
  ) : (
    <XCircle size={14} className="text-red-500" />
  );

  const statusColor = repo.status === 'clean' ? '#06d6a0' : repo.status === 'dirty' ? '#ffd166' : '#e94560';

  return (
    <div className="bg-surface-1 border border-border rounded-lg p-4 hover:border-border-hover transition-colors">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {statusIcon}
          <span className="text-sm font-medium text-text-primary">{repo.owner}/{repo.name}</span>
        </div>
        <Badge color={statusColor}>{repo.status}</Badge>
      </div>
      {repo.uncommittedCount > 0 && (
        <p className="text-xs text-yellow-500 mb-1">
          {repo.uncommittedCount} uncommitted change{repo.uncommittedCount !== 1 ? 's' : ''}
        </p>
      )}
      {repo.lastCommit && (
        <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
          <GitCommitHorizontal size={12} />
          <span className="truncate">{repo.lastCommit}</span>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="bg-surface-1 border border-border rounded-lg p-4 hover:border-border-hover transition-colors">
      <div className="flex items-center gap-2 mb-2">
        <span style={{ color }}>{icon}</span>
        <span className="text-xs uppercase tracking-[0.1em] text-text-tertiary font-medium">{label}</span>
      </div>
      <div className="text-2xl font-semibold text-text-primary font-mono">{value}</div>
    </div>
  );
}
