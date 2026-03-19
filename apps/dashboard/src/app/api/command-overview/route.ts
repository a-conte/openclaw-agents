import { NextResponse } from 'next/server';
import { getHealth } from '@/lib/gateway';
import { getAllTasks } from '@/lib/tasks-store';
import { getAllRuns } from '@/lib/workflow-runs-store';
import { buildSystemRecommendations, loadBriefings, loadRadarItems, loadRepos, loadWorkflows } from '@/lib/dashboard-data';
import { isActiveAgent } from '@/lib/constants';
import { getCached } from '@/lib/server-cache';

export const dynamic = 'force-dynamic';

async function capture<T>(label: string, loader: () => Promise<T>): Promise<{ value: T | null; issue: string | null }> {
  try {
    return { value: await loader(), issue: null };
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unknown error';
    return { value: null, issue: `${label}: ${detail}` };
  }
}

async function loadCommandOverview() {
  const [healthResult, tasksResult, runsResult, workflowsResult, reposResult, briefingsResult, radarItemsResult] = await Promise.all([
    capture('gateway health', getHealth),
    capture('tasks', getAllTasks),
    capture('workflow runs', getAllRuns),
    capture('workflows', loadWorkflows),
    capture('repos', loadRepos),
    capture('briefings', loadBriefings),
    capture('radar', loadRadarItems),
  ]);

  const health = healthResult.value;
  const tasks = tasksResult.value || [];
  const runs = runsResult.value || [];
  const workflows = workflowsResult.value || [];
  const repos = reposResult.value || [];
  const briefings = briefingsResult.value || [];
  const radarItems = radarItemsResult.value || [];
  const legacyIssues = [
    healthResult.issue,
    tasksResult.issue,
    runsResult.issue,
    workflowsResult.issue,
    reposResult.issue,
    briefingsResult.issue,
    radarItemsResult.issue,
  ].filter((item): item is string => Boolean(item));

  const activeAgents = (health?.agents || []).filter((agent) => isActiveAgent(agent.agentId));

  const systemRecommendations = buildSystemRecommendations({
    healthOk: Boolean(health?.ok),
    agents: activeAgents,
    tasks,
    runs,
    repos,
    briefings,
    radarItems,
  });

  return {
    health,
    agents: activeAgents,
    tasks,
    runs,
    workflows,
    repos,
    briefings,
    radarItems,
    systemRecommendations,
    legacyOverviewHealthy: legacyIssues.length === 0,
    legacyIssues,
  };
}

export async function GET() {
  const data = await getCached('command-overview', { ttlMs: 4000, staleMs: 12000 }, loadCommandOverview);
  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'private, max-age=4, stale-while-revalidate=12',
    },
  });
}
