import { NextResponse } from 'next/server';
import { existsSync, readFileSync, readdirSync } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const OPENCLAW_AGENTS = process.env.OPENCLAW_AGENTS || `${process.env.HOME}/openclaw-agents`;

interface MemoryCategory {
  agentId: string;
  category: string;
  entries: string[];
}

function parseMemoryFile(content: string, agentId: string): MemoryCategory[] {
  const categories: MemoryCategory[] = [];
  let currentCategory = '';
  let currentEntries: string[] = [];

  for (const line of content.split('\n')) {
    const h2Match = line.match(/^##\s+(.+)$/);
    const h3Match = line.match(/^###\s+(.+)$/);
    const bulletMatch = line.match(/^[-*]\s+(.+)$/);

    if (h2Match || h3Match) {
      if (currentCategory && currentEntries.length > 0) {
        categories.push({ agentId, category: currentCategory, entries: [...currentEntries] });
      }
      currentCategory = (h2Match || h3Match)![1].trim();
      currentEntries = [];
    } else if (bulletMatch && currentCategory) {
      currentEntries.push(bulletMatch[1].trim());
    }
  }

  if (currentCategory && currentEntries.length > 0) {
    categories.push({ agentId, category: currentCategory, entries: currentEntries });
  }

  return categories;
}

export async function GET() {
  const categories: MemoryCategory[] = [];

  if (!existsSync(OPENCLAW_AGENTS)) {
    return NextResponse.json({ categories: [] });
  }

  const agentDirs = readdirSync(OPENCLAW_AGENTS, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('.') && !['dashboard', 'scripts', 'shared'].includes(d.name))
    .map(d => d.name);

  for (const agentId of agentDirs) {
    const memoryPath = path.join(OPENCLAW_AGENTS, agentId, 'MEMORY.md');
    if (existsSync(memoryPath)) {
      try {
        const content = readFileSync(memoryPath, 'utf-8');
        categories.push(...parseMemoryFile(content, agentId));
      } catch {}
    }
  }

  return NextResponse.json({ categories });
}
