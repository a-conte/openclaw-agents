import { NextResponse } from 'next/server';
import { getNotificationEvents } from '@/lib/jobs-store';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get('limit') || '25');
  return NextResponse.json(await getNotificationEvents(Number.isFinite(limit) ? limit : 25));
}
