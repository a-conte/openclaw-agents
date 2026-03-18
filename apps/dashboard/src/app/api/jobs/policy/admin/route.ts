import { NextResponse } from 'next/server';
import { getJobsPolicyAdmin } from '@/lib/jobs-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await getJobsPolicyAdmin());
}
