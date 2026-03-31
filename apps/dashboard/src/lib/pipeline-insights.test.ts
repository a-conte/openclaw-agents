import { describe, expect, it } from 'vitest';
import {
  buildAgentLoad,
  buildWorkflowActivity,
  filterPipelineTasks,
  getRunFailurePressure,
  getTaskStageHealth,
  isTaskDueSoon,
  isTaskOverdue,
} from './pipeline-insights';
import type { Task, Workflow, WorkflowRun } from './types';

const baseTask = {
  description: '',
  labels: [],
  order: 0,
  createdAt: '2026-03-19T10:00:00.000Z',
  updatedAt: '2026-03-19T10:00:00.000Z',
} satisfies Partial<Task>;

describe('filterPipelineTasks', () => {
  const tasks = [
    { ...baseTask, id: '1', title: 'Urgent review', status: 'review', priority: 'urgent', agentId: 'main' },
    { ...baseTask, id: '2', title: 'Backlog item', status: 'backlog', priority: 'low' },
    { ...baseTask, id: '3', title: 'Active bug', status: 'in_progress', priority: 'medium', agentId: 'dev', labels: ['bug'] },
  ] as Task[];

  it('filters by focus hotspot', () => {
    expect(filterPipelineTasks(tasks, { focus: 'pipeline-hotspots' }).map((task) => task.id)).toEqual(['1', '3']);
  });

  it('filters by search and agent', () => {
    expect(filterPipelineTasks(tasks, { search: 'bug', agentId: 'dev' }).map((task) => task.id)).toEqual(['3']);
  });
});

describe('task timing helpers', () => {
  const now = new Date('2026-03-19T12:00:00.000Z');

  it('detects overdue tasks', () => {
    expect(
      isTaskOverdue(
        { ...baseTask, id: '1', title: 'Ship fix', status: 'todo', priority: 'high', dueDate: '2026-03-18T12:00:00.000Z' } as Task,
        now
      )
    ).toBe(true);
  });

  it('detects due soon tasks', () => {
    expect(
      isTaskDueSoon(
        { ...baseTask, id: '2', title: 'Prep review', status: 'todo', priority: 'medium', dueDate: '2026-03-20T11:00:00.000Z' } as Task,
        now
      )
    ).toBe(true);
  });

  it('summarizes stage health', () => {
    const summary = getTaskStageHealth(
      [
        { ...baseTask, id: '1', title: 'Overdue', status: 'todo', priority: 'high', dueDate: '2026-03-18T12:00:00.000Z' },
        { ...baseTask, id: '2', title: 'Due soon', status: 'todo', priority: 'medium', dueDate: '2026-03-20T11:00:00.000Z' },
        { ...baseTask, id: '3', title: 'Review', status: 'review', priority: 'medium', agentId: 'main' },
        { ...baseTask, id: '4', title: 'Active', status: 'in_progress', priority: 'medium', agentId: 'dev' },
        { ...baseTask, id: '5', title: 'Done', status: 'done', priority: 'low', updatedAt: '2026-03-19T11:00:00.000Z' },
      ] as Task[],
      now
    );

    expect(summary).toMatchObject({
      overdue: 1,
      dueSoon: 1,
      unassigned: 3,
      review: 1,
      active: 1,
      doneToday: 1,
    });
  });
});

describe('buildAgentLoad', () => {
  it('sorts agents by work pressure', () => {
    const result = buildAgentLoad([
      { ...baseTask, id: '1', title: 'A', status: 'in_progress', priority: 'urgent', agentId: 'dev' },
      { ...baseTask, id: '2', title: 'B', status: 'review', priority: 'high', agentId: 'dev' },
      { ...baseTask, id: '3', title: 'C', status: 'todo', priority: 'medium', agentId: 'main' },
    ] as Task[]);

    expect(result[0]?.agentId).toBe('dev');
    expect(result[0]?.urgent).toBe(1);
  });
});

describe('workflow activity', () => {
  const workflows = [
    { name: 'Nightly Brief', description: '', trigger: 'cron', approvalRequired: false, steps: [], source: 'workflow' },
    { name: 'Triage Inbox', description: '', trigger: 'event', approvalRequired: false, steps: [], source: 'pipeline' },
  ] as Workflow[];

  const runs = [
    {
      id: 'run-1',
      workflowName: 'Nightly Brief',
      status: 'completed',
      startedAt: '2026-03-18T12:00:00.000Z',
      completedAt: '2026-03-18T12:05:00.000Z',
      triggeredBy: 'dashboard',
      steps: [],
    },
    {
      id: 'run-2',
      workflowName: 'Nightly Brief',
      status: 'failed',
      startedAt: '2026-03-19T12:00:00.000Z',
      triggeredBy: 'dashboard',
      steps: [],
      error: 'boom',
    },
  ] as WorkflowRun[];

  it('maps workflow activity with success rate', () => {
    const result = buildWorkflowActivity(workflows, runs);
    expect(result[0]?.workflow.name).toBe('Nightly Brief');
    expect(result[0]?.recentRuns).toBe(2);
    expect(result[0]?.successRate).toBe(0.5);
  });

  it('counts recent run failures', () => {
    const pressure = getRunFailurePressure(runs, new Date('2026-03-19T15:00:00.000Z'));
    expect(pressure.failedLast24h).toBe(1);
    expect(pressure.latestFailure?.id).toBe('run-2');
  });
});
