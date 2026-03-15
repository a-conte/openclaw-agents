import { NextResponse } from 'next/server';
import { readSessionMessages } from '@/lib/openclaw';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ agentId: string; sessionId: string }> }
) {
  const { agentId, sessionId } = await params;
  const url = new URL(request.url);
  const offset = parseInt(url.searchParams.get('offset') || '0');
  const limit = parseInt(url.searchParams.get('limit') || '50');

  const result = readSessionMessages(agentId, sessionId, offset, limit);
  return NextResponse.json(result);
}
