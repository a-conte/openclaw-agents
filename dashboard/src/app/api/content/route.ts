import { NextResponse } from 'next/server';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

const OPENCLAW_AGENTS = process.env.OPENCLAW_AGENTS || `${process.env.HOME}/openclaw-agents`;
const EXCLUDED_DIRS = ['dashboard', 'scripts', 'shared', 'node_modules', '.git', 'research'];

function inferCategory(filePath: string, content: string): string {
  const lower = filePath.toLowerCase();
  if (lower.includes('soul') || lower.includes('identity')) return 'Identity';
  if (lower.includes('tool')) return 'Technical';
  if (lower.includes('memory')) return 'Memory';
  if (lower.includes('heartbeat')) return 'Operations';
  if (lower.includes('readme') || lower.includes('setup')) return 'Documentation';
  if (lower.includes('research') || lower.includes('report')) return 'Research';
  if (lower.includes('security') || lower.includes('audit')) return 'Security';
  if (lower.includes('agent')) return 'Strategy';
  return 'General';
}

function extractTitle(content: string, filename: string): string {
  const firstHeading = content.match(/^#\s+(.+)$/m);
  if (firstHeading) return firstHeading[1].trim();
  return filename.replace(/\.md$/, '').replace(/[-_]/g, ' ');
}

export async function GET() {
  const documents: any[] = [];

  if (!existsSync(OPENCLAW_AGENTS)) {
    return NextResponse.json({ documents: [] });
  }

  const agentDirs = readdirSync(OPENCLAW_AGENTS, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('.') && !EXCLUDED_DIRS.includes(d.name))
    .map(d => d.name);

  for (const agentId of agentDirs) {
    const agentDir = path.join(OPENCLAW_AGENTS, agentId);
    scanDir(agentDir, agentId, documents);
  }

  // Also scan shared directory
  const sharedDir = path.join(OPENCLAW_AGENTS, 'shared');
  if (existsSync(sharedDir)) {
    scanDir(sharedDir, 'shared', documents);
  }

  documents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return NextResponse.json({ documents });
}

function scanDir(dir: string, agentId: string, documents: any[], depth = 0) {
  if (depth > 3) return;

  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        scanDir(fullPath, agentId, documents, depth + 1);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        try {
          const stat = statSync(fullPath);
          const content = readFileSync(fullPath, 'utf-8').slice(0, 500);
          const relativePath = path.relative(process.env.OPENCLAW_AGENTS || '', fullPath);
          documents.push({
            id: Buffer.from(relativePath).toString('base64url'),
            title: extractTitle(content, entry.name),
            category: inferCategory(fullPath, content),
            date: stat.mtime.toISOString(),
            agentId,
            path: relativePath,
            size: stat.size,
          });
        } catch {}
      }
    }
  } catch {}
}
