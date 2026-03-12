import { NextRequest, NextResponse } from 'next/server';
import { getRun } from '@/lib/workflow-runs-store';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const run = getRun(runId);

  if (!run) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  }

  return NextResponse.json({ run });
}
