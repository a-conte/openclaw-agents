import { NextResponse } from 'next/server';
import { compressArtifacts } from '@/lib/jobs-store';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    return NextResponse.json(await compressArtifacts(Number(payload?.olderThanDays ?? 7)));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to compress archived artifacts' },
      { status: 400 },
    );
  }
}
