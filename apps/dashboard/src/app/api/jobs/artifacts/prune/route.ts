import { NextResponse } from 'next/server';
import { pruneArtifacts } from '@/lib/jobs-store';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => ({}));
    const olderThanDays = Number(payload?.olderThanDays ?? 30);
    return NextResponse.json(await pruneArtifacts(olderThanDays));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to prune artifacts' },
      { status: 400 },
    );
  }
}
