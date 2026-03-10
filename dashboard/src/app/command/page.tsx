'use client';

import { useAgents } from '@/hooks/useAgents';
import { useTasks } from '@/hooks/useTasks';
import { useWorkflows } from '@/hooks/useWorkflows';
import { useRepos } from '@/hooks/useRepos';
import { MISSION_STATEMENT, AGENT_EMOJIS } from '@/lib/constants';
import { Diamond, Users, ListTodo, GitBranch, Radar, Clock, Zap, Play, CalendarClock, ShieldAlert, GitCommitHorizontal, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import useSWR from 'swr';
import { Badge } from '@/components/shared/Badge';
import type { Workflow, RepoStatus } from '@/lib/types';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function CommandPage() {
  const { agents } = useAgents();
  const { tasks } = useTasks();
  const { workflows } = useWorkflows();
  const { repos } = useRepos();
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
              <WorkflowCard key={wf.name} workflow={wf} />
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

function WorkflowCard({ workflow }: { workflow: Workflow }) {
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

  return (
    <div className="bg-surface-1 border border-border rounded-lg p-4 hover:border-border-hover transition-colors">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-text-primary">{workflow.name}</span>
        <Badge color={sourceColor}>{workflow.source}</Badge>
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
      {workflow.approvalRequired && (
        <div className="flex items-center gap-1 mt-2 text-xs text-yellow-500">
          <ShieldAlert size={12} />
          <span>{workflow.approvalReason || 'Requires approval'}</span>
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
