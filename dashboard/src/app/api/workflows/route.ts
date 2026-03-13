import { NextResponse } from 'next/server';
import { loadWorkflows } from '@/lib/dashboard-data';

export const dynamic = 'force-dynamic';

export async function GET() {
  const workflows = await loadWorkflows();
  return NextResponse.json({ workflows });
}
