import { NextResponse } from 'next/server';
import { getJobArtifacts } from '@/lib/jobs-store';

export async function GET(_: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  try {
    const artifacts = await getJobArtifacts(jobId);
    return NextResponse.json({ artifacts });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load job artifacts' },
      { status: 502 },
    );
  }
}
