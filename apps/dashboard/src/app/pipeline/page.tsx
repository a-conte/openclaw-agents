'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, LayoutGrid, List, Play, RefreshCcw, Sparkles, UserRound } from 'lucide-react';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { InlineError } from '@/components/shared/InlineError';
import { TaskBoard } from '@/components/tasks/TaskBoard';
import { TaskFilters } from '@/components/tasks/TaskFilters';
import { TaskModal } from '@/components/tasks/TaskModal';
import { Badge } from '@/components/shared/Badge';
import { Button } from '@/components/shared/Button';
import { useDashboardFilters, useToast } from '@/components/providers/DashboardProviders';
import { useTasks } from '@/hooks/useTasks';
import { useWorkflowRuns } from '@/hooks/useWorkflowRuns';
import { useWorkflows } from '@/hooks/useWorkflows';
import { AGENT_COLORS, AGENT_EMOJIS, PIPELINE_STAGES, PRIORITY_COLORS, STATUS_LABELS, TASK_STATUSES } from '@/lib/constants';
import {
  buildAgentLoad,
  buildWorkflowActivity,
  filterPipelineTasks,
  getRunFailurePressure,
  getTaskStageHealth,
  isTaskOverdue,
} from '@/lib/pipeline-insights';
import type { Task, Workflow } from '@/lib/types';
import { cn, formatDate, relativeTime, truncate } from '@/lib/utils';

const FOCUS_PRESETS = [
  { id: '', label: 'Everything', tone: 'neutral' as const },
  { id: 'pipeline-hotspots', label: 'Hotspots', tone: 'danger' as const },
  { id: 'active', label: 'Active work', tone: 'info' as const },
  { id: 'review', label: 'Needs review', tone: 'warn' as const },
  { id: 'overdue', label: 'Overdue', tone: 'danger' as const },
  { id: 'unassigned', label: 'Unassigned', tone: 'neutral' as const },
];

function getNextStatus(status: Task['status']): Task['status'] | null {
  const index = TASK_STATUSES.indexOf(status);
  if (index === -1 || index === TASK_STATUSES.length - 1) return null;
  return TASK_STATUSES[index + 1];
}

function toneClasses(tone: 'neutral' | 'info' | 'warn' | 'danger', active: boolean): string {
  if (active) {
    return {
      neutral: 'border-border-active bg-surface-3 text-text-primary',
      info: 'border-accent-blue/40 bg-accent-blue/12 text-blue-100',
      warn: 'border-accent-yellow/40 bg-accent-yellow/12 text-amber-100',
      danger: 'border-accent-red/40 bg-accent-red/12 text-red-100',
    }[tone];
  }

  return 'border-border bg-surface-1/70 text-text-secondary hover:border-border-hover hover:text-text-primary';
}

function PipelineContent() {
  const { filters, setSearch, setAgentId, setFocus, resetFilters } = useDashboardFilters();
  const { pushToast } = useToast();
  const { tasks, isLoading, error, createTask, updateTask, deleteTask, mutate } = useTasks();
  const { workflows, error: workflowsError } = useWorkflows();
  const { runs, error: runsError } = useWorkflowRuns();
  const [priorityFilter, setPriorityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [view, setView] = useState<'list' | 'board'>('list');
  const [runningWorkflow, setRunningWorkflow] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(filters.search);

  async function dispatchTaskRun(task: Pick<Task, 'id' | 'title' | 'description' | 'agentId'>) {
    if (!task.agentId) return;
    const response = await fetch(`/api/agents/${task.agentId}/recommendations/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'run',
        type: 'task',
        taskId: task.id,
        title: task.title,
        description: task.description,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      pushToast({
        title: 'Agent dispatch failed',
        description: data?.error || 'The task was saved, but the agent job did not start.',
        tone: 'error',
      });
      return;
    }
    pushToast({
      title: 'Agent started',
      description: data?.jobId ? `Job ${data.jobId} is now running for ${task.agentId}.` : `${task.agentId} is now working on ${task.title}.`,
      tone: 'success',
    });
  }

  async function updateTaskAndRun(id: string, updates: Partial<Task>) {
    const existing = tasks.find((task) => task.id === id);
    if (!existing) return;
    const updated = await updateTask(id, updates);
    const taskForRun = ((updated && typeof updated === 'object' ? updated : null) as Task | null) || { ...existing, ...updates };
    if (taskForRun.agentId) {
      await dispatchTaskRun(taskForRun);
    }
  }

  async function createTaskAndRun(task: Partial<Task>) {
    const created = await createTask(task);
    if (created && typeof created === 'object' && 'id' in created && 'agentId' in created) {
      await dispatchTaskRun(created as Task);
    }
  }

  async function advanceTask(task: Task) {
    const nextStatus = getNextStatus(task.status);
    if (!nextStatus) return;
    await updateTask(task.id, { status: nextStatus });
  }

  async function startTask(task: Task) {
    const nextStatus = task.status === 'done' ? 'review' : 'in_progress';
    await updateTaskAndRun(task.id, { status: nextStatus });
  }

  async function executeWorkflow(workflow: Workflow) {
    setRunningWorkflow(workflow.name);
    try {
      const response = await fetch('/api/workflows/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflowName: workflow.name }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        pushToast({
          title: 'Workflow failed to start',
          description: data?.error || `Could not start ${workflow.name}.`,
          tone: 'error',
        });
        return;
      }
      await mutate();
      pushToast({
        title: 'Workflow started',
        description: data?.runId ? `${workflow.name} is running as ${data.runId}.` : `${workflow.name} is now running.`,
        tone: 'success',
      });
    } finally {
      setRunningWorkflow(null);
    }
  }

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'n' && !event.metaKey && !event.ctrlKey) {
        const target = event.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
        setNewTaskOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const filteredTasks = useMemo(
    () =>
      filterPipelineTasks(tasks, {
        search: deferredSearch,
        agentId: filters.agentId,
        priority: priorityFilter,
        status: statusFilter,
        focus: filters.focus,
      }),
    [deferredSearch, filters.agentId, filters.focus, priorityFilter, statusFilter, tasks]
  );

  const queueHealth = useMemo(() => getTaskStageHealth(tasks), [tasks]);
  const runPressure = useMemo(() => getRunFailurePressure(runs), [runs]);
  const agentLoad = useMemo(() => buildAgentLoad(filteredTasks.length ? filteredTasks : tasks), [filteredTasks, tasks]);
  const workflowActivity = useMemo(() => buildWorkflowActivity(workflows, runs).slice(0, 6), [runs, workflows]);
  const stageCounts = useMemo(
    () =>
      Object.entries(PIPELINE_STAGES).map(([status, stage]) => ({
        status,
        ...stage,
        count: filteredTasks.filter((task) => task.status === status).length,
      })),
    [filteredTasks]
  );

  const activeFilterCount = [Boolean(filters.search), Boolean(filters.agentId), Boolean(priorityFilter), Boolean(statusFilter), Boolean(filters.focus)].filter(Boolean).length;
  const maxCount = Math.max(...stageCounts.map((stage) => stage.count), 1);
  const urgentTasks = filteredTasks
    .filter((task) => task.priority === 'urgent' || isTaskOverdue(task))
    .sort((left, right) => new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime())
    .slice(0, 5);
  const reviewTasks = filteredTasks
    .filter((task) => task.status === 'review')
    .sort((left, right) => new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime())
    .slice(0, 5);
  const activeTasks = filteredTasks
    .filter((task) => task.status === 'in_progress')
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
    .slice(0, 6);

  function clearLocalFilters() {
    resetFilters();
    setPriorityFilter('');
    setStatusFilter('');
  }

  return (
    <div className="flex h-full flex-col overflow-hidden p-6">
      <div className="rounded-[28px] border border-border bg-[radial-gradient(circle_at_top_left,rgba(251,86,86,0.18),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-text-tertiary">
              <Sparkles size={12} />
              Agentic pipeline control
            </div>
            <h1 className="font-[var(--font-heading)] text-2xl font-semibold text-text-primary">Pipeline</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
              Keep work moving with one surface for queue pressure, agent ownership, and workflow execution.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-full border border-border bg-surface-1/80 p-1">
              <button
                onClick={() => setView('list')}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors',
                  view === 'list' ? 'bg-surface-3 text-text-primary' : 'text-text-tertiary hover:text-text-secondary'
                )}
              >
                <List size={13} /> Triage
              </button>
              <button
                onClick={() => setView('board')}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors',
                  view === 'board' ? 'bg-surface-3 text-text-primary' : 'text-text-tertiary hover:text-text-secondary'
                )}
              >
                <LayoutGrid size={13} /> Board
              </button>
            </div>
            <Button variant="secondary" size="sm" onClick={() => void mutate()}>
              <RefreshCcw size={13} className="mr-1" /> Refresh
            </Button>
            <Button variant="primary" size="sm" onClick={() => setNewTaskOpen(true)}>
              New Task
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Queue health"
            value={`${filteredTasks.length}`}
            detail={`${queueHealth.active} active, ${queueHealth.review} in review`}
            accent="var(--color-accent-blue)"
            icon={<Clock3 size={14} />}
          />
          <MetricCard
            title="Deadline pressure"
            value={`${queueHealth.overdue}`}
            detail={`${queueHealth.dueSoon} due soon`}
            accent="var(--color-accent-red)"
            icon={<AlertTriangle size={14} />}
          />
          <MetricCard
            title="Ownership gaps"
            value={`${queueHealth.unassigned}`}
            detail={`${agentLoad.length} agents carrying work`}
            accent="var(--color-accent-yellow)"
            icon={<UserRound size={14} />}
          />
          <MetricCard
            title="Automation runs"
            value={`${runPressure.activeRuns}`}
            detail={`${runPressure.failedLast24h} failed in 24h`}
            accent="var(--color-accent-teal)"
            icon={<Play size={14} />}
          />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {FOCUS_PRESETS.map((preset) => {
          const active = filters.focus === preset.id;
          const count = preset.id === 'overdue' ? queueHealth.overdue :
            preset.id === 'unassigned' ? queueHealth.unassigned :
            preset.id === 'review' ? queueHealth.review :
            preset.id === 'active' ? queueHealth.active :
            preset.id === 'pipeline-hotspots' ? urgentTasks.length + reviewTasks.length :
            filteredTasks.length;

          return (
            <button
              key={preset.id || 'all'}
              onClick={() => setFocus(preset.id)}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors',
                toneClasses(preset.tone, active)
              )}
            >
              <span>{preset.label}</span>
              <span className="rounded-full bg-black/20 px-1.5 py-0.5 text-[10px]">{count}</span>
            </button>
          );
        })}
        {activeFilterCount > 0 && (
          <button
            onClick={clearLocalFilters}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-1/70 px-3 py-1.5 text-xs text-text-tertiary transition-colors hover:text-text-primary"
          >
            <RefreshCcw size={12} />
            Reset {activeFilterCount} filter{activeFilterCount === 1 ? '' : 's'}
          </button>
        )}
      </div>

      {(error || workflowsError || runsError) && (
        <div className="mt-4 space-y-2">
          {error && <InlineError message="Failed to load tasks." />}
          {workflowsError && <InlineError message="Failed to load workflows." />}
          {runsError && <InlineError message="Failed to load workflow runs." />}
        </div>
      )}

      <div className="mt-4 rounded-2xl border border-border bg-surface-1/80 p-4">
        <TaskFilters
          search={filters.search}
          onSearchChange={setSearch}
          agentFilter={filters.agentId}
          onAgentFilterChange={setAgentId}
          priorityFilter={priorityFilter}
          onPriorityFilterChange={setPriorityFilter}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          onClearFilters={clearLocalFilters}
          onNewTask={() => setNewTaskOpen(true)}
        />
      </div>

      {isLoading ? (
        <div className="mt-4 flex-1 rounded-2xl border border-border bg-surface-1/60 animate-pulse" />
      ) : (
        <div className="mt-4 grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1.5fr)_400px]">
          <div className="flex min-h-0 flex-col gap-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
              <section className="rounded-2xl border border-border bg-surface-1/80 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xs uppercase tracking-[0.16em] text-text-tertiary">Stage pressure</h2>
                    <p className="mt-1 text-sm text-text-secondary">Where tasks are stacking up right now.</p>
                  </div>
                  <span className="text-xs text-text-tertiary">{filteredTasks.length} visible tasks</span>
                </div>
                <div className="mt-4 space-y-3">
                  {stageCounts.map((stage) => (
                    <button
                      key={stage.status}
                      onClick={() => setStatusFilter((current) => current === stage.status ? '' : stage.status)}
                      className="flex w-full items-center gap-3 text-left"
                    >
                      <div className="w-20 text-xs text-text-secondary">{stage.label}</div>
                      <div className="relative h-9 flex-1 overflow-hidden rounded-full border border-border bg-surface-2">
                        <div
                          className="absolute inset-y-0 left-0 rounded-full opacity-80 transition-all duration-300"
                          style={{
                            width: `${Math.max((stage.count / maxCount) * 100, stage.count > 0 ? 10 : 0)}%`,
                            backgroundColor: stage.color,
                          }}
                        />
                        <div className="relative flex h-full items-center justify-between px-3 text-xs">
                          <span className="text-surface-0 mix-blend-screen">{STATUS_LABELS[stage.status] || stage.label}</span>
                          <span className="font-mono text-text-primary">{stage.count}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-surface-1/80 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xs uppercase tracking-[0.16em] text-text-tertiary">Critical queue</h2>
                    <p className="mt-1 text-sm text-text-secondary">Urgent, overdue, or blocked items.</p>
                  </div>
                  {queueHealth.overdue > 0 && <Badge color={PRIORITY_COLORS.urgent}>{queueHealth.overdue} overdue</Badge>}
                </div>
                <div className="mt-4 space-y-2">
                  {urgentTasks.length === 0 ? (
                    <EmptyMiniState message="No urgent pressure in the current filter set." />
                  ) : (
                    urgentTasks.map((task) => (
                      <TaskListRow key={task.id} task={task} onAdvance={advanceTask} onRun={startTask} />
                    ))
                  )}
                </div>
              </section>
            </div>

            {view === 'list' ? (
              <section className="min-h-0 rounded-2xl border border-border bg-surface-1/80 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xs uppercase tracking-[0.16em] text-text-tertiary">Triage table</h2>
                    <p className="mt-1 text-sm text-text-secondary">Use the table when speed matters more than drag-and-drop.</p>
                  </div>
                  <span className="text-xs text-text-tertiary">{activeTasks.length} active now</span>
                </div>

                <div className="mt-4 min-h-0 overflow-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.14em] text-text-tertiary">
                        <th className="px-3 py-2 font-medium">Task</th>
                        <th className="px-3 py-2 font-medium">Owner</th>
                        <th className="px-3 py-2 font-medium">Priority</th>
                        <th className="px-3 py-2 font-medium">Stage</th>
                        <th className="px-3 py-2 font-medium">Updated</th>
                        <th className="px-3 py-2 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTasks.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-10 text-center text-sm text-text-tertiary">
                            No tasks match the current filters.
                          </td>
                        </tr>
                      ) : (
                        filteredTasks.map((task) => {
                          const stage = PIPELINE_STAGES[task.status] || { label: task.status, color: '#555' };
                          const overdue = isTaskOverdue(task);
                          const nextStatus = getNextStatus(task.status);

                          return (
                            <tr key={task.id} className="border-b border-border/70 hover:bg-surface-2/60">
                              <td className="px-3 py-3 align-top">
                                <div className="flex items-start gap-3">
                                  <span className="mt-0.5 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PRIORITY_COLORS[task.priority] }} />
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="truncate text-sm text-text-primary">{task.title}</p>
                                      {overdue && <Badge color={PRIORITY_COLORS.urgent}>Overdue</Badge>}
                                    </div>
                                    {task.description && (
                                      <p className="mt-1 max-w-xl text-xs leading-5 text-text-tertiary">{truncate(task.description, 120)}</p>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-3 align-top text-xs text-text-secondary">
                                {task.agentId ? `${AGENT_EMOJIS[task.agentId] || '🤖'} ${task.agentId}` : 'Unassigned'}
                              </td>
                              <td className="px-3 py-3 align-top">
                                <Badge color={PRIORITY_COLORS[task.priority]}>{task.priority}</Badge>
                              </td>
                              <td className="px-3 py-3 align-top">
                                <Badge color={stage.color}>{stage.label}</Badge>
                              </td>
                              <td className="px-3 py-3 align-top text-xs text-text-tertiary">
                                {relativeTime(task.updatedAt)}
                                {task.dueDate && <div className="mt-1 text-[11px]">Due {formatDate(task.dueDate, 'MMM d')}</div>}
                              </td>
                              <td className="px-3 py-3 align-top">
                                <div className="flex flex-wrap gap-1.5">
                                  {nextStatus && (
                                    <Button variant="ghost" size="sm" onClick={() => void advanceTask(task)} className="h-7 px-2 text-[11px]">
                                      <ArrowRight size={12} className="mr-1" />
                                      {STATUS_LABELS[nextStatus]}
                                    </Button>
                                  )}
                                  {task.agentId && task.status !== 'done' && (
                                    <Button variant="ghost" size="sm" onClick={() => void startTask(task)} className="h-7 px-2 text-[11px]">
                                      <Play size={12} className="mr-1" />
                                      Start
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : (
              <div className="min-h-0 rounded-2xl border border-border bg-surface-1/80 p-4">
                <div className="mb-4">
                  <h2 className="text-xs uppercase tracking-[0.16em] text-text-tertiary">Board</h2>
                  <p className="mt-1 text-sm text-text-secondary">Use drag-and-drop when you are reshaping the queue, not just triaging it.</p>
                </div>
                <div className="min-h-0 h-[calc(100vh-29rem)]">
                  <TaskBoard
                    tasks={filteredTasks}
                    onUpdate={updateTask}
                    onCreate={createTask}
                    onUpdateAndRun={updateTaskAndRun}
                    onCreateAndRun={createTaskAndRun}
                    onRunTask={startTask}
                    onAdvanceTask={advanceTask}
                    onDelete={deleteTask}
                  />
                </div>
              </div>
            )}
          </div>

          <aside className="flex min-h-0 flex-col gap-4">
            <section className="rounded-2xl border border-border bg-surface-1/80 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xs uppercase tracking-[0.16em] text-text-tertiary">Agent load</h2>
                  <p className="mt-1 text-sm text-text-secondary">Who is carrying the most active pipeline weight.</p>
                </div>
                <Badge variant="outline">{agentLoad.length} active</Badge>
              </div>
              <div className="mt-4 space-y-2">
                {agentLoad.length === 0 ? (
                  <EmptyMiniState message="No assigned tasks yet." />
                ) : (
                  agentLoad.map((agent) => (
                    <div key={agent.agentId} className="rounded-xl border border-border bg-surface-2/70 p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-text-primary">
                          {AGENT_EMOJIS[agent.agentId] || '🤖'} {agent.agentId}
                        </div>
                        <span
                          className="rounded-full px-2 py-0.5 text-[11px]"
                          style={{ backgroundColor: `${AGENT_COLORS[agent.agentId] || '#666'}22`, color: AGENT_COLORS[agent.agentId] || '#ddd' }}
                        >
                          {agent.assigned} queued
                        </span>
                      </div>
                      <div className="mt-2 flex gap-2 text-[11px] text-text-tertiary">
                        <span>{agent.active} active</span>
                        <span>{agent.review} review</span>
                        <span>{agent.urgent} urgent</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-surface-1/80 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xs uppercase tracking-[0.16em] text-text-tertiary">Automation runs</h2>
                  <p className="mt-1 text-sm text-text-secondary">Recent workflow activity on the shared pipelines.</p>
                </div>
                {runPressure.failedLast24h > 0 && <Badge color={PRIORITY_COLORS.urgent}>{runPressure.failedLast24h} failing</Badge>}
              </div>
              <div className="mt-4 space-y-2">
                {runs.length === 0 ? (
                  <EmptyMiniState message="No workflow runs recorded yet." />
                ) : (
                  runs.slice(0, 6).map((run) => (
                    <div key={run.id} className="rounded-xl border border-border bg-surface-2/70 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm text-text-primary">{run.workflowName}</div>
                          <div className="mt-1 text-[11px] text-text-tertiary">{relativeTime(run.startedAt)}</div>
                        </div>
                        <Badge color={run.status === 'failed' ? PRIORITY_COLORS.urgent : run.status === 'running' ? PRIORITY_COLORS.medium : '#06d6a0'}>
                          {run.status}
                        </Badge>
                      </div>
                      {run.error && <p className="mt-2 text-[11px] leading-5 text-red-200">{truncate(run.error, 100)}</p>}
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="min-h-0 rounded-2xl border border-border bg-surface-1/80 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xs uppercase tracking-[0.16em] text-text-tertiary">Playbooks</h2>
                  <p className="mt-1 text-sm text-text-secondary">Launch shared workflows directly from the pipeline tab.</p>
                </div>
                <Badge variant="outline">{workflows.length} available</Badge>
              </div>
              <div className="mt-4 space-y-3 overflow-auto">
                {workflowActivity.length === 0 ? (
                  <EmptyMiniState message="No workflows are available." />
                ) : (
                  workflowActivity.map(({ workflow, latestRun, recentRuns, successRate }) => (
                    <div key={workflow.name} className="rounded-xl border border-border bg-surface-2/70 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-text-primary">{workflow.name}</span>
                            <Badge color={workflow.source === 'pipeline' ? PRIORITY_COLORS.medium : '#666'}>{workflow.source}</Badge>
                          </div>
                          <p className="mt-1 text-[11px] leading-5 text-text-tertiary">{truncate(workflow.description || 'No description provided.', 120)}</p>
                          <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-text-tertiary">
                            <span>{workflow.steps.length} steps</span>
                            <span>{recentRuns} runs / 7d</span>
                            <span>{successRate === null ? 'No completions yet' : `${Math.round(successRate * 100)}% success`}</span>
                            {latestRun && <span>Last {relativeTime(latestRun.startedAt)}</span>}
                          </div>
                        </div>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => void executeWorkflow(workflow)}
                          disabled={runningWorkflow === workflow.name || workflow.steps.length === 0}
                          className="shrink-0"
                        >
                          {runningWorkflow === workflow.name ? 'Starting...' : 'Run'}
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-surface-1/80 p-4">
              <div>
                <h2 className="text-xs uppercase tracking-[0.16em] text-text-tertiary">Review lane</h2>
                <p className="mt-1 text-sm text-text-secondary">Keep approval and QA tasks from getting buried.</p>
              </div>
              <div className="mt-4 space-y-2">
                {reviewTasks.length === 0 ? (
                  <EmptyMiniState message="Nothing is waiting in review." />
                ) : (
                  reviewTasks.map((task) => (
                    <TaskListRow key={task.id} task={task} onAdvance={advanceTask} onRun={startTask} />
                  ))
                )}
              </div>
            </section>
          </aside>
        </div>
      )}

      <TaskModal
        task={null}
        open={newTaskOpen}
        onClose={() => setNewTaskOpen(false)}
        onSave={updateTask}
        onCreate={createTask}
        onSaveAndRun={updateTaskAndRun}
        onCreateAndRun={createTaskAndRun}
        onDelete={deleteTask}
      />
    </div>
  );
}

function MetricCard({
  title,
  value,
  detail,
  accent,
  icon,
}: {
  title: string;
  value: string;
  detail: string;
  accent: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface-1/80 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs uppercase tracking-[0.14em] text-text-tertiary">{title}</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: `${accent}22`, color: accent }}>
          {icon}
        </span>
      </div>
      <div className="mt-4 text-3xl font-semibold text-text-primary">{value}</div>
      <div className="mt-1 text-xs text-text-tertiary">{detail}</div>
    </div>
  );
}

function TaskListRow({
  task,
  onAdvance,
  onRun,
}: {
  task: Task;
  onAdvance: (task: Task) => void | Promise<void>;
  onRun: (task: Task) => void | Promise<void>;
}) {
  const nextStatus = getNextStatus(task.status);

  return (
    <div className="rounded-xl border border-border bg-surface-2/70 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-primary">{task.title}</span>
            <Badge color={PRIORITY_COLORS[task.priority]}>{task.priority}</Badge>
          </div>
          <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-text-tertiary">
            <span>{STATUS_LABELS[task.status]}</span>
            <span>{task.agentId ? `${AGENT_EMOJIS[task.agentId] || '🤖'} ${task.agentId}` : 'Unassigned'}</span>
            <span>Updated {relativeTime(task.updatedAt)}</span>
          </div>
        </div>
        <div className="flex shrink-0 gap-1.5">
          {nextStatus && (
            <Button variant="ghost" size="sm" onClick={() => void onAdvance(task)} className="h-7 px-2 text-[11px]">
              <ArrowRight size={12} className="mr-1" />
              {STATUS_LABELS[nextStatus]}
            </Button>
          )}
          {task.agentId && task.status !== 'done' && (
            <Button variant="ghost" size="sm" onClick={() => void onRun(task)} className="h-7 px-2 text-[11px]">
              <Play size={12} className="mr-1" />
              Start
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyMiniState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface-2/50 px-3 py-4 text-sm text-text-tertiary">
      <div className="flex items-center gap-2">
        <CheckCircle2 size={14} />
        <span>{message}</span>
      </div>
    </div>
  );
}

export default function PipelinePage() {
  return (
    <ErrorBoundary name="Pipeline">
      <PipelineContent />
    </ErrorBoundary>
  );
}
