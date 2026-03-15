import { NextResponse } from 'next/server';
import { existsSync, readdirSync } from 'fs';
import { getHealth } from '@/lib/gateway';
import { readConfig } from '@/lib/openclaw';
import { AGENT_EMOJIS, isActiveAgent } from '@/lib/constants';
import { resolveRepoRoot } from '@/lib/paths';

export const dynamic = 'force-dynamic';

const EXCLUDED_DIRS = ['apps', 'scripts', 'shared', 'node_modules'];

function discoverAgentsFromDir(): string[] {
  const repoRoot = resolveRepoRoot();
  if (!existsSync(repoRoot)) return [];
  try {
    return readdirSync(repoRoot, { withFileTypes: true })
      .filter(d => d.isDirectory() && !d.name.startsWith('.') && !EXCLUDED_DIRS.includes(d.name))
      .map(d => d.name)
      .filter((agentId) => isActiveAgent(agentId));
  } catch {
    return [];
  }
}

export async function GET() {
  const health = await getHealth();
  const config = readConfig();

  const configAgents = (config?.agents?.list || []).filter((agent: any) => isActiveAgent(agent.id));
  const healthAgents = (health?.agents || []).filter((agent: any) => isActiveAgent(agent.agentId));

  // Build agent list from health data, enriched with config
  const agents = healthAgents.map((ha: any) => {
    const ca = configAgents.find((c: any) => c.id === ha.agentId) || {};
    return {
      ...ha,
      model: ca.model || config?.agents?.defaults?.model?.primary,
      emoji: AGENT_EMOJIS[ha.agentId] || '🤖',
      workspace: ca.workspace || config?.agents?.defaults?.workspace,
    };
  });

  if (agents.length > 0) {
    return NextResponse.json(agents);
  }

  // Fall back to config if gateway is unavailable
  if (configAgents.length > 0) {
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

  // Last resort: discover agents from the repo directory structure
  const discoveredIds = discoverAgentsFromDir();
  if (discoveredIds.length > 0) {
    const discovered = discoveredIds.map((id) => ({
      agentId: id,
      name: id,
      model: 'unknown',
      emoji: AGENT_EMOJIS[id] || '🤖',
      heartbeat: { enabled: false, every: '', everyMs: 0, prompt: '', target: '', ackMaxChars: 0 },
      sessions: { path: '', count: 0, recent: [] },
    }));
    return NextResponse.json(discovered);
  }

  return NextResponse.json([]);
}
