import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { getHealth } from '@/lib/gateway';

export const dynamic = 'force-dynamic';

export async function GET() {
  const OPENCLAW_HOME = process.env.OPENCLAW_HOME || `${process.env.HOME}/.openclaw`;

  // Read cron jobs
  const cronPath = path.join(OPENCLAW_HOME, 'cron', 'jobs.json');
  let cronJobs: any[] = [];
  if (existsSync(cronPath)) {
    try {
      const data = JSON.parse(readFileSync(cronPath, 'utf-8'));
      cronJobs = data.jobs || [];
    } catch {}
  }

  // Get heartbeat info from health
  const health = await getHealth();
  const heartbeats = (health?.agents || []).map((a: any) => ({
    agentId: a.agentId,
    heartbeat: a.heartbeat,
  }));

  return NextResponse.json({ cronJobs, heartbeats });
}
