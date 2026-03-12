import { NextResponse } from 'next/server';
import { getAllRuns } from '@/lib/workflow-runs-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const runs = getAllRuns()
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    .slice(0, 50);

  return NextResponse.json({ runs });
}
