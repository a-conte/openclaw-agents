import { NextResponse } from 'next/server';
import { getAllJobs, createJob, isKnownAgent } from '@/lib/jobs-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(getAllJobs());
}

export async function POST(request: Request) {
  let data: any;
  try {
    data = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof data.prompt !== 'string' || data.prompt.trim().length === 0) {
    return NextResponse.json({ error: 'prompt must be a non-empty string' }, { status: 400 });
  }
  if (typeof data.targetAgent !== 'string' || !isKnownAgent(data.targetAgent)) {
    return NextResponse.json(
      { error: 'targetAgent must be one of: main, mail, docs, research, ai-research, dev, security' },
      { status: 400 },
    );
  }
  if (data.priority !== undefined && !['normal', 'high', 'urgent'].includes(data.priority)) {
    return NextResponse.json({ error: 'priority must be one of: normal, high, urgent' }, { status: 400 });
  }

  const job = createJob(data.prompt.trim(), data.targetAgent, data.priority);
  return NextResponse.json(job, { status: 201 });
}
