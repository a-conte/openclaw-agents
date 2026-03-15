import { NextResponse } from 'next/server';
import { existsSync, readFileSync, readdirSync } from 'fs';
import path from 'path';
import { getCached } from '@/lib/server-cache';
import { ALL_AGENT_IDS } from '@/lib/constants';
import { resolveAgentsRoot } from '@/lib/paths';

export const dynamic = 'force-dynamic';

const OPENCLAW_AGENTS = resolveAgentsRoot();

interface InboxMessage {
  filename: string;
  agentId: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  priority: string;
  timestamp: string;
  status: string;
  pipeline?: string;
  workflow?: string;
}

function loadInbox() {
  const messages: InboxMessage[] = [];
  const byAgent: Record<string, InboxMessage[]> = {};
  for (const agentId of ALL_AGENT_IDS) {
    byAgent[agentId] = [];
  }

  const priorityOrder: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
  const compareFn = (a: InboxMessage, b: InboxMessage) => {
    const pa = priorityOrder[a.priority] ?? 2;
    const pb = priorityOrder[b.priority] ?? 2;
    if (pa !== pb) return pa - pb;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  };

  for (const agentId of ALL_AGENT_IDS) {
    const inboxDir = path.join(OPENCLAW_AGENTS, 'shared', 'inbox', agentId);
    if (!existsSync(inboxDir)) continue;

    const files = readdirSync(inboxDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        const content = JSON.parse(readFileSync(path.join(inboxDir, file), 'utf-8'));
        const msg: InboxMessage = {
          filename: file,
          agentId,
          from: content.from || 'unknown',
          to: content.to || agentId,
          subject: content.subject || '(no subject)',
          body: content.body || '',
          priority: content.priority || 'normal',
          timestamp: content.timestamp || '',
          status: content.status || 'unread',
          pipeline: content.pipeline,
          workflow: content.workflow,
        };
        messages.push(msg);
        byAgent[agentId].push(msg);
      } catch {}
    }
  }

  messages.sort(compareFn);
  for (const agentId of ALL_AGENT_IDS) {
    byAgent[agentId].sort(compareFn);
  }

  return { messages, byAgent, totalCount: messages.length };
}

export async function GET() {
  const data = await getCached('inbox', { ttlMs: 10000, staleMs: 20000 }, loadInbox);
  return NextResponse.json(data);
}
