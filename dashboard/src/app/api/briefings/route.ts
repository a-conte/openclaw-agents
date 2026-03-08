import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  const OPENCLAW_HOME = process.env.OPENCLAW_HOME || `${process.env.HOME}/.openclaw`;
  const cronPath = path.join(OPENCLAW_HOME, 'cron', 'jobs.json');

  let cronJobs: any[] = [];
  if (existsSync(cronPath)) {
    try {
      const data = JSON.parse(readFileSync(cronPath, 'utf-8'));
      cronJobs = data.jobs || [];
    } catch {}
  }

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  const briefings = cronJobs
    .filter((job: any) => job.enabled !== false)
    .map((job: any) => {
      // Parse schedule to extract time
      const parts = (job.schedule || '').split(' ');
      const minute = parseInt(parts[0]) || 0;
      const hour = parseInt(parts[1]) || 0;
      const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

      // Determine status
      let status: 'delivered' | 'pending' | 'scheduled' = 'scheduled';
      if (job.lastRun) {
        const lastRunDate = new Date(job.lastRun);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (lastRunDate >= today) {
          status = 'delivered';
        } else if (currentHour > hour || (currentHour === hour && currentMinute >= minute)) {
          status = 'pending';
        }
      } else if (currentHour > hour || (currentHour === hour && currentMinute >= minute)) {
        status = 'pending';
      }

      return {
        id: job.id || job.name,
        name: job.name || job.id,
        schedule: job.schedule,
        agentId: job.agentId || 'main',
        time: timeStr,
        status,
      };
    })
    .sort((a: any, b: any) => a.time.localeCompare(b.time));

  return NextResponse.json({ briefings });
}
