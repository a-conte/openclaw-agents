import { NextResponse } from 'next/server';
import { loadBriefings } from '@/lib/dashboard-data';

export const dynamic = 'force-dynamic';

export async function GET() {
  const briefings = await loadBriefings();

  return NextResponse.json({ briefings });
}
