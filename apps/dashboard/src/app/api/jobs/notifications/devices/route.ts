import { NextResponse } from 'next/server';
import { getNotificationDevices, registerNotificationDevice } from '@/lib/jobs-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await getNotificationDevices());
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    return NextResponse.json(await registerNotificationDevice(payload), { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to register notification device' },
      { status: 400 },
    );
  }
}
