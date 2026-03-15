import { describe, expect, it, beforeEach } from 'vitest';
import type { HealthResponse, Task, WorkflowRun, RepoStatus } from './types';
import { buildAgentSummaries, buildCounts, buildSnapshot, getSequence, nextSequence } from './mission-control';

function makeHealth(agents: HealthResponse['agents'] = []): HealthResponse {
  return {
    ok: true,
    ts: Date.now(),
    durationMs: 5,
    heartbeatSeconds: 30,
    defaultAgentId: 'main',
    agents,
    sessions: { path: '/tmp', count: 1 },
  };
}

function makeAgent(overrides: Partial<HealthResponse['agents'][0]> = {}): HealthResponse['agents'][0] {
  return {
    agentId: 'main',
    heartbeat: { enabled: true, every: '30s', everyMs: 30000, prompt: '', target: '', ackMaxChars: 100 },
    sessions: { path: '/tmp', count: 1, recent: [{ key: 'sess-1', updatedAt: Date.now(), age: 0 }] },
    ...overrides,
  };
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't-1',
    title: 'Test task',
    description: '',
    status: 'todo',
    priority: 'medium',
    labels: [],
    order: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeRun(overrides: Partial<WorkflowRun> = {}): WorkflowRun {
  return {
    id: 'r-1',
    workflowName: 'test',
    status: 'completed',
    steps: [],
    startedAt: new Date().toISOString(),
    triggeredBy: 'dashboard',
    ...overrides,
  };
}

function makeRepo(overrides: Partial<RepoStatus> = {}): RepoStatus {
  return {
    owner: 'aconte',
    name: 'test-repo',
    local: '/tmp/test',
    watch: [],
    default_branch: 'main',
    status: 'clean',
    uncommittedCount: 0,
    lastCommit: null,
    lastCommitDate: null,
    ...overrides,
  };
}

describe('mission-control', () => {
  describe('buildAgentSummaries', () => {
    it('returns empty array for null health', () => {
      expect(buildAgentSummaries(null)).toEqual([]);
    });

    it('maps agents to summaries with status and lastActivity', () => {
      const now = Date.now();
      const health = makeHealth([
        makeAgent({ agentId: 'main', name: 'main', status: 'online', sessions: { path: '/tmp', count: 1, recent: [{ key: 's', updatedAt: now, age: 0 }] } }),
      ]);
      const summaries = buildAgentSummaries(health);
      expect(summaries).toHaveLength(1);
      expect(summaries[0]).toEqual({ agentId: 'main', name: 'main', status: 'online', lastActivity: now });
    });

    it('defaults name to agentId when name is undefined', () => {
      const health = makeHealth([makeAgent({ agentId: 'worker', name: undefined })]);
      const summaries = buildAgentSummaries(health);
      expect(summaries[0].name).toBe('worker');
    });

    it('defaults status to offline when undefined', () => {
      const health = makeHealth([makeAgent({ agentId: 'x', status: undefined })]);
      const summaries = buildAgentSummaries(health);
      expect(summaries[0].status).toBe('offline');
    });
  });

  describe('buildCounts', () => {
    it('returns all zeros for empty inputs', () => {
      const counts = buildCounts(null, [], [], [], []);
      expect(counts).toEqual({
        quietAgents: 0,
        staleTasks: 0,
        failedRuns: 0,
        inProgressTasks: 0,
        dirtyRepos: 0,
        radarCount: 0,
      });
    });

    it('counts quiet agents (no activity in 60 minutes)', () => {
      const oldTime = Date.now() - 61 * 60 * 1000;
      const health = makeHealth([
        makeAgent({ agentId: 'quiet', sessions: { path: '/tmp', count: 1, recent: [{ key: 's', updatedAt: oldTime, age: 0 }] } }),
        makeAgent({ agentId: 'active', sessions: { path: '/tmp', count: 1, recent: [{ key: 's', updatedAt: Date.now(), age: 0 }] } }),
      ]);
      const counts = buildCounts(health, [], [], [], []);
      expect(counts.quietAgents).toBe(1);
    });

    it('counts stale in_progress tasks (unchanged for 2+ hours)', () => {
      const staleTime = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
      const freshTime = new Date().toISOString();
      const tasks = [
        makeTask({ status: 'in_progress', updatedAt: staleTime }),
        makeTask({ id: 't-2', status: 'in_progress', updatedAt: freshTime }),
        makeTask({ id: 't-3', status: 'todo', updatedAt: staleTime }),
      ];
      const counts = buildCounts(null, tasks, [], [], []);
      expect(counts.staleTasks).toBe(1);
      expect(counts.inProgressTasks).toBe(2);
    });

    it('counts failed runs', () => {
      const runs = [
        makeRun({ status: 'failed' }),
        makeRun({ id: 'r-2', status: 'completed' }),
        makeRun({ id: 'r-3', status: 'failed' }),
      ];
      const counts = buildCounts(null, [], runs, [], []);
      expect(counts.failedRuns).toBe(2);
    });

    it('counts dirty repos', () => {
      const repos = [
        makeRepo({ status: 'dirty' }),
        makeRepo({ name: 'clean-repo', status: 'clean' }),
        makeRepo({ name: 'missing-repo', status: 'missing' }),
      ];
      const counts = buildCounts(null, [], [], repos, []);
      expect(counts.dirtyRepos).toBe(2);
    });

    it('counts radar items', () => {
      const counts = buildCounts(null, [], [], [], [{}, {}, {}]);
      expect(counts.radarCount).toBe(3);
    });
  });

  describe('buildSnapshot', () => {
    it('returns a valid snapshot shape', () => {
      const snapshot = buildSnapshot(null, [], [], [], []);
      expect(snapshot).toHaveProperty('sequence');
      expect(snapshot).toHaveProperty('generatedAt');
      expect(snapshot).toHaveProperty('agents');
      expect(snapshot).toHaveProperty('counts');
      expect(snapshot.agents).toEqual([]);
    });

    it('includes current sequence', () => {
      const seq = getSequence();
      const snapshot = buildSnapshot(null, [], [], [], []);
      expect(snapshot.sequence).toBe(seq);
    });
  });

  describe('sequence', () => {
    it('nextSequence increments monotonically', () => {
      const a = nextSequence();
      const b = nextSequence();
      expect(b).toBe(a + 1);
    });

    it('getSequence returns current without advancing', () => {
      const before = getSequence();
      const same = getSequence();
      expect(same).toBe(before);
    });
  });
});
