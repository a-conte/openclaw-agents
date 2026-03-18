import { NextResponse } from 'next/server';
import { getNotificationPreferences, updateNotificationPreferences } from '@/lib/jobs-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await getNotificationPreferences());
}

export async function PUT(request: Request) {
  try {
    const payload = await request.json();
    return NextResponse.json(await updateNotificationPreferences(payload));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update notification preferences' },
      { status: 400 },
    );
  }
}
