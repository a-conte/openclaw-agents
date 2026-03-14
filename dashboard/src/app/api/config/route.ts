import { NextResponse } from 'next/server';
import { existsSync, readFileSync, readdirSync } from 'fs';
import path from 'path';
import { getCached } from '@/lib/server-cache';
import { ALL_AGENT_IDS, ACTIVE_AGENT_IDS, AGENT_ROLES } from '@/lib/constants';

export const dynamic = 'force-dynamic';

const OPENCLAW_HOME = process.env.OPENCLAW_HOME || `${process.env.HOME}/.openclaw`;
const OPENCLAW_AGENTS = process.env.OPENCLAW_AGENTS || `${process.env.HOME}/openclaw-agents`;

interface AgentConfig {
  agentId: string;
  role: string;
  active: boolean;
  hasHeartbeat: boolean;
  hasTools: boolean;
  hasSoul: boolean;
  hasMemory: boolean;
  tools: string[];
  heartbeatInterval: number | null;
  model: string | null;
  workspace: string | null;
}

function parseToolsFile(agentId: string): string[] {
  const toolsPath = path.join(OPENCLAW_AGENTS, agentId, 'TOOLS.md');
  if (!existsSync(toolsPath)) return [];

  const content = readFileSync(toolsPath, 'utf-8');
  const tools: string[] = [];
  for (const line of content.split('\n')) {
    const match = line.match(/^\s*-\s*\*\*(\w[\w-]*)\*\*/);
    if (match) tools.push(match[1]);
  }
  return tools;
}

function loadConfig() {
  // Read openclaw.json for agent-level config
  const configPath = path.join(OPENCLAW_HOME, 'openclaw.json');
  let openclawConfig: Record<string, unknown> = {};
  if (existsSync(configPath)) {
    try {
      openclawConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
    } catch {}
  }

  const agentsList = (openclawConfig as { agents?: { defaults?: { model?: { primary?: string } }; list?: Array<{ id: string; model?: string; workspace?: string }> } }).agents;
  const defaultModel = agentsList?.defaults?.model?.primary || null;
  const agentConfigs = agentsList?.list || [];

  const agents: AgentConfig[] = (ALL_AGENT_IDS as readonly string[]).map(agentId => {
    const agentDir = path.join(OPENCLAW_AGENTS, agentId);
    const agentConf = agentConfigs.find(a => a.id === agentId);

    return {
      agentId,
      role: AGENT_ROLES[agentId] || 'Unknown',
      active: (ACTIVE_AGENT_IDS as readonly string[]).includes(agentId),
      hasHeartbeat: existsSync(path.join(agentDir, 'HEARTBEAT.md')),
      hasTools: existsSync(path.join(agentDir, 'TOOLS.md')),
      hasSoul: existsSync(path.join(agentDir, 'SOUL.md')),
      hasMemory: existsSync(path.join(agentDir, 'MEMORY.md')),
      tools: parseToolsFile(agentId),
      heartbeatInterval: 1800, // 30 min default
      model: agentConf?.model || defaultModel,
      workspace: agentConf?.workspace || null,
    };
  });

  // Count workflows and pipelines
  const workflowsDir = path.join(OPENCLAW_AGENTS, 'shared', 'workflows');
  const pipelinesDir = path.join(OPENCLAW_AGENTS, 'shared', 'pipelines');
  const workflows = existsSync(workflowsDir) ? readdirSync(workflowsDir).filter(f => f.endsWith('.json')).length : 0;
  const pipelines = existsSync(pipelinesDir) ? readdirSync(pipelinesDir).filter(f => f.endsWith('.json')).length : 0;

  return { agents, workflows, pipelines };
}

export async function GET() {
  const data = await getCached('config', { ttlMs: 30000, staleMs: 60000 }, loadConfig);
  return NextResponse.json(data);
}
