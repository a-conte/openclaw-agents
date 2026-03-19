import { NextResponse } from 'next/server';
import { getJobLiveOutput } from '@/lib/jobs-store';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const url = new URL(request.url);
  const rawLines = Number(url.searchParams.get('lines') || '120');
  const lines = Number.isFinite(rawLines) ? Math.max(20, Math.min(400, rawLines)) : 120;

  try {
    const payload = await getJobLiveOutput(jobId, lines);
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to load live job output' },
      { status: 500 },
    );
  }
}
