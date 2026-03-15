import { NextResponse } from 'next/server';
import { getHealth } from '@/lib/gateway';
import { getAllTasks } from '@/lib/tasks-store';
import { getAllRuns } from '@/lib/workflow-runs-store';
import { loadRepos, loadRadarItems } from '@/lib/dashboard-data';
import { buildSnapshot } from '@/lib/mission-control';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [health, tasks, runs, repos, radarItems] = await Promise.all([
    getHealth(),
    getAllTasks(),
    getAllRuns(),
    loadRepos(),
    loadRadarItems(),
  ]);

  const snapshot = buildSnapshot(health, tasks, runs, repos, radarItems);

  return NextResponse.json(snapshot, {
    headers: {
      'Cache-Control': 'private, max-age=4, stale-while-revalidate=12',
    },
  });
}
