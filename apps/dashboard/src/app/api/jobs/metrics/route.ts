import { NextResponse } from 'next/server';
import { getJobMetrics } from '@/lib/jobs-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await getJobMetrics());
}
