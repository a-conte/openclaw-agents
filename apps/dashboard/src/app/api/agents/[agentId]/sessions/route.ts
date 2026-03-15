import { NextResponse } from 'next/server';
import { readSessions } from '@/lib/openclaw';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  const sessions = readSessions(agentId);
  return NextResponse.json(sessions);
}
