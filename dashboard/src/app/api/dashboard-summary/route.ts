import { NextResponse } from 'next/server';
import { getHealth } from '@/lib/gateway';
import { getAllTasks } from '@/lib/tasks-store';
import { getAllRuns } from '@/lib/workflow-runs-store';
import { loadRepos, loadRadarItems } from '@/lib/dashboard-data';
import { getCached } from '@/lib/server-cache';

export const dynamic = 'force-dynamic';

async function loadDashboardSummary() {
  const [health, tasks, runs, repos, radarItems] = await Promise.all([
    getHealth(),
    Promise.resolve(getAllTasks()),
    Promise.resolve(getAllRuns()),
    loadRepos(),
    loadRadarItems(),
  ]);

  const quietAgents = health?.agents?.filter((agent) => {
    const lastActivity = agent.sessions?.recent?.[0]?.updatedAt;
    return !lastActivity || Date.now() - lastActivity > 60 * 60 * 1000;
  }).length || 0;

  const staleTasks = tasks.filter((task) => task.status === 'in_progress' && Date.now() - new Date(task.updatedAt).getTime() > 2 * 60 * 60 * 1000).length;
  const failedRuns = runs.filter((run) => run.status === 'failed').length;
  const inProgressTasks = tasks.filter((task) => task.status === 'in_progress').length;
  const dirtyRepos = repos.filter((repo) => repo.status !== 'clean').length;
  const radarCount = radarItems.length;

  return {
    health: { ok: !!health?.ok },
    counts: {
      quietAgents,
      staleTasks,
      failedRuns,
      inProgressTasks,
      dirtyRepos,
      radarCount,
    },
  };
}

export async function GET() {
  const data = await getCached('dashboard-summary', { ttlMs: 4000, staleMs: 12000 }, loadDashboardSummary);
  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'private, max-age=4, stale-while-revalidate=12',
    },
  });
}
