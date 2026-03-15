import { NextResponse } from 'next/server';
import { loadRadarItems } from '@/lib/dashboard-data';

export const dynamic = 'force-dynamic';

export async function GET() {
  const items = await loadRadarItems();

  return NextResponse.json({ items });
}
