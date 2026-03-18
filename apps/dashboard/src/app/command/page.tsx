'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import type {
  ArtifactAdminSummaryContract,
  JobContract,
  JobMetricsContract,
  JobTemplateDiffContract,
  JobTemplateContract,
  JobTemplateVersionContract,
  PolicyAdminContract,
} from '@openclaw/contracts';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock3,
  Diamond,
  GitBranch,
  GitCommitHorizontal,
  Loader2,
  MessageCircle,
  Minus,
  Play,
  Radar,
  ShieldAlert,
  Sparkles,
  Users,
  XCircle,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/shared/Badge';
import { Button } from '@/components/shared/Button';
import { AssignWorkModal, type AssignWorkContext } from '@/components/command/AssignWorkModal';
import { JobDetailPanel } from '@/components/command/JobDetailPanel';
import { ActivityFeed } from '@/components/activity/ActivityFeed';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { InlineError } from '@/components/shared/InlineError';
import { useDashboardFilters, useChatPanel } from '@/components/providers/DashboardProviders';
import { useNow } from '@/hooks/useNow';
import { useTasks } from '@/hooks/useTasks';
import { useWorkflowRun } from '@/hooks/useWorkflowRuns';
import { usePollingInterval } from '@/hooks/usePageVisibility';
import { AGENT_EMOJIS, AGENT_ROLES, MISSION_STATEMENT, POLL_INTERVAL } from '@/lib/constants';
import { JOB_TEMPLATES } from '@/lib/job-templates';
import type { Agent, Briefing, RepoStatus, SystemRecommendation, Workflow, WorkflowRun, WorkflowRunStep } from '@/lib/types';
import { formatDate, relativeTime } from '@/lib/utils';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type AttentionItem = {
  id: string;
  tone: 'danger' | 'warn' | 'info';
  title: string;
  detail: string;
  href?: string;
};

type AgentSummary = Agent & {
  lastActivity?: number;
  state: 'active' | 'quiet' | 'stale';
};

type AutomationTemplate = JobTemplateContract & {
  mode?: NonNullable<JobContract['mode']>;
  targetAgent?: string;
  prompt?: string;
  command?: string;
  workflow?: string;
  args?: string[];
};

export default function CommandPage() {
  const { filters } = useDashboardFilters();
  const { createTask } = useTasks();
  const refreshInterval = usePollingInterval(POLL_INTERVAL);
  const { data, error: swrError, mutate } = useSWR<{
    health: any;
    agents: Agent[];
    tasks: any[];
    workflows: Workflow[];
    repos: RepoStatus[];
    runs: WorkflowRun[];
    briefings: Briefing[];
    radarItems: Array<{ id: string }>;
    systemRecommendations: SystemRecommendation[];
  }>('/api/command-overview', fetcher, { refreshInterval });
  const { data: jobs, mutate: mutateJobs } = useSWR<JobContract[]>('/api/jobs', fetcher, { refreshInterval });

  const health = data?.health;
  const agents = data?.agents || [];
  const tasks = data?.tasks || [];
  const workflows = data?.workflows || [];
  const repos = data?.repos || [];
  const runs = data?.runs || [];
  const briefings = data?.briefings || [];
  const radarSignals = data?.radarItems?.length || 0;
  const systemRecommendations = data?.systemRecommendations || [];
  const searchNeedle = filters.search.trim().toLowerCase();
  const [creatingRecommendationId, setCreatingRecommendationId] = useState<string | null>(null);
  const [assignContext, setAssignContext] = useState<AssignWorkContext | null>(null);
  const { now, hydrated } = useNow([data]);

  const agentSummaries = useMemo<AgentSummary[]>(() => {
    return agents.map((agent: Agent) => {
      const lastActivity = agent.sessions?.recent?.[0]?.updatedAt;
      const ageMs = hydrated && lastActivity ? now - lastActivity : Infinity;
      const state = ageMs < 60 * 60 * 1000 ? 'active' : ageMs < 6 * 60 * 60 * 1000 ? 'quiet' : 'stale';

      return {
        ...agent,
        lastActivity,
        state,
      };
    });
  }, [agents, now, hydrated]);

  const filteredWorkflows = useMemo(() => workflows.filter((workflow) => {
    if (filters.agentId && !workflow.steps.some((step) => step.agent === filters.agentId)) return false;
    if (filters.focus === 'attention') {
      const relatedRuns = runs.filter((run) => run.workflowName === workflow.name);
      const hasAttentionRun = relatedRuns.some((run) => run.status === 'failed' || run.status === 'running' || run.status === 'pending');
      if (!workflow.approvalRequired && !hasAttentionRun) return false;
    }
    if (!searchNeedle) return true;
    const haystack = [workflow.name, workflow.description, workflow.steps.map((step) => `${step.agent} ${step.action}`).join(' ')].join(' ').toLowerCase();
    return haystack.includes(searchNeedle);
  }), [filters.agentId, filters.focus, runs, searchNeedle, workflows]);

  const filteredRepos = useMemo(() => repos.filter((repo) => {
    if (filters.focus === 'attention' && repo.status === 'clean') return false;
    if (!searchNeedle) return true;
    return [repo.owner, repo.name, repo.local, repo.watch.join(' ')].join(' ').toLowerCase().includes(searchNeedle);
  }), [filters.focus, repos, searchNeedle]);

  const filteredBriefings = useMemo(() => briefings.filter((briefing) => {
    if (filters.agentId && briefing.agentId !== filters.agentId) return false;
    if (filters.focus === 'attention' && briefing.status === 'delivered') return false;
    if (!searchNeedle) return true;
    return [briefing.name, briefing.time, briefing.agentId].join(' ').toLowerCase().includes(searchNeedle);
  }), [briefings, filters.agentId, filters.focus, searchNeedle]);

  const runningRuns = useMemo(
    () => runs.filter((run) => (filters.focus === 'attention' ? run.status !== 'completed' : run.status === 'running' || run.status === 'pending')).sort((a, b) => +new Date(b.startedAt) - +new Date(a.startedAt)),
    [filters.focus, runs]
  );
  const failedRuns = useMemo(
    () => runs.filter((run) => run.status === 'failed').sort((a, b) => +new Date(b.startedAt) - +new Date(a.startedAt)),
    [runs]
  );
  const dirtyRepos = filteredRepos.filter((repo) => repo.status !== 'clean');
  const activeAgents = agentSummaries.filter((agent) => agent.state === 'active');
  const staleAgents = agentSummaries.filter((agent) => agent.state === 'stale');
  const inProgressTasks = tasks.filter((task) => task.status === 'in_progress');
  const overdueTasks = hydrated ? inProgressTasks.filter((task) => now - new Date(task.updatedAt).getTime() > 2 * 60 * 60 * 1000) : [];
  const pendingBriefings = filteredBriefings.filter((briefing) => briefing.status !== 'delivered');

  const attentionItems = useMemo<AttentionItem[]>(() => {
    const items: AttentionItem[] = [];

    if (!health?.ok) {
      items.push({
        id: 'gateway',
        tone: 'danger',
        title: 'Gateway is unreachable',
        detail: 'Agent health, live sessions, and command status may be stale until the gateway responds again.',
        href: '/system',
      });
    }

    if (failedRuns.length > 0) {
      items.push({
        id: 'failed-runs',
        tone: 'danger',
        title: `${failedRuns.length} workflow run${failedRuns.length === 1 ? '' : 's'} failed`,
        detail: `Most recent failure: ${failedRuns[0].workflowName}${failedRuns[0].error ? ` - ${failedRuns[0].error.slice(0, 80)}` : ''}`,
        href: '/pipeline',
      });
    }

    if (dirtyRepos.length > 0) {
      items.push({
        id: 'dirty-repos',
        tone: 'warn',
        title: `${dirtyRepos.length} repo${dirtyRepos.length === 1 ? ' needs' : 's need'} attention`,
        detail: dirtyRepos
          .slice(0, 2)
          .map((repo) => `${repo.owner}/${repo.name} (${repo.status}${repo.uncommittedCount ? `, ${repo.uncommittedCount} changes` : ''})`)
          .join(' · '),
        href: '/system',
      });
    }

    if (overdueTasks.length > 0) {
      items.push({
        id: 'stale-tasks',
        tone: 'warn',
        title: `${overdueTasks.length} in-progress task${overdueTasks.length === 1 ? ' looks' : 's look'} stale`,
        detail: 'These tasks have not been updated in more than 2 hours and may need reassignment or a progress check.',
        href: '/projects',
      });
    }

    if (staleAgents.length > 0) {
      items.push({
        id: 'stale-agents',
        tone: 'info',
        title: `${staleAgents.length} agent${staleAgents.length === 1 ? ' is' : 's are'} quiet`,
        detail: staleAgents.slice(0, 3).map((agent) => agent.agentId).join(' · '),
        href: '/agents',
      });
    }

    if (items.length === 0) {
      items.push({
        id: 'clear',
        tone: 'info',
        title: 'No urgent issues right now',
        detail: 'Workflows, repos, and agents look stable from the latest poll.',
      });
    }

    return items.slice(0, 4);
  }, [dirtyRepos, failedRuns, health?.ok, overdueTasks.length, staleAgents]);

  return (
    <div className="mx-auto flex h-full w-full max-w-7xl flex-col gap-6 overflow-auto p-6">
      {swrError && <InlineError message="Failed to load command overview." onRetry={() => mutate()} />}
      <section className="rounded-2xl border border-border bg-surface-1/90 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] glass">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-text-tertiary">
              <Diamond size={14} className="text-accent" />
              Command Deck
            </div>
            <div>
              <h1 className="font-[var(--font-heading)] text-2xl text-text-primary md:text-3xl">Run the day from one screen</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">{MISSION_STATEMENT}</p>
            </div>
          </div>

          <div className="grid min-w-[280px] gap-3 sm:grid-cols-2 lg:w-[360px] lg:grid-cols-1">
            <TrustPill
              label={health?.ok ? 'Gateway live' : 'Gateway degraded'}
              value={health?.ts ? `Last health ping ${relativeTime(health.ts)}` : 'No live health timestamp'}
              tone={health?.ok ? 'good' : 'danger'}
            />
            <TrustPill
              label="Polling cadence"
              value={`Agents, runs, and repos refresh every ${Math.round(POLL_INTERVAL / 1000)}s`}
              tone="neutral"
            />
            <TrustPill
              label="Delivery model"
              value="Workflow completions may reply in Telegram; approvals trigger a Telegram notification before execution."
              tone="warn"
            />
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <ErrorBoundary name="Needs Attention">
        <Panel title="Needs Attention" eyebrow="Triage" icon={<AlertTriangle size={15} className="text-accent" />}>
          <div className="grid gap-3 md:grid-cols-2">
            {attentionItems.map((item) => (
              <AttentionCard key={item.id} item={item} onAssign={(ctx) => setAssignContext(ctx)} />
            ))}
          </div>
        </Panel>
        </ErrorBoundary>

        <ErrorBoundary name="Operational Snapshot">
        <Panel title="Operational Snapshot" eyebrow="Now" icon={<Sparkles size={15} className="text-accent-blue" />}>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Agents active" value={`${activeAgents.length}/${agentSummaries.length || 0}`} note="last hour" tone="accent" />
            <StatCard label="Runs in flight" value={runningRuns.length.toString()} note="live workflows" tone="info" />
            <StatCard label="Tasks moving" value={inProgressTasks.length.toString()} note={`${overdueTasks.length} stale`} tone="warn" />
            <StatCard label="Signals" value={radarSignals.toString()} note={`${pendingBriefings.length} pending briefings`} tone="neutral" />
          </div>
        </Panel>
        </ErrorBoundary>
      </section>

      <ErrorBoundary name="System Recommendations">
      <section>
        <Panel title="Improve the System" eyebrow="Fresh Recommendations" icon={<Sparkles size={15} className="text-accent-purple" />}>
          <div className="grid gap-3 xl:grid-cols-2">
            {systemRecommendations.map((recommendation) => (
              <RecommendationCard
                key={recommendation.id}
                recommendation={recommendation}
                creating={creatingRecommendationId === recommendation.id}
                onCreateTask={async () => {
                  setCreatingRecommendationId(recommendation.id);
                  try {
                    await createTask({
                      ...recommendation.taskDraft,
                      status: 'todo',
                    });
                  } finally {
                    setCreatingRecommendationId((current) => (current === recommendation.id ? null : current));
                  }
                }}
                onAssign={(ctx) => setAssignContext(ctx)}
              />
            ))}
          </div>
        </Panel>
      </section>
      </ErrorBoundary>

      <section>
        <ErrorBoundary name="Automation Jobs">
          <AutomationJobsPanel jobs={jobs || []} onChanged={() => void mutateJobs()} />
        </ErrorBoundary>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <ErrorBoundary name="Workflow Queue">
        <Panel title="Workflow Queue" eyebrow="Execution" icon={<Zap size={15} className="text-accent-yellow" />}>
          {filteredWorkflows.length === 0 ? (
            <EmptyMessage message={filters.search || filters.agentId || filters.focus ? `No workflows match the current filters${filters.focus ? ` (${filters.focus})` : ''}.` : 'No workflows defined yet.'} />
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {filteredWorkflows.map((workflow) => (
                <WorkflowCard key={workflow.name} workflow={workflow} runs={runs.filter((run) => run.workflowName === workflow.name)} onAssign={(ctx) => setAssignContext(ctx)} />
              ))}
            </div>
          )}
        </Panel>
        </ErrorBoundary>

        <div className="grid gap-4">
          <ErrorBoundary name="Running Now">
          <Panel title="Running Now" eyebrow="Focus" icon={<Loader2 size={15} className="text-accent-blue" />}>
            {runningRuns.length === 0 && inProgressTasks.length === 0 ? (
              <EmptyMessage message="No workflows or tasks are running right now." />
            ) : (
              <div className="space-y-2">
                {runningRuns.slice(0, 4).map((run) => (
                  <RunListItem key={run.id} run={run} />
                ))}
                {inProgressTasks.slice(0, 4).map((task) => (
                  <div key={task.id} className="rounded-lg border border-border bg-surface-2/75 px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm text-text-primary">{task.title}</div>
                        <div className="text-xs text-text-tertiary">
                          {task.agentId ? `${AGENT_EMOJIS[task.agentId] || ''} ${task.agentId}` : 'unassigned'} · {relativeTime(task.updatedAt)}
                        </div>
                      </div>
                      <Badge color="#4A9EFF">in_progress</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
          </ErrorBoundary>

          <ErrorBoundary name="Agent Pulse">
          <Panel title="Agent Pulse" eyebrow="Coverage" icon={<Users size={15} className="text-accent-teal" />}>
            <div className="space-y-2">
              {agentSummaries.slice(0, 7).map((agent) => (
                <AgentPulseRow key={agent.agentId} agent={agent} onAssign={(ctx) => setAssignContext(ctx)} />
              ))}
            </div>
          </Panel>
          </ErrorBoundary>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_1fr_1fr]">
        <ErrorBoundary name="Repos">
        <Panel title="Repos That Need You" eyebrow="Code" icon={<GitBranch size={15} className="text-accent" />}>
          {dirtyRepos.length === 0 ? (
            <EmptyMessage message={filters.search || filters.focus ? `No repos match the current filters${filters.focus ? ` (${filters.focus})` : ''}.` : 'Watched repos are clean.'} />
          ) : (
            <div className="space-y-3">
              {dirtyRepos.slice(0, 5).map((repo) => (
                <RepoCard key={`${repo.owner}/${repo.name}`} repo={repo} onAssign={(ctx) => setAssignContext(ctx)} />
              ))}
            </div>
          )}
        </Panel>
        </ErrorBoundary>

        <ErrorBoundary name="Briefings">
        <Panel title="Upcoming Briefings" eyebrow="Schedule" icon={<CalendarClock size={15} className="text-accent-yellow" />}>
          {filteredBriefings.length === 0 ? (
            <EmptyMessage message={filters.search || filters.agentId || filters.focus ? `No briefings match the current filters${filters.focus ? ` (${filters.focus})` : ''}.` : 'No briefings scheduled.'} />
          ) : (
            <div className="space-y-2">
              {filteredBriefings.slice(0, 6).map((briefing) => (
                <BriefingRow key={briefing.id} briefing={briefing} />
              ))}
            </div>
          )}
        </Panel>
        </ErrorBoundary>

        <ErrorBoundary name="Activity">
        <Panel title="Recent Activity" eyebrow="Signals" icon={<Radar size={15} className="text-accent-purple" />}>
          <ActivityFeed />
        </Panel>
        </ErrorBoundary>
      </section>

      <AssignWorkModal
        context={assignContext}
        onClose={() => setAssignContext(null)}
        onAssigned={() => mutate()}
      />
    </div>
  );
}

function StepStatusIcon({ status }: { status: WorkflowRunStep['status'] }) {
  switch (status) {
    case 'pending':
      return <Circle size={12} className="text-text-tertiary" />;
    case 'running':
      return (
        <span className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-blue-500" />
        </span>
      );
    case 'done':
      return <CheckCircle2 size={12} className="text-green-400" />;
    case 'failed':
      return <XCircle size={12} className="text-red-400" />;
    case 'skipped':
      return <Minus size={12} className="text-text-tertiary" />;
  }
}

function WorkflowCard({ workflow, runs, onAssign }: { workflow: Workflow; runs: WorkflowRun[]; onAssign: (ctx: AssignWorkContext) => void }) {
  const [executingRunId, setExecutingRunId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [runState, setRunState] = useState<'idle' | 'confirm' | 'starting' | 'error'>('idle');
  const [runError, setRunError] = useState<string | null>(null);

  const sortedRuns = [...runs].sort((a, b) => +new Date(b.startedAt) - +new Date(a.startedAt));
  const latestRun = sortedRuns[0];
  const { run: polledRun } = useWorkflowRun(executingRunId || latestRun?.id || null);
  const displayRun = polledRun || latestRun || null;

  const isRunning = displayRun?.status === 'running' || displayRun?.status === 'pending';
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

  async function handleRun() {
    if (workflow.approvalRequired && runState !== 'confirm') {
      setRunState('confirm');
      return;
    }

    setRunState('starting');
    setRunError(null);

    try {
      const res = await fetch('/api/workflows/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflowName: workflow.name }),
      });
      const data = await res.json();

      if (!res.ok || !data.runId) {
        setRunState('error');
        setRunError(data.error || 'Failed to queue workflow');
        return;
      }

      setExecutingRunId(data.runId);
      setExpanded(true);
      setRunState('idle');
    } catch {
      setRunState('error');
      setRunError('Network error while starting workflow');
    }
  }

  const showSteps = expanded && displayRun;
  const agentList = [...new Set(workflow.steps.map((step) => step.agent))];

  return (
    <div className="rounded-xl border border-border bg-surface-2/75 p-4 transition-colors hover:border-border-hover">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {(displayRun || sortedRuns.length > 0) && (
              <button onClick={() => setExpanded((value) => !value)} className="text-text-tertiary hover:text-text-secondary">
                {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            )}
            <h3 className="text-sm font-semibold text-text-primary">{workflow.name}</h3>
          </div>
          <p className="text-xs leading-relaxed text-text-tertiary">{workflow.description || 'No description provided.'}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Badge color={workflow.source === 'workflow' ? '#06d6a0' : '#4A9EFF'}>{workflow.source}</Badge>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onAssign({
              agentId: workflow.steps[0]?.agent,
              title: workflow.name,
              instructions: workflow.steps.map((s) => `${AGENT_EMOJIS[s.agent] || s.agent}: ${s.action}`).join('\n'),
            })}
          >
            <Zap size={12} />
            <span className="ml-1">Assign</span>
          </Button>
          <Button size="sm" variant="secondary" onClick={handleRun} disabled={runState === 'starting' || isRunning}>
            {runState === 'starting' ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
            <span className="ml-1">{runState === 'confirm' ? 'Confirm' : isRunning ? 'Running' : 'Run'}</span>
          </Button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-text-tertiary">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-3 px-2 py-1">
          {triggerIcon}
          {triggerLabel}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-3 px-2 py-1">
          <span>Agents</span>
          <span>{agentList.map((agent) => AGENT_EMOJIS[agent] || agent).join(' ')}</span>
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-3 px-2 py-1">
          <span>Result</span>
          <span>Final step replies in Telegram</span>
        </span>
      </div>

      {workflow.approvalRequired && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-yellow-500/20 bg-yellow-500/8 p-2 text-xs text-yellow-300">
          <ShieldAlert size={13} className="mt-0.5 shrink-0" />
          <div>
            <div className="font-medium">Approval required</div>
            <div>{workflow.approvalReason || 'A Telegram notice will be sent before execution continues.'}</div>
          </div>
        </div>
      )}

      {runState === 'confirm' && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-3 px-3 py-2 text-xs text-text-secondary">
          <span>This workflow can send a Telegram approval request before it runs.</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => setRunState('idle')}>Cancel</Button>
            <Button size="sm" variant="primary" onClick={handleRun}>Run now</Button>
          </div>
        </div>
      )}

      {runError && (
        <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/8 px-3 py-2 text-xs text-red-300">{runError}</div>
      )}

      {displayRun && !expanded && (
        <div className="mt-3 flex items-center justify-between rounded-lg bg-surface-3 px-3 py-2 text-xs text-text-secondary">
          <div className="flex items-center gap-2">
            <RunStatusBadge status={displayRun.status} />
            <span>{relativeTime(displayRun.startedAt)}</span>
          </div>
          <span>
            {displayRun.completedAt ? formatDuration(displayRun.startedAt, displayRun.completedAt) : formatDuration(displayRun.startedAt)}
          </span>
        </div>
      )}

      {showSteps && displayRun && (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          <div className="flex items-center justify-between text-xs text-text-tertiary">
            <span>Run detail</span>
            <span>{formatDate(displayRun.startedAt, 'MMM d, HH:mm')}</span>
          </div>

          <div className="space-y-1.5">
            {displayRun.steps.map((step) => (
              <div key={step.stepIndex} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-surface-3/80">
                <StepStatusIcon status={step.status} />
                <span>{AGENT_EMOJIS[step.agent] || step.agent}</span>
                <span className="flex-1 truncate text-text-secondary">{step.action}</span>
                {step.status === 'running' && step.startedAt && <span className="text-text-tertiary">{formatDuration(step.startedAt)}</span>}
                {step.status === 'done' && step.startedAt && step.completedAt && <span className="text-text-tertiary">{formatDuration(step.startedAt, step.completedAt)}</span>}
              </div>
            ))}
          </div>

          {displayRun.status === 'failed' && displayRun.error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/8 px-3 py-2 text-xs text-red-300">{displayRun.error.slice(0, 200)}</div>
          )}

          {sortedRuns.length > 0 && (
            <div className="space-y-1 border-t border-border pt-3">
              <div className="text-xs text-text-tertiary">Recent runs</div>
              {sortedRuns.slice(0, 4).map((run) => (
                <button
                  key={run.id}
                  onClick={() => {
                    setExecutingRunId(run.id);
                    setExpanded(true);
                  }}
                  className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs text-text-secondary transition-colors hover:bg-surface-3"
                >
                  <div className="flex items-center gap-2">
                    <RunStatusBadge status={run.status} />
                    <span>{relativeTime(run.startedAt)}</span>
                  </div>
                  <span className="text-text-tertiary">
                    {run.completedAt ? formatDuration(run.startedAt, run.completedAt) : formatDuration(run.startedAt)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RepoCard({ repo, onAssign }: { repo: RepoStatus; onAssign: (ctx: AssignWorkContext) => void }) {
  const tone = repo.status === 'dirty' ? '#ffd166' : '#e94560';

  return (
    <div className="rounded-xl border border-border bg-surface-2/75 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-text-primary">{repo.owner}/{repo.name}</div>
          <div className="mt-1 text-xs text-text-tertiary">{repo.local}</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onAssign({
              agentId: 'dev',
              title: `Fix ${repo.owner}/${repo.name}`,
              instructions: `Repo ${repo.owner}/${repo.name} is ${repo.status} with ${repo.uncommittedCount} uncommitted changes on branch ${repo.default_branch}.\nPath: ${repo.local}\n\nInvestigate and resolve the issues. When done, create a PR to main for review.`,
            })}
            className="rounded-md border border-border bg-surface-3 px-2 py-1 text-xs font-medium text-text-primary transition-colors hover:bg-surface-4"
          >
            Fix
          </button>
          <Badge color={tone}>{repo.status}</Badge>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-text-secondary">
        <MetricChip label="Changes" value={repo.uncommittedCount.toString()} />
        <MetricChip label="Branch" value={repo.default_branch} />
      </div>

      {repo.lastCommit && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-text-tertiary">
          <GitCommitHorizontal size={12} />
          <span className="truncate">{repo.lastCommit}</span>
        </div>
      )}

      {repo.watch.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {repo.watch.slice(0, 3).map((item) => (
            <Badge key={item} variant="outline">{item}</Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function AgentPulseRow({ agent, onAssign }: { agent: AgentSummary; onAssign: (ctx: AssignWorkContext) => void }) {
  const tone = agent.state === 'active' ? 'text-status-online' : agent.state === 'quiet' ? 'text-status-warning' : 'text-status-error';
  const { openChat } = useChatPanel();

  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-surface-2/65 px-3 py-2 transition-colors hover:border-border-hover">
      <Link href={`/agents/${agent.agentId}`} className="flex min-w-0 flex-1 items-start gap-3">
        <div className="text-base">{AGENT_EMOJIS[agent.agentId] || '🤖'}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text-primary">{agent.agentId}</span>
            <span className={`text-[10px] uppercase tracking-[0.18em] ${tone}`}>{agent.state}</span>
          </div>
          <div className="truncate text-xs text-text-tertiary">{AGENT_ROLES[agent.agentId] || 'Agent workspace'}</div>
        </div>
        <div className="text-right text-xs text-text-tertiary">
          {agent.lastActivity ? relativeTime(agent.lastActivity) : 'no activity'}
        </div>
      </Link>
      <button
        onClick={() => onAssign({ agentId: agent.agentId, title: '', instructions: '' })}
        className="mt-0.5 shrink-0 rounded-md p-1 text-text-tertiary transition-colors hover:bg-surface-3 hover:text-accent-yellow"
        title={`Assign work to ${agent.agentId}`}
      >
        <Zap size={14} />
      </button>
      <button
        onClick={() => openChat(agent.agentId)}
        className="mt-0.5 shrink-0 rounded-md p-1 text-text-tertiary transition-colors hover:bg-surface-3 hover:text-accent"
        title={`Chat with ${agent.agentId}`}
      >
        <MessageCircle size={14} />
      </button>
    </div>
  );
}

function BriefingRow({ briefing }: { briefing: Briefing }) {
  const color = briefing.status === 'delivered' ? '#06d6a0' : briefing.status === 'pending' ? '#ffd166' : '#4A9EFF';

  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-surface-2/75 px-3 py-2">
      <div>
        <div className="text-sm text-text-primary">{briefing.name}</div>
        <div className="text-xs text-text-tertiary">{briefing.time}</div>
      </div>
      <Badge color={color}>{briefing.status}</Badge>
    </div>
  );
}

function RunListItem({ run }: { run: WorkflowRun }) {
  return (
    <div className="rounded-lg border border-border bg-surface-2/75 px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm text-text-primary">{run.workflowName}</div>
          <div className="text-xs text-text-tertiary">Started {relativeTime(run.startedAt)}</div>
        </div>
        <RunStatusBadge status={run.status} />
      </div>
    </div>
  );
}

function RunStatusBadge({ status }: { status: WorkflowRun['status'] }) {
  const colors: Record<WorkflowRun['status'], string> = {
    pending: '#555555',
    running: '#4A9EFF',
    completed: '#06d6a0',
    failed: '#e94560',
  };

  return <Badge color={colors[status]}>{status}</Badge>;
}

function formatDuration(start: string, end?: string, now?: number): string {
  const ms = (end ? new Date(end).getTime() : (now || Date.now())) - new Date(start).getTime();
  const secs = Math.max(0, Math.floor(ms / 1000));
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  return `${mins}m ${remSecs}s`;
}

function Panel({ title, eyebrow, icon, children }: { title: string; eyebrow: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-surface-1/85 p-4 glass">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-text-tertiary">{eyebrow}</div>
          <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            {icon}
            {title}
          </div>
        </div>
      </div>
      {children}
    </section>
  );
}

function AutomationJobsPanel({ jobs, onChanged }: { jobs: JobContract[]; onChanged: () => void }) {
  type WorkflowStepDraft = {
    id: string;
    name: string;
    type: 'steer' | 'drive' | 'shell' | 'agent' | 'note';
    command: string;
    args: string;
    prompt: string;
    targetAgent: string;
  };

  function specToDrafts(spec: Record<string, unknown> | undefined): WorkflowStepDraft[] {
    const rawSteps = Array.isArray(spec?.steps) ? spec.steps : [];
    const drafts = rawSteps
      .map((raw, index) => {
        if (!raw || typeof raw !== 'object') return null;
        const step = raw as Record<string, unknown>;
        const type = step.type;
        if (!['steer', 'drive', 'shell', 'agent', 'note'].includes(String(type))) return null;
        return {
          id: typeof step.id === 'string' ? step.id : `step_${index + 1}`,
          name: typeof step.name === 'string' ? step.name : `Step ${index + 1}`,
          type: type as WorkflowStepDraft['type'],
          command: typeof step.command === 'string' ? step.command : '',
          args: Array.isArray(step.args) ? step.args.map((item) => String(item)).join(', ') : '',
          prompt: typeof step.prompt === 'string' ? step.prompt : typeof step.message === 'string' ? step.message : '',
          targetAgent: typeof step.targetAgent === 'string' ? step.targetAgent : 'main',
        } satisfies WorkflowStepDraft;
      })
      .filter((item): item is WorkflowStepDraft => Boolean(item));
    return drafts.length > 0 ? drafts : [
      { id: 'step_1', name: 'Open command page', type: 'steer', command: 'open-url', args: '--app,Safari,--url,http://localhost:3000/command', prompt: '', targetAgent: 'main' },
    ];
  }

  const [mode, setMode] = useState<NonNullable<JobContract['mode']>>('agent');
  const [targetAgent, setTargetAgent] = useState('main');
  const [prompt, setPrompt] = useState('');
  const [command, setCommand] = useState('');
  const [workflow, setWorkflow] = useState('safari_open_command_page');
  const [selectedTemplateId, setSelectedTemplateId] = useState(JOB_TEMPLATES[0]?.id || '');
  const [argsText, setArgsText] = useState('');
  const [workflowSpecText, setWorkflowSpecText] = useState('');
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStepDraft[]>([
    { id: 'step_1', name: 'Open command page', type: 'steer', command: 'open-url', args: '--app,Safari,--url,http://localhost:3000/command', prompt: '', targetAgent: 'main' },
  ]);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedJobs, setArchivedJobs] = useState<JobContract[]>([]);
  const [policy, setPolicy] = useState<any | null>(null);
  const [artifactAdmin, setArtifactAdmin] = useState<ArtifactAdminSummaryContract | null>(null);
  const [jobMetrics, setJobMetrics] = useState<JobMetricsContract | null>(null);
  const [policyAdmin, setPolicyAdmin] = useState<PolicyAdminContract | null>(null);
  const [serverTemplates, setServerTemplates] = useState<AutomationTemplate[]>(JOB_TEMPLATES.map((template) => ({ ...template, builtIn: true })));
  const [templateVersions, setTemplateVersions] = useState<JobTemplateVersionContract[]>([]);
  const [templateDiff, setTemplateDiff] = useState<JobTemplateDiffContract | null>(null);
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState('all');
  const [templateIdDraft, setTemplateIdDraft] = useState('');
  const [templateNameDraft, setTemplateNameDraft] = useState('');
  const [templateDescriptionDraft, setTemplateDescriptionDraft] = useState('');
  const [templateCategoryDraft, setTemplateCategoryDraft] = useState('custom');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState(false);
  const [cloningTemplate, setCloningTemplate] = useState(false);
  const [restoringTemplate, setRestoringTemplate] = useState<number | null>(null);
  const [pruningArtifacts, setPruningArtifacts] = useState(false);
  const [compressingArtifacts, setCompressingArtifacts] = useState(false);
  const [compressDays, setCompressDays] = useState('7');
  const [pruneDays, setPruneDays] = useState('30');
  const [error, setError] = useState<string | null>(null);

  const visibleJobs = showArchived ? archivedJobs : jobs;
  const selectedJob = visibleJobs.find((job) => job.id === selectedJobId) || visibleJobs[0];
  const selectedTemplate = serverTemplates.find((template) => template.id === selectedTemplateId);
  const filteredTemplates = useMemo(() => {
    return serverTemplates.filter((template) => {
      const matchesSearch = templateSearch.trim()
        ? `${template.name} ${template.description} ${template.id}`.toLowerCase().includes(templateSearch.trim().toLowerCase())
        : true;
      const matchesCategory = templateCategoryFilter === 'all' ? true : (template.category || 'uncategorized') === templateCategoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [serverTemplates, templateCategoryFilter, templateSearch]);
  const templateCategories = useMemo(() => {
    return ['all', ...new Set(serverTemplates.map((template) => template.category || 'uncategorized'))];
  }, [serverTemplates]);

  const builtWorkflowSpec = useMemo(() => {
    return {
      steps: workflowSteps.map((step) => {
        if (step.type === 'shell') {
          return { id: step.id, name: step.name || step.id, type: 'shell', prompt: step.prompt };
        }
        if (step.type === 'agent') {
          return { id: step.id, name: step.name || step.id, type: 'agent', prompt: step.prompt, targetAgent: step.targetAgent || 'main' };
        }
        if (step.type === 'note') {
          return { id: step.id, name: step.name || step.id, type: 'note', message: step.prompt };
        }
        return {
          id: step.id,
          name: step.name || step.id,
          type: step.type,
          command: step.command,
          args: step.args.split(',').map((item) => item.trim()).filter(Boolean),
        };
      }),
    };
  }, [workflowSteps]);

  useEffect(() => {
    if (mode === 'workflow') {
      setWorkflowSpecText(JSON.stringify(builtWorkflowSpec, null, 2));
    }
  }, [builtWorkflowSpec, mode]);

  useEffect(() => {
    if (!selectedJobId && visibleJobs[0]) {
      setSelectedJobId(visibleJobs[0].id);
    }
    if (selectedJobId && !visibleJobs.some((job) => job.id === selectedJobId) && visibleJobs[0]) {
      setSelectedJobId(visibleJobs[0].id);
    }
  }, [selectedJobId, visibleJobs]);

  async function loadArchived() {
    const response = await fetch('/api/jobs?archived=true');
    const payload = await response.json();
    setArchivedJobs(payload);
  }

  async function loadPolicy() {
    const response = await fetch('/api/jobs/policy');
    const payload = await response.json();
    setPolicy(payload);
  }

  async function loadArtifactAdmin() {
    const response = await fetch('/api/jobs/artifacts/admin');
    const payload = await response.json();
    setArtifactAdmin(payload);
  }

  async function loadMetrics() {
    const response = await fetch('/api/jobs/metrics');
    const payload = await response.json();
    setJobMetrics(payload);
  }

  async function loadPolicyAdmin() {
    const response = await fetch('/api/jobs/policy/admin');
    const payload = await response.json();
    setPolicyAdmin(payload);
  }

  async function loadTemplates() {
    const response = await fetch('/api/jobs/templates');
    const payload = await response.json();
    if (Array.isArray(payload) && payload.length > 0) {
      setServerTemplates(payload as AutomationTemplate[]);
    } else if (Array.isArray(payload)) {
      setServerTemplates([]);
    }
  }

  async function loadTemplateVersions(templateId: string) {
    if (!templateId) {
      setTemplateVersions([]);
      setTemplateDiff(null);
      return;
    }
    const response = await fetch(`/api/jobs/templates/${templateId}/versions`);
    const payload = await response.json();
    if (Array.isArray(payload)) {
      setTemplateVersions(payload);
      return;
    }
    if (Array.isArray(payload?.versions)) {
      setTemplateVersions(payload.versions);
      return;
    }
    setTemplateVersions([]);
    setTemplateDiff(null);
  }

  async function loadTemplateDiff(fromVersion: number, toVersion?: number) {
    if (!selectedTemplateId) return;
    const query = new URLSearchParams({ from: String(fromVersion) });
    if (typeof toVersion === 'number') query.set('to', String(toVersion));
    const response = await fetch(`/api/jobs/templates/${selectedTemplateId}/diff?${query.toString()}`);
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || 'Failed to diff template versions');
      return;
    }
    setTemplateDiff(payload);
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      let workflowSpec: Record<string, unknown> | undefined;
      if (mode === 'workflow') {
        try {
          const parsed = JSON.parse(workflowSpecText);
          if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
            setError('workflowSpec JSON must be an object');
            return;
          }
          workflowSpec = parsed as Record<string, unknown>;
        } catch {
          setError('workflowSpec JSON is invalid');
          return;
        }
      }
      const requestBody: Record<string, unknown> = {
        prompt,
        mode,
        targetAgent,
        command: command || undefined,
        workflow: workflow || undefined,
        args: argsText.split(',').map((item) => item.trim()).filter(Boolean),
      };
      if (workflowSpec) {
        requestBody.workflowSpec = workflowSpec;
      }
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error || 'Failed to submit job');
        return;
      }
      setPrompt('');
      setCommand('');
      setArgsText('');
      onChanged();
      await loadPolicy();
      await loadPolicyAdmin();
      await loadArtifactAdmin();
      await loadMetrics();
    } catch {
      setError('Network error while submitting automation job');
    } finally {
      setSubmitting(false);
    }
  }

  async function stop(jobId: string) {
    await fetch(`/api/jobs/${jobId}`, { method: 'DELETE' });
    onChanged();
    if (showArchived) await loadArchived();
  }

  async function resume(jobId: string, modeValue?: 'resume_failed' | 'resume_from' | 'rerun_all', resumeFromStepId?: string) {
    const response = await fetch(`/api/jobs/${jobId}/retry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(modeValue ? { mode: modeValue, resumeFromStepId } : {}),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || 'Failed to resume job');
      return;
    }
    onChanged();
    if (showArchived) await loadArchived();
  }

  async function clear() {
    setClearing(true);
    try {
      await fetch('/api/jobs/clear', { method: 'POST' });
      onChanged();
      await loadArchived();
      await loadArtifactAdmin();
      await loadMetrics();
    } finally {
      setClearing(false);
    }
  }

  async function pruneArtifactStore() {
    setPruningArtifacts(true);
    setError(null);
    try {
      const response = await fetch('/api/jobs/artifacts/prune', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ olderThanDays: Number(pruneDays || '30') }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error || 'Failed to prune archived artifacts');
        return;
      }
      await loadArtifactAdmin();
      await loadMetrics();
    } finally {
      setPruningArtifacts(false);
    }
  }

  async function compressArtifactStore() {
    setCompressingArtifacts(true);
    setError(null);
    try {
      const response = await fetch('/api/jobs/artifacts/compress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ olderThanDays: Number(compressDays || '7') }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error || 'Failed to compress archived artifacts');
        return;
      }
      await loadArtifactAdmin();
    } finally {
      setCompressingArtifacts(false);
    }
  }

  function updateWorkflowStep(index: number, patch: Partial<WorkflowStepDraft>) {
    setWorkflowSteps((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  function addWorkflowStep() {
    setWorkflowSteps((current) => [
      ...current,
      { id: `step_${current.length + 1}`, name: `Step ${current.length + 1}`, type: 'steer', command: '', args: '', prompt: '', targetAgent: 'main' },
    ]);
  }

  function removeWorkflowStep(index: number) {
    setWorkflowSteps((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function loadTemplateIntoDrafts(template: JobTemplateContract | undefined) {
    if (!template) return;
    setTemplateIdDraft(template.id || '');
    setTemplateNameDraft(template.name || '');
    setTemplateDescriptionDraft(template.description || '');
    setTemplateCategoryDraft(template.category || 'custom');
  }

  function applyTemplate(templateId: string) {
    const template = serverTemplates.find((item) => item.id === templateId);
    if (!template) return;
    setMode(template.mode || 'workflow');
    setTargetAgent(template.targetAgent || 'main');
    setPrompt(template.prompt || '');
    setCommand(template.command || '');
    setWorkflow(template.workflow || '');
    setArgsText((template.args || []).join(', '));
    if (template.workflowSpec) {
      setWorkflowSteps(specToDrafts(template.workflowSpec));
      setWorkflowSpecText(JSON.stringify(template.workflowSpec, null, 2));
    } else {
      setWorkflowSpecText('');
    }
    loadTemplateIntoDrafts(template);
  }

  async function saveTemplate() {
    setSavingTemplate(true);
    setError(null);
    try {
      let workflowSpec: Record<string, unknown>;
      try {
        const parsed = JSON.parse(workflowSpecText);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          setError('workflowSpec JSON must be an object');
          return;
        }
        workflowSpec = parsed as Record<string, unknown>;
      } catch {
        setError('workflowSpec JSON is invalid');
        return;
      }
      const payload: AutomationTemplate = {
        id: templateIdDraft || selectedTemplateId || '',
        name: templateNameDraft || 'Untitled Template',
        description: templateDescriptionDraft || 'Custom workflow template',
        category: templateCategoryDraft || 'custom',
        workflowSpec,
        mode: 'workflow',
        inputs: selectedTemplate?.inputs || [],
      };
      const isExistingCustom = serverTemplates.some((template) => template.id === payload.id && !template.builtIn);
      const response = await fetch(isExistingCustom ? `/api/jobs/templates/${payload.id}` : '/api/jobs/templates', {
        method: isExistingCustom ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || 'Failed to save template');
        return;
      }
      await loadTemplates();
      setSelectedTemplateId(result.id);
      loadTemplateIntoDrafts(result);
      await loadTemplateVersions(result.id);
    } finally {
      setSavingTemplate(false);
    }
  }

  async function deleteTemplate() {
    if (!selectedTemplate || selectedTemplate.builtIn) return;
    setDeletingTemplate(true);
    setError(null);
    try {
      const response = await fetch(`/api/jobs/templates/${selectedTemplate.id}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || 'Failed to delete template');
        return;
      }
      await loadTemplates();
      const fallbackId = serverTemplates.find((template) => template.builtIn)?.id || '';
      setSelectedTemplateId(fallbackId);
      setTemplateIdDraft('');
      setTemplateNameDraft('');
      setTemplateDescriptionDraft('');
      setTemplateCategoryDraft('custom');
      setTemplateVersions([]);
    } finally {
      setDeletingTemplate(false);
    }
  }

  async function cloneTemplate() {
    if (!selectedTemplate) return;
    const suggestedId = `${selectedTemplate.id}_copy`;
    const nextId = window.prompt('Clone template as id', suggestedId)?.trim();
    if (!nextId) return;
    const nextName = window.prompt('Clone template as name', `${selectedTemplate.name} Copy`)?.trim();
    setCloningTemplate(true);
    setError(null);
    try {
      const response = await fetch(`/api/jobs/templates/${selectedTemplate.id}/clone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: nextId, name: nextName || `${selectedTemplate.name} Copy` }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || 'Failed to clone template');
        return;
      }
      await loadTemplates();
      setSelectedTemplateId(result.id);
      loadTemplateIntoDrafts(result);
      await loadTemplateVersions(result.id);
    } finally {
      setCloningTemplate(false);
    }
  }

  async function restoreTemplate(version: number) {
    if (!selectedTemplate || selectedTemplate.builtIn) return;
    if (!window.confirm(`Restore ${selectedTemplate.name} to version ${version}? This creates a new latest version.`)) return;
    setRestoringTemplate(version);
    setError(null);
    try {
      const response = await fetch(`/api/jobs/templates/${selectedTemplate.id}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || 'Failed to restore template version');
        return;
      }
      await loadTemplates();
      setSelectedTemplateId(result.id);
      loadTemplateIntoDrafts(result);
      await loadTemplateVersions(result.id);
    } finally {
      setRestoringTemplate(null);
    }
  }

  useEffect(() => {
    void loadPolicy();
    void loadPolicyAdmin();
    void loadArtifactAdmin();
    void loadMetrics();
    void loadTemplates();
  }, []);

  useEffect(() => {
    if (selectedTemplate) {
      loadTemplateIntoDrafts(selectedTemplate);
    }
    void loadTemplateVersions(selectedTemplateId);
  }, [selectedTemplateId, serverTemplates]);

  return (
    <Panel title="Automation Jobs" eyebrow="Remote Control" icon={<Play size={15} className="text-accent-blue" />}>
      <div className="grid gap-4 xl:grid-cols-[380px_320px_1fr]">
        <div className="space-y-3 rounded-xl border border-border bg-surface-2/75 p-4">
          {policy ? (
            <div className="rounded-lg border border-border bg-surface-3 px-3 py-2 text-xs text-text-secondary">
              <div className="font-semibold text-text-primary">Policy</div>
              <div className="mt-1">Dangerous actions: {policy.allowDangerous ? 'enabled' : 'blocked by default'}</div>
              <div className="mt-1">Use `OPENCLAW_LISTEN_ALLOW_DANGEROUS=true` to allow blocked destructive commands.</div>
            </div>
          ) : null}

          {policyAdmin ? (
            <div className="rounded-lg border border-border bg-surface-3 p-3">
              <div className="mb-2 text-xs uppercase tracking-[0.16em] text-text-tertiary">Policy Admin</div>
              <div className="space-y-1 text-xs text-text-secondary">
                <div>{policyAdmin.summary}</div>
                {policyAdmin.env.slice(0, 4).map((entry) => (
                  <div key={entry.name} className="rounded-md border border-border bg-surface-2/70 px-2 py-2">
                    <div className="font-semibold text-text-primary">{entry.name}</div>
                    <div className="mt-1 break-all">{entry.value || '(empty)'}</div>
                    <div className="mt-1 text-text-tertiary">{entry.description}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {artifactAdmin ? (
            <div className="rounded-lg border border-border bg-surface-3 p-3">
              <div className="mb-2 text-xs uppercase tracking-[0.16em] text-text-tertiary">Artifact Store</div>
              <div className="space-y-1 text-xs text-text-secondary">
                <div>Active: {artifactAdmin.active.jobCount} jobs · {artifactAdmin.active.bytes} bytes</div>
                <div>Archived: {artifactAdmin.archived.jobCount} jobs · {artifactAdmin.archived.bytes} bytes</div>
                {artifactAdmin.compressed ? (
                  <div>Compressed: {artifactAdmin.compressed.bundleCount} archives · {artifactAdmin.compressed.bytes} bytes</div>
                ) : null}
                {artifactAdmin.exports ? (
                  <div>Exports: {artifactAdmin.exports.bundleCount} bundles · {artifactAdmin.exports.bytes} bytes</div>
                ) : null}
                <div>Retention target: {artifactAdmin.retentionDays || 30} days</div>
                {typeof artifactAdmin.oldestArchivedAgeDays === 'number' ? (
                  <div>Oldest archived artifact set: {artifactAdmin.oldestArchivedAgeDays} days</div>
                ) : null}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <input value={compressDays} onChange={(event) => setCompressDays(event.target.value)} className="w-20 rounded-md border border-border bg-surface-2/80 px-2 py-1 text-xs text-text-primary" />
                <Button size="sm" variant="ghost" onClick={compressArtifactStore} disabled={compressingArtifacts}>
                  {compressingArtifacts ? <Loader2 size={12} className="animate-spin" /> : 'Compress Archived'}
                </Button>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <input value={pruneDays} onChange={(event) => setPruneDays(event.target.value)} className="w-20 rounded-md border border-border bg-surface-2/80 px-2 py-1 text-xs text-text-primary" />
                <Button size="sm" variant="ghost" onClick={pruneArtifactStore} disabled={pruningArtifacts}>
                  {pruningArtifacts ? <Loader2 size={12} className="animate-spin" /> : 'Prune Archived'}
                </Button>
              </div>
            </div>
          ) : null}

          {jobMetrics ? (
            <div className="rounded-lg border border-border bg-surface-3 p-3">
              <div className="mb-2 text-xs uppercase tracking-[0.16em] text-text-tertiary">Observability</div>
              <div className="grid grid-cols-2 gap-2 text-xs text-text-secondary">
                <div className="rounded-md border border-border bg-surface-2/70 px-2 py-2">Jobs: {jobMetrics.jobs.total}</div>
                <div className="rounded-md border border-border bg-surface-2/70 px-2 py-2">Avg done: {jobMetrics.jobs.averageCompletedDurationMs ? `${Math.round(jobMetrics.jobs.averageCompletedDurationMs / 1000)}s` : 'n/a'}</div>
                <div className="rounded-md border border-border bg-surface-2/70 px-2 py-2">Blocked: {jobMetrics.policy.blockedJobs}</div>
                <div className="rounded-md border border-border bg-surface-2/70 px-2 py-2">Custom templates: {jobMetrics.templates.custom}</div>
                <div className="rounded-md border border-border bg-surface-2/70 px-2 py-2">Median: {jobMetrics.jobs.medianCompletedDurationMs ? `${Math.round(jobMetrics.jobs.medianCompletedDurationMs / 1000)}s` : 'n/a'}</div>
                <div className="rounded-md border border-border bg-surface-2/70 px-2 py-2">P95: {jobMetrics.jobs.p95CompletedDurationMs ? `${Math.round(jobMetrics.jobs.p95CompletedDurationMs / 1000)}s` : 'n/a'}</div>
              </div>
              {jobMetrics.templates.usage.length > 0 ? (
                <div className="mt-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-text-tertiary">Top Templates</div>
                  <div className="mt-2 space-y-1 text-xs text-text-secondary">
                    {jobMetrics.templates.usage.slice(0, 4).map((item) => (
                      <div key={item.templateId} className="flex items-center justify-between rounded-md border border-border bg-surface-2/70 px-2 py-1.5">
                        <span>{item.templateId}</span>
                        <span>{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {jobMetrics.templates.performance.length > 0 ? (
                <div className="mt-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-text-tertiary">Success Rate</div>
                  <div className="mt-2 space-y-1 text-xs text-text-secondary">
                    {jobMetrics.templates.performance.slice(0, 4).map((item) => (
                      <div key={item.templateId} className="rounded-md border border-border bg-surface-2/70 px-2 py-1.5">
                        <div className="flex items-center justify-between">
                          <span>{item.templateId}</span>
                          <span>{item.successRate}%</span>
                        </div>
                        <div className="mt-1 text-[11px] text-text-tertiary">{item.completed}/{item.total} completed · {item.failed} failed</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {jobMetrics.trends.length > 0 ? (
                <div className="mt-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-text-tertiary">14 Day Trend</div>
                  <div className="mt-2 space-y-1 text-xs text-text-secondary">
                    {jobMetrics.trends.slice(-4).map((item) => (
                      <div key={item.date} className="rounded-md border border-border bg-surface-2/70 px-2 py-1.5">
                        <div className="flex items-center justify-between">
                          <span>{item.date}</span>
                          <span>{item.total} jobs</span>
                        </div>
                        <div className="mt-1 text-[11px] text-text-tertiary">
                          {item.completed} completed · {item.failed} failed · {item.blocked} blocked
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {jobMetrics.steps.artifactVolume.length > 0 ? (
                <div className="mt-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-text-tertiary">Artifact Heavy Steps</div>
                  <div className="mt-2 space-y-1 text-xs text-text-secondary">
                    {jobMetrics.steps.artifactVolume.slice(0, 3).map((item) => (
                      <div key={item.name} className="rounded-md border border-border bg-surface-2/70 px-2 py-1.5">
                        <div className="flex items-center justify-between">
                          <span>{item.name}</span>
                          <span>{item.bytes} bytes</span>
                        </div>
                        <div className="mt-1 text-[11px] text-text-tertiary">{item.count} artifacts</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {jobMetrics.lineage.recentChains.length > 0 ? (
                <div className="mt-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-text-tertiary">Recent Retry Chains</div>
                  <div className="mt-2 space-y-1 text-xs text-text-secondary">
                    {jobMetrics.lineage.recentChains.slice(-3).reverse().map((chain) => (
                      <div key={chain.rootJobId} className="rounded-md border border-border bg-surface-2/70 px-2 py-1.5">
                        <div className="flex items-center justify-between">
                          <span>{chain.templateId || chain.rootJobId}</span>
                          <span>{chain.attempts} attempts</span>
                        </div>
                        <div className="mt-1 text-[11px] text-text-tertiary">
                          latest {chain.latestStatus || 'unknown'} · {chain.latestJobId || chain.rootJobId}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="rounded-lg border border-border bg-surface-3 p-3">
            <div className="mb-2 text-xs uppercase tracking-[0.16em] text-text-tertiary">Workflow Templates</div>
            <div className="mb-2 grid gap-2">
              <input value={templateSearch} onChange={(event) => setTemplateSearch(event.target.value)} placeholder="Search templates" className="w-full rounded-md border border-border bg-surface-2/80 px-3 py-2 text-xs text-text-primary" />
              <select value={templateCategoryFilter} onChange={(event) => setTemplateCategoryFilter(event.target.value)} className="w-full rounded-md border border-border bg-surface-2/80 px-3 py-2 text-xs text-text-primary">
                {templateCategories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
            <select value={selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value)} className="w-full rounded-md border border-border bg-surface-2/80 px-3 py-2 text-sm text-text-primary">
              {filteredTemplates.map((template) => (
                <option key={template.id} value={template.id}>{template.name}{template.builtIn ? ' (Built-in)' : ''}</option>
              ))}
            </select>
            <div className="mt-2 text-xs text-text-secondary">
              {selectedTemplate?.description || 'Apply a reusable starter flow to the builder.'}
            </div>
            {selectedTemplate ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedTemplate.favorite ? <Badge color="#ffd166">favorite</Badge> : null}
                {selectedTemplate.recommended ? <Badge color="#06d6a0">recommended</Badge> : null}
                <Badge variant="outline">{selectedTemplate.category || 'uncategorized'}</Badge>
              </div>
            ) : null}
            {selectedTemplate?.version ? (
              <div className="mt-1 text-[11px] text-text-tertiary">Version {selectedTemplate.version}</div>
            ) : null}
            {typeof selectedTemplate?.artifactRetentionDays === 'number' ? (
              <div className="mt-1 text-[11px] text-text-tertiary">Artifact retention: {selectedTemplate.artifactRetentionDays} days</div>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => applyTemplate(selectedTemplateId)}>Apply Template</Button>
              <Button size="sm" variant="ghost" onClick={cloneTemplate} disabled={cloningTemplate || !selectedTemplate}>
                {cloningTemplate ? <Loader2 size={12} className="animate-spin" /> : 'Clone'}
              </Button>
              {selectedTemplate?.builtIn ? null : (
                <Button size="sm" variant="ghost" onClick={deleteTemplate} disabled={deletingTemplate}>
                  {deletingTemplate ? <Loader2 size={12} className="animate-spin" /> : 'Delete'}
                </Button>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface-3 p-3">
            <div className="mb-2 text-xs uppercase tracking-[0.16em] text-text-tertiary">Template Editor</div>
            <div className="grid gap-2">
              <input value={templateIdDraft} onChange={(event) => setTemplateIdDraft(event.target.value)} placeholder="template_id" className="w-full rounded-md border border-border bg-surface-2/80 px-3 py-2 text-xs text-text-primary" />
              <input value={templateNameDraft} onChange={(event) => setTemplateNameDraft(event.target.value)} placeholder="Template name" className="w-full rounded-md border border-border bg-surface-2/80 px-3 py-2 text-xs text-text-primary" />
              <input value={templateCategoryDraft} onChange={(event) => setTemplateCategoryDraft(event.target.value)} placeholder="Category" className="w-full rounded-md border border-border bg-surface-2/80 px-3 py-2 text-xs text-text-primary" />
              <textarea value={templateDescriptionDraft} onChange={(event) => setTemplateDescriptionDraft(event.target.value)} placeholder="Template description" className="min-h-[72px] w-full rounded-md border border-border bg-surface-2/80 px-3 py-2 text-xs text-text-primary" />
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="secondary" onClick={saveTemplate} disabled={savingTemplate}>
                {savingTemplate ? <Loader2 size={12} className="animate-spin" /> : 'Save Template'}
              </Button>
            </div>
            {templateVersions.length > 0 ? (
              <div className="mt-3">
                <div className="mb-2 text-[11px] uppercase tracking-[0.16em] text-text-tertiary">Version History</div>
                <div className="space-y-1 text-xs text-text-secondary">
                  {templateVersions.slice().reverse().map((version) => (
                    <div key={`${version.version}-${version.updatedAt || 'builtin'}`} className="rounded-md border border-border bg-surface-2/70 px-2 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-semibold text-text-primary">v{version.version}{version.builtIn ? ' · built-in' : ''}</div>
                        <div className="flex items-center gap-2">
                          {version.version !== selectedTemplate?.version ? (
                            <Button size="sm" variant="ghost" onClick={() => void loadTemplateDiff(version.version, selectedTemplate?.version ?? version.version)}>
                              Compare
                            </Button>
                          ) : null}
                          {!selectedTemplate?.builtIn && version.version !== selectedTemplate?.version ? (
                            <Button size="sm" variant="ghost" onClick={() => restoreTemplate(version.version)} disabled={restoringTemplate === version.version}>
                              {restoringTemplate === version.version ? <Loader2 size={12} className="animate-spin" /> : 'Restore'}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                      <div>{version.updatedAt || 'bundled with app'}</div>
                      {version.description ? <div className="mt-1 text-text-tertiary">{version.description}</div> : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {templateDiff ? (
              <div className="mt-3">
                <div className="mb-2 text-[11px] uppercase tracking-[0.16em] text-text-tertiary">
                  Diff v{templateDiff.fromVersion} → v{templateDiff.toVersion}
                </div>
                <pre className="max-h-72 overflow-auto rounded-md border border-border bg-surface-2 px-2 py-2 text-[11px] text-text-secondary">
                  {templateDiff.diff || 'No changes.'}
                </pre>
              </div>
            ) : null}
          </div>

          <div>
            <div className="mb-2 text-xs uppercase tracking-[0.16em] text-text-tertiary">Mode</div>
            <select value={mode} onChange={(event) => setMode(event.target.value as NonNullable<JobContract['mode']>)} className="w-full rounded-md border border-border bg-surface-3 px-3 py-2 text-sm text-text-primary">
              {['agent', 'shell', 'steer', 'drive', 'workflow', 'note'].map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>

          {mode === 'agent' && (
            <select value={targetAgent} onChange={(event) => setTargetAgent(event.target.value)} className="w-full rounded-md border border-border bg-surface-3 px-3 py-2 text-sm text-text-primary">
              {['main', 'mail', 'docs', 'research', 'ai-research', 'dev', 'security'].map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          )}

          {(mode === 'agent' || mode === 'shell' || mode === 'note') && (
            <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Prompt" className="min-h-[96px] w-full rounded-md border border-border bg-surface-3 px-3 py-2 text-sm text-text-primary" />
          )}

          {(mode === 'steer' || mode === 'drive') && (
            <>
              <input value={command} onChange={(event) => setCommand(event.target.value)} placeholder="Command" className="w-full rounded-md border border-border bg-surface-3 px-3 py-2 text-sm text-text-primary" />
              <input value={argsText} onChange={(event) => setArgsText(event.target.value)} placeholder="Args (comma separated)" className="w-full rounded-md border border-border bg-surface-3 px-3 py-2 text-sm text-text-primary" />
            </>
          )}

          {mode === 'workflow' && (
            <div className="space-y-3">
              <div className="rounded-lg border border-border bg-surface-3 px-3 py-2 text-xs text-text-secondary">
                Templates are starter flows and reusable saved specs. The builder submits the current `workflowSpec`, so edits here run immediately even before you save a new template version.
              </div>
              <div className="rounded-lg border border-border bg-surface-3 p-3">
                <div className="mb-2 text-xs uppercase tracking-[0.16em] text-text-tertiary">Step Builder</div>
                <div className="space-y-3">
                  {workflowSteps.map((step, index) => (
                    <div key={step.id} className="rounded-lg border border-border bg-surface-2/75 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="text-xs font-semibold text-text-primary">{step.id}</div>
                        {workflowSteps.length > 1 && <Button size="sm" variant="ghost" onClick={() => removeWorkflowStep(index)}>Remove</Button>}
                      </div>
                      <div className="grid gap-2">
                        <input value={step.name} onChange={(event) => updateWorkflowStep(index, { name: event.target.value })} placeholder="Step name" className="w-full rounded-md border border-border bg-surface-3 px-3 py-2 text-xs text-text-primary" />
                        <select value={step.type} onChange={(event) => updateWorkflowStep(index, { type: event.target.value as WorkflowStepDraft['type'] })} className="w-full rounded-md border border-border bg-surface-3 px-3 py-2 text-xs text-text-primary">
                          {['steer', 'drive', 'shell', 'agent', 'note'].map((item) => <option key={item} value={item}>{item}</option>)}
                        </select>
                        {(step.type === 'steer' || step.type === 'drive') && (
                          <>
                            <input value={step.command} onChange={(event) => updateWorkflowStep(index, { command: event.target.value })} placeholder="Command" className="w-full rounded-md border border-border bg-surface-3 px-3 py-2 text-xs text-text-primary" />
                            <input value={step.args} onChange={(event) => updateWorkflowStep(index, { args: event.target.value })} placeholder="Args (comma separated)" className="w-full rounded-md border border-border bg-surface-3 px-3 py-2 text-xs text-text-primary" />
                          </>
                        )}
                        {(step.type === 'shell' || step.type === 'agent' || step.type === 'note') && (
                          <textarea value={step.prompt} onChange={(event) => updateWorkflowStep(index, { prompt: event.target.value })} placeholder={step.type === 'note' ? 'Message' : 'Prompt'} className="min-h-[72px] w-full rounded-md border border-border bg-surface-3 px-3 py-2 text-xs text-text-primary" />
                        )}
                        {step.type === 'agent' && (
                          <select value={step.targetAgent} onChange={(event) => updateWorkflowStep(index, { targetAgent: event.target.value })} className="w-full rounded-md border border-border bg-surface-3 px-3 py-2 text-xs text-text-primary">
                            {['main', 'mail', 'docs', 'research', 'ai-research', 'dev', 'security'].map((item) => <option key={item} value={item}>{item}</option>)}
                          </select>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3">
                  <Button size="sm" variant="secondary" onClick={addWorkflowStep}>Add Step</Button>
                </div>
              </div>
              <textarea value={workflowSpecText} onChange={(event) => setWorkflowSpecText(event.target.value)} placeholder='workflowSpec JSON' className="min-h-[220px] w-full rounded-md border border-border bg-surface-3 px-3 py-2 text-xs text-text-primary" />
            </div>
          )}

          {error && <div className="rounded-lg border border-red-500/20 bg-red-500/8 px-3 py-2 text-xs text-red-300">{error}</div>}

          <div className="flex gap-2">
            <Button size="sm" variant="primary" onClick={submit} disabled={submitting}>
              {submitting ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
              <span className="ml-1">Submit</span>
            </Button>
            <Button size="sm" variant="secondary" onClick={async () => { setShowArchived((current) => !current); await loadArchived(); }}>
              {showArchived ? 'Show Live' : 'Show Archived'}
            </Button>
            <Button size="sm" variant="ghost" onClick={clear} disabled={clearing}>
              {clearing ? <Loader2 size={12} className="animate-spin" /> : 'Archive All'}
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {visibleJobs.length === 0 ? <EmptyMessage message={showArchived ? 'No archived automation jobs.' : 'No automation jobs queued yet.'} /> : visibleJobs.slice(0, 12).map((job) => (
            <div
              key={job.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedJobId(job.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setSelectedJobId(job.id);
                }
              }}
              className={`w-full rounded-xl border p-4 text-left ${selectedJob?.id === job.id ? 'border-accent bg-surface-3/90' : 'border-border bg-surface-2/75'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-text-primary">{job.workflow || job.command || job.mode || job.prompt || job.id}</div>
                  <div className="mt-1 text-xs text-text-tertiary">{(job.mode || 'job')} · {job.targetAgent} · {relativeTime(job.createdAt)}</div>
                </div>
                <Badge color={job.status === 'failed' ? '#e94560' : job.status === 'completed' ? '#06d6a0' : job.status === 'running' ? '#4A9EFF' : '#ffd166'}>
                  {job.status}
                </Badge>
              </div>
              {job.summary ? <div className="mt-2 text-xs text-text-secondary">{job.summary}</div> : null}
              <div className="mt-3">
                <Link href={`/command/jobs/${job.id}`} className="text-xs text-accent hover:text-accent-hover" onClick={(event) => event.stopPropagation()}>
                  Open detail page
                </Link>
              </div>
            </div>
          ))}
        </div>

        {selectedJob ? (
          <JobDetailPanel
            job={selectedJob}
            archived={showArchived}
            onStop={(jobId) => void stop(jobId)}
            onResume={(jobId, resumeMode, stepId) => void resume(jobId, resumeMode, stepId)}
            detailHref={`/command/jobs/${selectedJob.id}`}
          />
        ) : (
          <div className="space-y-3 rounded-xl border border-border bg-surface-2/75 p-4">
            <EmptyMessage message="Select a job to inspect details." />
          </div>
        )}
      </div>
    </Panel>
  );
}

function TrustPill({ label, value, tone }: { label: string; value: string; tone: 'good' | 'warn' | 'danger' | 'neutral' }) {
  const toneClass = {
    good: 'border-green-500/25 bg-green-500/8 text-green-200',
    warn: 'border-yellow-500/25 bg-yellow-500/8 text-yellow-100',
    danger: 'border-red-500/25 bg-red-500/8 text-red-200',
    neutral: 'border-border bg-surface-2/75 text-text-secondary',
  }[tone];

  return (
    <div className={`rounded-xl border px-3 py-2 ${toneClass}`}>
      <div className="text-[11px] uppercase tracking-[0.16em]">{label}</div>
      <div className="mt-1 text-xs leading-relaxed">{value}</div>
    </div>
  );
}

function AttentionCard({ item, onAssign }: { item: AttentionItem; onAssign: (ctx: AssignWorkContext) => void }) {
  const toneClass = {
    danger: 'border-red-500/20 bg-red-500/8',
    warn: 'border-yellow-500/20 bg-yellow-500/8',
    info: 'border-border bg-surface-2/75',
  }[item.tone];

  const isActionable = item.tone === 'danger' || item.tone === 'warn';
  const defaultAgent = item.id === 'dirty-repos' ? 'dev' : item.id === 'failed-runs' ? 'main' : item.id === 'stale-tasks' ? 'main' : undefined;

  const content = (
    <div className={`rounded-xl border p-4 transition-colors hover:border-border-hover ${toneClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-text-primary">{item.title}</div>
          <div className="mt-1 text-xs leading-relaxed text-text-secondary">{item.detail}</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isActionable && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onAssign({
                  agentId: defaultAgent,
                  title: `Fix: ${item.title}`,
                  instructions: `${item.title}\n\n${item.detail}\n\nInvestigate and resolve this issue. When done, create a PR to main for review.`,
                });
              }}
              className="rounded-md border border-border bg-surface-3 px-2 py-1 text-xs font-medium text-text-primary transition-colors hover:bg-surface-4"
            >
              Fix
            </button>
          )}
          {item.href && <ArrowRight size={14} className="mt-1 text-text-tertiary" />}
        </div>
      </div>
    </div>
  );

  return item.href ? <Link href={item.href}>{content}</Link> : content;
}

function RecommendationCard({
  recommendation,
  creating,
  onCreateTask,
  onAssign,
}: {
  recommendation: SystemRecommendation;
  creating: boolean;
  onCreateTask: () => Promise<void>;
  onAssign: (ctx: AssignWorkContext) => void;
}) {
  const toneClass = {
    danger: 'border-red-500/20 bg-red-500/8',
    warn: 'border-yellow-500/20 bg-yellow-500/8',
    info: 'border-border bg-surface-2/75',
  }[recommendation.tone];

  const impactColor = recommendation.impact === 'high' ? '#e94560' : '#4A9EFF';
  const effortColor = recommendation.effort === 'low' ? '#06d6a0' : '#ffd166';

  return (
    <div className={`rounded-xl border p-4 transition-colors hover:border-border-hover ${toneClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="text-sm font-semibold text-text-primary">{recommendation.title}</div>
          <div className="text-xs leading-relaxed text-text-secondary">{recommendation.detail}</div>
        </div>
      </div>

      <div className="mt-3 text-xs leading-relaxed text-text-tertiary">{recommendation.rationale}</div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge color={impactColor}>{`${recommendation.impact} impact`}</Badge>
        <Badge color={effortColor}>{`${recommendation.effort} effort`}</Badge>
        <Badge variant="outline">{recommendation.actionLabel}</Badge>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Button size="sm" variant="primary" onClick={onCreateTask} disabled={creating}>
          {creating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          <span className="ml-1">{creating ? 'Creating...' : 'Create Task'}</span>
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => onAssign({
            title: recommendation.title,
            instructions: `${recommendation.detail}\n\nRationale: ${recommendation.rationale}\n\nWhen done, create a PR to main for review.`,
            priority: recommendation.taskDraft?.priority,
          })}
        >
          <Zap size={12} />
          <span className="ml-1">Assign</span>
        </Button>
        <Link
          href={recommendation.href}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-3 px-2.5 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-surface-4"
        >
          <span>{recommendation.actionLabel}</span>
          <ArrowRight size={12} className="text-text-tertiary" />
        </Link>
      </div>
    </div>
  );
}

function StatCard({ label, value, note, tone }: { label: string; value: string; note: string; tone: 'accent' | 'info' | 'warn' | 'neutral' }) {
  const toneClass = {
    accent: 'text-accent',
    info: 'text-accent-blue',
    warn: 'text-accent-yellow',
    neutral: 'text-text-secondary',
  }[tone];

  return (
    <div className="rounded-xl border border-border bg-surface-2/75 p-4">
      <div className="text-[11px] uppercase tracking-[0.16em] text-text-tertiary">{label}</div>
      <div className={`mt-2 font-mono text-2xl font-semibold ${toneClass}`}>{value}</div>
      <div className="mt-1 text-xs text-text-tertiary">{note}</div>
    </div>
  );
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-3 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-[0.16em] text-text-tertiary">{label}</div>
      <div className="mt-1 truncate text-xs text-text-primary">{value}</div>
    </div>
  );
}

function EmptyMessage({ message }: { message: string }) {
  return <div className="rounded-xl border border-dashed border-border bg-surface-2/40 px-4 py-6 text-center text-sm text-text-tertiary">{message}</div>;
}
