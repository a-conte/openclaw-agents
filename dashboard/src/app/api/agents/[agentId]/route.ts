import { NextResponse } from 'next/server';
import { readAgentFiles } from '@/lib/openclaw';
import { getHealth } from '@/lib/gateway';
import { AGENT_EMOJIS } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  const files = readAgentFiles(agentId);
  const health = await getHealth();
  const agentHealth = health?.agents?.find((a: any) => a.agentId === agentId);

  return NextResponse.json({
    agentId,
    emoji: AGENT_EMOJIS[agentId] || '🤖',
    files,
    health: agentHealth || null,
  });
}
