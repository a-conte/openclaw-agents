import { NextResponse } from 'next/server';
import { getHealth } from '@/lib/gateway';
import { getAllTasks } from '@/lib/tasks-store';
import { getAllRuns } from '@/lib/workflow-runs-store';
import { loadBriefings, loadRadarItems, loadRepos, loadWorkflows } from '@/lib/dashboard-data';
import { getCached } from '@/lib/server-cache';

export const dynamic = 'force-dynamic';

async function loadCommandOverview() {
  const [health, tasks, runs, workflows, repos, briefings, radarItems] = await Promise.all([
    getHealth(),
    Promise.resolve(getAllTasks()),
    Promise.resolve(getAllRuns()),
    loadWorkflows(),
    loadRepos(),
    loadBriefings(),
    loadRadarItems(),
  ]);

  return {
    health,
    agents: health?.agents || [],
    tasks,
    runs,
    workflows,
    repos,
    briefings,
    radarItems,
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
