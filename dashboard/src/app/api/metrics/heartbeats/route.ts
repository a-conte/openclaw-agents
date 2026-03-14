import { NextResponse } from 'next/server';
import { existsSync, readFileSync, readdirSync } from 'fs';
import path from 'path';
import { getCached } from '@/lib/server-cache';

export const dynamic = 'force-dynamic';

const OPENCLAW_AGENTS = process.env.OPENCLAW_AGENTS || `${process.env.HOME}/openclaw-agents`;

interface HeartbeatEntry {
  timestamp: string;
  type: string;
  agent: string;
  inbox_processed: number;
  duration_ms: number;
  details?: { steps_ok?: string[]; steps_failed?: string[] };
}

interface AgentHeartbeatStatus {
  agentId: string;
  lastHeartbeat: string | null;
  lastDurationMs: number | null;
  heartbeatCount24h: number;
  avgDurationMs: number | null;
  inboxCount: number;
  recentHeartbeats: Array<{ timestamp: string; duration_ms: number; inbox_processed: number }>;
}

function parseActivityLog(): HeartbeatEntry[] {
  const logPath = path.join(OPENCLAW_AGENTS, 'shared', 'logs', 'activity.jsonl');
  if (!existsSync(logPath)) return [];

  const content = readFileSync(logPath, 'utf-8');
  const entries: HeartbeatEntry[] = [];

  for (const line of content.split('\n')) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      if (entry.type === 'heartbeat') {
        entries.push(entry);
      }
    } catch {}
  }

  return entries;
}

function getInboxCount(agentId: string): number {
  const inboxDir = path.join(OPENCLAW_AGENTS, 'shared', 'inbox', agentId);
  if (!existsSync(inboxDir)) return 0;
  return readdirSync(inboxDir).filter(f => f.endsWith('.json')).length;
}

function loadHeartbeats() {
  const entries = parseActivityLog();
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  const agentIds = ['main', 'mail', 'docs', 'research', 'ai-research', 'dev', 'security'];
  const result: AgentHeartbeatStatus[] = agentIds.map(agentId => {
    const agentEntries = entries
      .filter(e => e.agent === agentId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const recent24h = agentEntries.filter(e => new Date(e.timestamp).getTime() > oneDayAgo);
    const durations = recent24h.map(e => e.duration_ms).filter(d => d > 0);

    return {
      agentId,
      lastHeartbeat: agentEntries[0]?.timestamp || null,
      lastDurationMs: agentEntries[0]?.duration_ms || null,
      heartbeatCount24h: recent24h.length,
      avgDurationMs: durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null,
      inboxCount: getInboxCount(agentId),
      recentHeartbeats: agentEntries.slice(0, 10).map(e => ({
        timestamp: e.timestamp,
        duration_ms: e.duration_ms,
        inbox_processed: e.inbox_processed,
      })),
    };
  });

  return { agents: result, totalHeartbeats: entries.length };
}

export async function GET() {
  const data = await getCached('heartbeats', { ttlMs: 15000, staleMs: 30000 }, loadHeartbeats);
  return NextResponse.json(data);
}
