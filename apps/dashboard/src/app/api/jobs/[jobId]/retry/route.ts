import { NextResponse } from 'next/server';
import { getJob, resumeJob, retryJob } from '@/lib/jobs-store';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = await getJob(jobId);

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }
  let payload: any = {};
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }
  const mode = payload?.mode;
  const isResumeMode = mode === 'resume_failed' || mode === 'resume_from' || mode === 'rerun_all';
  const result =
    isResumeMode
      ? await resumeJob(jobId, {
          mode,
          resumeFromStepId: typeof payload.resumeFromStepId === 'string' ? payload.resumeFromStepId : undefined,
        })
      : await retryJob(jobId);
  return NextResponse.json(result, { status: 201 });
}
