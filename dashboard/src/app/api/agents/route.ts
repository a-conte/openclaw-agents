import { NextResponse } from 'next/server';
import { getHealth } from '@/lib/gateway';
import { readConfig } from '@/lib/openclaw';
import { AGENT_EMOJIS } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export async function GET() {
  const health = await getHealth();
  const config = readConfig();

  const configAgents = config?.agents?.list || [];
  const healthAgents = health?.agents || [];

  const agents = healthAgents.map((ha: any) => {
    const ca = configAgents.find((c: any) => c.id === ha.agentId) || {};
    return {
      ...ha,
      model: ca.model || config?.agents?.defaults?.model?.primary,
      emoji: AGENT_EMOJIS[ha.agentId] || '🤖',
      workspace: ca.workspace || config?.agents?.defaults?.workspace,
    };
  });

  // If no health data, fall back to config
  if (agents.length === 0 && configAgents.length > 0) {
    const fallback = configAgents.map((ca: any) => ({
      agentId: ca.id,
      name: ca.name || ca.id,
      model: ca.model || config?.agents?.defaults?.model?.primary,
      emoji: AGENT_EMOJIS[ca.id] || '🤖',
      heartbeat: { enabled: false, every: '', everyMs: 0, prompt: '', target: '', ackMaxChars: 0 },
      sessions: { path: '', count: 0, recent: [] },
    }));
    return NextResponse.json(fallback);
  }

  return NextResponse.json(agents);
}
