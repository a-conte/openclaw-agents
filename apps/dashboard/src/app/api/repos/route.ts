import { NextResponse } from 'next/server';
import { loadRepos } from '@/lib/dashboard-data';

export const dynamic = 'force-dynamic';

export async function GET() {
  const repos = await loadRepos();

  return NextResponse.json({ repos });
}
