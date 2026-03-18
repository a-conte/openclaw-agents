import { NextResponse } from 'next/server';
import { getShortcutsLatestFailed } from '@/lib/jobs-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await getShortcutsLatestFailed());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load latest failed job' },
      { status: 404 },
    );
  }
}
