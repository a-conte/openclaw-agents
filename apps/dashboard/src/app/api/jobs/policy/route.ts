import { NextResponse } from 'next/server';
import { getJobsPolicy } from '@/lib/jobs-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await getJobsPolicy());
}
