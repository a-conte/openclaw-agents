import { NextResponse } from 'next/server';
import { clearJobs } from '@/lib/jobs-store';

export const dynamic = 'force-dynamic';

export async function POST() {
  return NextResponse.json(await clearJobs());
}
