import type {
  MissionControlCountsContract,
  MissionControlSnapshotContract,
  AgentSummaryContract,
} from '@openclaw/contracts';
import type { HealthResponse, Task, WorkflowRun, RepoStatus } from './types';

const QUIET_THRESHOLD_MS = 60 * 60 * 1000;       // 60 minutes
const STALE_TASK_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours

let currentSequence = 0;

export function getSequence(): number {
  return currentSequence;
}

export function nextSequence(): number {
  return ++currentSequence;
}

export function buildAgentSummaries(health: HealthResponse | null): AgentSummaryContract[] {
  if (!health?.agents) return [];
  return health.agents.map((agent) => {
    const lastActivity = agent.sessions?.recent?.[0]?.updatedAt;
    return {
      agentId: agent.agentId,
      name: agent.name ?? agent.agentId,
      status: agent.status ?? 'offline',
      ...(lastActivity != null ? { lastActivity } : {}),
    };
  });
}

export function buildCounts(
  health: HealthResponse | null,
  tasks: Task[],
  runs: WorkflowRun[],
  repos: RepoStatus[],
  radarItems: unknown[],
): MissionControlCountsContract {
  const now = Date.now();

  const quietAgents = health?.agents?.filter((agent) => {
    const lastActivity = agent.sessions?.recent?.[0]?.updatedAt;
    return !lastActivity || now - lastActivity > QUIET_THRESHOLD_MS;
  }).length ?? 0;

  const staleTasks = tasks.filter(
    (task) => task.status === 'in_progress' && now - new Date(task.updatedAt).getTime() > STALE_TASK_THRESHOLD_MS,
  ).length;

  const failedRuns = runs.filter((run) => run.status === 'failed').length;
  const inProgressTasks = tasks.filter((task) => task.status === 'in_progress').length;
  const dirtyRepos = repos.filter((repo) => repo.status !== 'clean').length;
  const radarCount = radarItems.length;

  return { quietAgents, staleTasks, failedRuns, inProgressTasks, dirtyRepos, radarCount };
}

export function buildSnapshot(
  health: HealthResponse | null,
  tasks: Task[],
  runs: WorkflowRun[],
  repos: RepoStatus[],
  radarItems: unknown[],
): MissionControlSnapshotContract {
  return {
    sequence: currentSequence,
    generatedAt: new Date().toISOString(),
    agents: buildAgentSummaries(health),
    counts: buildCounts(health, tasks, runs, repos, radarItems),
  };
}
