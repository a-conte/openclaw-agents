import { NextResponse } from 'next/server';
import { retryShortcutLatestFailed } from '@/lib/jobs-store';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let data: any = {};
  try {
    data = await request.json();
  } catch {
    data = {};
  }

  try {
    return NextResponse.json(await retryShortcutLatestFailed({
      mode: typeof data.mode === 'string' ? data.mode : undefined,
      resumeFromStepId: typeof data.resumeFromStepId === 'string' ? data.resumeFromStepId : undefined,
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to retry latest failed job';
    const status = message.includes('no failed jobs found') ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
