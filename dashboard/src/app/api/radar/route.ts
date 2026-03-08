import { NextResponse } from 'next/server';
import { existsSync, readdirSync, readFileSync } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const OPENCLAW_AGENTS = process.env.OPENCLAW_AGENTS || `${process.env.HOME}/openclaw-agents`;

export async function GET() {
  const items: any[] = [];
  const inboxBase = path.join(OPENCLAW_AGENTS, 'shared', 'inbox');

  if (!existsSync(inboxBase)) {
    return NextResponse.json({ items: [] });
  }

  const agentDirs = readdirSync(inboxBase, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  for (const agentId of agentDirs) {
    const inboxDir = path.join(inboxBase, agentId);
    try {
      const files = readdirSync(inboxDir).filter(f => f.endsWith('.json'));
      for (const file of files) {
        try {
          const content = JSON.parse(readFileSync(path.join(inboxDir, file), 'utf-8'));
          const type = agentId === 'security'
            ? 'alert'
            : (agentId === 'research' || agentId === 'ai-research')
              ? 'watch'
              : 'opportunity';
          const signal = content.priority === 'urgent' ? 'high'
            : content.priority === 'high' ? 'high'
            : content.priority === 'low' ? 'low'
            : 'medium';

          items.push({
            id: file.replace('.json', ''),
            type,
            title: content.subject || content.title || file.replace('.json', ''),
            signal,
            source: `${agentId} agent`,
            body: content.body || content.message || '',
            timestamp: content.timestamp || content.createdAt || new Date().toISOString(),
          });
        } catch {}
      }
    } catch {}
  }

  items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return NextResponse.json({ items });
}
