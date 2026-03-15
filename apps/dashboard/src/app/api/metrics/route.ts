import { NextResponse } from 'next/server';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';
import { getCached } from '@/lib/server-cache';
import { resolveAgentsRoot } from '@/lib/paths';
import { ALL_AGENT_IDS } from '@/lib/constants';

export const dynamic = 'force-dynamic';

const OPENCLAW_HOME = process.env.OPENCLAW_HOME || `${process.env.HOME}/.openclaw`;
const OPENCLAW_AGENTS = resolveAgentsRoot();

interface AgentMetrics {
  agentId: string;
  sessionCount: number;
  lastActivity: number | null;
  totalMessages: number;
  heartbeatHistory: Array<{ timestamp: number; success: boolean }>;
  inboxCount: number;
}

function countSessionMessages(agentId: string): number {
  const sessionsDir = path.join(OPENCLAW_HOME, 'agents', agentId, 'sessions');
  if (!existsSync(sessionsDir)) return 0;

  let total = 0;
  const files = readdirSync(sessionsDir).filter(f => f.endsWith('.jsonl'));
  for (const file of files.slice(-10)) { // Last 10 sessions for performance
    try {
      const content = readFileSync(path.join(sessionsDir, file), 'utf-8');
      total += content.split('\n').filter(l => l.includes('"type":"message"')).length;
    } catch {}
  }
  return total;
}

function getLastActivity(agentId: string): number | null {
  const sessionsDir = path.join(OPENCLAW_HOME, 'agents', agentId, 'sessions');
  if (!existsSync(sessionsDir)) return null;

  const files = readdirSync(sessionsDir)
    .filter(f => f.endsWith('.jsonl'))
    .map(f => ({ name: f, mtime: statSync(path.join(sessionsDir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  return files.length > 0 ? files[0].mtime : null;
}

function getInboxCount(agentId: string): number {
  const inboxDir = path.join(OPENCLAW_AGENTS, 'shared', 'inbox', agentId);
  if (!existsSync(inboxDir)) return 0;
  return readdirSync(inboxDir).filter(f => f.endsWith('.json')).length;
}

function getSessionCount(agentId: string): number {
  const sessionsDir = path.join(OPENCLAW_HOME, 'agents', agentId, 'sessions');
  if (!existsSync(sessionsDir)) return 0;
  return readdirSync(sessionsDir).filter(f => f.endsWith('.jsonl')).length;
}

function loadMetrics() {
  const agentsDir = path.join(OPENCLAW_AGENTS);
  if (!existsSync(agentsDir)) {
    return { agents: [] as AgentMetrics[], system: { uptime: process.uptime(), memoryUsage: process.memoryUsage(), timestamp: Date.now() } };
  }

  const agentIds = (ALL_AGENT_IDS as readonly string[]).filter((agentId) =>
    existsSync(path.join(agentsDir, agentId))
  );

  const agents: AgentMetrics[] = agentIds.map(agentId => ({
    agentId,
    sessionCount: getSessionCount(agentId),
    lastActivity: getLastActivity(agentId),
    totalMessages: countSessionMessages(agentId),
    heartbeatHistory: [], // Populated from gateway logs when available
    inboxCount: getInboxCount(agentId),
  }));

  // System metrics
  const system = {
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    timestamp: Date.now(),
  };

  return { agents, system };
}

export async function GET() {
  const data = await getCached('metrics', { ttlMs: 15000, staleMs: 30000 }, loadMetrics);
  return NextResponse.json(data);
}
