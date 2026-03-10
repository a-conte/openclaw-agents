import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import type { RepoStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

function resolveAgentsRoot(): string {
  if (process.env.OPENCLAW_AGENTS) return process.env.OPENCLAW_AGENTS;
  const fromCwd = path.resolve(process.cwd(), '..');
  if (existsSync(path.join(fromCwd, 'main')) || existsSync(path.join(fromCwd, 'dashboard'))) {
    return fromCwd;
  }
  return `${process.env.HOME}/openclaw-agents`;
}

function expandHome(p: string): string {
  if (p.startsWith('~/')) {
    return path.join(process.env.HOME || '', p.slice(2));
  }
  return p;
}

export async function GET() {
  const agentsRoot = resolveAgentsRoot();
  const reposPath = path.join(agentsRoot, 'shared', 'repos.json');

  if (!existsSync(reposPath)) {
    return NextResponse.json({ repos: [] });
  }

  let reposConfig: { repos: any[] };
  try {
    reposConfig = JSON.parse(readFileSync(reposPath, 'utf-8'));
  } catch {
    return NextResponse.json({ repos: [] });
  }

  const repos: RepoStatus[] = reposConfig.repos.map(repo => {
    const localPath = expandHome(repo.local);
    const result: RepoStatus = {
      owner: repo.owner,
      name: repo.name,
      local: repo.local,
      watch: repo.watch || [],
      default_branch: repo.default_branch || 'main',
      status: 'missing',
      uncommittedCount: 0,
      lastCommit: null,
      lastCommitDate: null,
    };

    if (!existsSync(localPath)) return result;

    try {
      const porcelain = execSync(`git -C "${localPath}" status --porcelain`, {
        encoding: 'utf-8',
        timeout: 5000,
      }).trim();

      const lines = porcelain ? porcelain.split('\n') : [];
      result.uncommittedCount = lines.length;
      result.status = lines.length === 0 ? 'clean' : 'dirty';
    } catch {
      result.status = 'missing';
    }

    try {
      const log = execSync(
        `git -C "${localPath}" log --oneline --format="%h %s|||%ci" -1`,
        { encoding: 'utf-8', timeout: 5000 }
      ).trim();

      if (log) {
        const [commitInfo, date] = log.split('|||');
        result.lastCommit = commitInfo;
        result.lastCommitDate = date || null;
      }
    } catch {
      // ignore
    }

    return result;
  });

  return NextResponse.json({ repos });
}
