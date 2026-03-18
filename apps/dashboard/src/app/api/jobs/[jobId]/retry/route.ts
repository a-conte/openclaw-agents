import { NextResponse } from 'next/server';
import { getJob, retryJob } from '@/lib/jobs-store';

export const dynamic = 'force-dynamic';

export async function POST(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = await getJob(jobId);

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const result = await retryJob(jobId);
  return NextResponse.json(result, { status: 201 });
}
