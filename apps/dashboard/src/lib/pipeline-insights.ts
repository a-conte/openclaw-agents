import { addDays, differenceInHours, isAfter, subDays } from 'date-fns';
import { ACTIVE_AGENT_IDS } from './constants';
import type { Task, Workflow, WorkflowRun } from './types';

export interface WorkflowActivityItem {
  workflow: Workflow;
  latestRun: WorkflowRun | null;
  recentRuns: number;
  successRate: number | null;
}

export function filterPipelineTasks(
  tasks: Task[],
  filters: {
    search?: string;
    agentId?: string;
    priority?: string;
    status?: string;
    focus?: string;
  }
): Task[] {
  const searchNeedle = (filters.search || '').trim().toLowerCase();

  return tasks.filter((task) => {
    if (filters.agentId && task.agentId !== filters.agentId) return false;
    if (filters.priority && task.priority !== filters.priority) return false;
    if (filters.status && task.status !== filters.status) return false;
    if (searchNeedle) {
      const haystack = [task.title, task.description, task.labels.join(' '), task.agentId || '']
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(searchNeedle)) return false;
    }

    switch (filters.focus) {
      case 'pipeline-hotspots':
        return ['in_progress', 'review'].includes(task.status) || ['urgent', 'high'].includes(task.priority);
      case 'overdue':
        return isTaskOverdue(task);
      case 'unassigned':
        return !task.agentId;
      case 'review':
        return task.status === 'review';
      case 'active':
        return task.status === 'in_progress';
      default:
        return true;
    }
  });
}

export function isTaskOverdue(task: Task, now = new Date()): boolean {
  if (!task.dueDate || task.status === 'done') return false;
  return isAfter(now, new Date(task.dueDate));
}

export function isTaskDueSoon(task: Task, now = new Date()): boolean {
  if (!task.dueDate || task.status === 'done') return false;
  const dueDate = new Date(task.dueDate);
  return !isAfter(now, dueDate) && isAfter(addDays(now, 2), dueDate);
}

export function getTaskStageHealth(tasks: Task[], now = new Date()) {
  const overdue = tasks.filter((task) => isTaskOverdue(task, now)).length;
  const dueSoon = tasks.filter((task) => isTaskDueSoon(task, now)).length;
  const unassigned = tasks.filter((task) => !task.agentId).length;
  const review = tasks.filter((task) => task.status === 'review').length;
  const active = tasks.filter((task) => task.status === 'in_progress').length;
  const doneToday = tasks.filter((task) => task.status === 'done' && isAfter(new Date(task.updatedAt), subDays(now, 1))).length;

  return { overdue, dueSoon, unassigned, review, active, doneToday };
}

export function buildAgentLoad(tasks: Task[]) {
  return ACTIVE_AGENT_IDS.map((agentId) => {
    const assigned = tasks.filter((task) => task.agentId === agentId);
    const active = assigned.filter((task) => task.status === 'in_progress').length;
    const review = assigned.filter((task) => task.status === 'review').length;
    const urgent = assigned.filter((task) => task.priority === 'urgent').length;

    return {
      agentId,
      assigned: assigned.length,
      active,
      review,
      urgent,
      score: active * 3 + review * 2 + urgent * 2 + assigned.length,
    };
  })
    .filter((agent) => agent.assigned > 0)
    .sort((left, right) => right.score - left.score || left.agentId.localeCompare(right.agentId));
}

export function buildWorkflowActivity(workflows: Workflow[], runs: WorkflowRun[]): WorkflowActivityItem[] {
  return workflows
    .map((workflow) => {
      const relatedRuns = runs
        .filter((run) => run.workflowName === workflow.name)
        .sort((left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime());

      const recentRuns = relatedRuns.filter((run) => isAfter(new Date(run.startedAt), subDays(new Date(), 7)));
      const completedRuns = recentRuns.filter((run) => run.status === 'completed' || run.status === 'failed');
      const successfulRuns = completedRuns.filter((run) => run.status === 'completed').length;

      return {
        workflow,
        latestRun: relatedRuns[0] || null,
        recentRuns: recentRuns.length,
        successRate: completedRuns.length ? successfulRuns / completedRuns.length : null,
      };
    })
    .sort((left, right) => {
      const leftTime = left.latestRun ? new Date(left.latestRun.startedAt).getTime() : 0;
      const rightTime = right.latestRun ? new Date(right.latestRun.startedAt).getTime() : 0;
      return rightTime - leftTime || left.workflow.name.localeCompare(right.workflow.name);
    });
}

export function getRunFailurePressure(runs: WorkflowRun[], now = new Date()) {
  const recentFailures = runs.filter((run) => {
    if (run.status !== 'failed') return false;
    return differenceInHours(now, new Date(run.startedAt)) <= 24;
  });

  const activeRuns = runs.filter((run) => run.status === 'running').length;
  return {
    activeRuns,
    failedLast24h: recentFailures.length,
    latestFailure: recentFailures.sort((left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime())[0] || null,
  };
}
