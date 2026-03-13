import { execSync } from 'child_process';
import { existsSync, readFileSync, readdirSync } from 'fs';
import path from 'path';
import type { Briefing, RadarItem, RepoStatus, Workflow } from './types';
import { getCached } from './server-cache';

export function resolveAgentsRoot(): string {
  if (process.env.OPENCLAW_AGENTS) return process.env.OPENCLAW_AGENTS;
  const fromCwd = path.resolve(process.cwd(), '..');
  if (existsSync(path.join(fromCwd, 'main')) || existsSync(path.join(fromCwd, 'dashboard'))) {
    return fromCwd;
  }
  return `${process.env.HOME}/openclaw-agents`;
}

export function expandHome(p: string): string {
  if (p.startsWith('~/')) return path.join(process.env.HOME || '', p.slice(2));
  return p;
}

function readJsonFiles(dir: string): Record<string, unknown>[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      try {
        return JSON.parse(readFileSync(path.join(dir, f), 'utf-8'));
      } catch {
        return null;
      }
    })
    .filter(Boolean) as Record<string, unknown>[];
}

async function loadReposUncached(): Promise<RepoStatus[]> {
  const agentsRoot = resolveAgentsRoot();
  const reposPath = path.join(agentsRoot, 'shared', 'repos.json');
  if (!existsSync(reposPath)) return [];

  let reposConfig: { repos: Array<Record<string, any>> };
  try {
    reposConfig = JSON.parse(readFileSync(reposPath, 'utf-8'));
  } catch {
    return [];
  }

  return reposConfig.repos.map((repo) => {
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
      const porcelain = execSync(`git -C "${localPath}" status --porcelain`, { encoding: 'utf-8', timeout: 5000 }).trim();
      const lines = porcelain ? porcelain.split('\n') : [];
      result.uncommittedCount = lines.length;
      result.status = lines.length === 0 ? 'clean' : 'dirty';
    } catch {
      result.status = 'missing';
    }

    try {
      const log = execSync(`git -C "${localPath}" log --oneline --format="%h %s|||%ci" -1`, { encoding: 'utf-8', timeout: 5000 }).trim();
      if (log) {
        const [commitInfo, date] = log.split('|||');
        result.lastCommit = commitInfo;
        result.lastCommitDate = date || null;
      }
    } catch {
      // ignore log errors
    }

    return result;
  });
}

async function loadWorkflowsUncached(): Promise<Workflow[]> {
  const agentsRoot = resolveAgentsRoot();
  const sharedDir = path.join(agentsRoot, 'shared');
  const workflowFiles = readJsonFiles(path.join(sharedDir, 'workflows'));
  const workflows: Workflow[] = workflowFiles.map((w) => ({
    name: w.name as string,
    description: (w.description as string) || '',
    trigger: (w.trigger as Workflow['trigger']) || 'on-demand',
    schedule: w.schedule as string | undefined,
    keyword: w.keyword as string | undefined,
    approvalRequired: (w.approvalRequired as boolean) || false,
    approvalReason: w.approvalReason as string | undefined,
    steps: (w.steps as Workflow['steps']) || [],
    source: 'workflow',
  }));

  const pipelineFiles = readJsonFiles(path.join(sharedDir, 'pipelines'));
  const pipelines: Workflow[] = pipelineFiles.map((p) => ({
    name: p.name as string,
    description: (p.description as string) || '',
    trigger: (p.trigger as Workflow['trigger']) || 'event',
    schedule: p.schedule as string | undefined,
    keyword: undefined,
    approvalRequired: false,
    steps: (((p.steps as any[]) || []).map((s) => ({ agent: s.agent, action: s.action, passOutput: s.passOutput ?? false }))),
    source: 'pipeline',
  }));

  return [...workflows, ...pipelines];
}

async function loadBriefingsUncached(): Promise<Briefing[]> {
  const openclawHome = process.env.OPENCLAW_HOME || `${process.env.HOME}/.openclaw`;
  const cronPath = path.join(openclawHome, 'cron', 'jobs.json');
  let cronJobs: any[] = [];

  if (existsSync(cronPath)) {
    try {
      const data = JSON.parse(readFileSync(cronPath, 'utf-8'));
      cronJobs = data.jobs || [];
    } catch {
      cronJobs = [];
    }
  }

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  return cronJobs
    .filter((job: any) => job.enabled !== false)
    .map((job: any) => {
      const parts = (job.schedule || '').split(' ');
      const minute = parseInt(parts[0]) || 0;
      const hour = parseInt(parts[1]) || 0;
      const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

      let status: Briefing['status'] = 'scheduled';
      if (job.lastRun) {
        const lastRunDate = new Date(job.lastRun);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (lastRunDate >= today) status = 'delivered';
        else if (currentHour > hour || (currentHour === hour && currentMinute >= minute)) status = 'pending';
      } else if (currentHour > hour || (currentHour === hour && currentMinute >= minute)) {
        status = 'pending';
      }

      return {
        id: job.id || job.name,
        name: job.name || job.id,
        schedule: job.schedule,
        agentId: job.agentId || 'main',
        time: timeStr,
        status,
      };
    })
    .sort((a, b) => a.time.localeCompare(b.time));
}

async function loadRadarItemsUncached(): Promise<RadarItem[]> {
  const inboxBase = path.join(resolveAgentsRoot(), 'shared', 'inbox');
  if (!existsSync(inboxBase)) return [];

  const items: RadarItem[] = [];
  const agentDirs = readdirSync(inboxBase, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);

  for (const agentId of agentDirs) {
    const inboxDir = path.join(inboxBase, agentId);
    try {
      const files = readdirSync(inboxDir).filter((f) => f.endsWith('.json'));
      for (const file of files) {
        try {
          const content = JSON.parse(readFileSync(path.join(inboxDir, file), 'utf-8'));
          const type = agentId === 'security' ? 'alert' : (agentId === 'research' || agentId === 'ai-research' ? 'watch' : 'opportunity');
          const signal = content.priority === 'urgent' || content.priority === 'high' ? 'high' : content.priority === 'low' ? 'low' : 'medium';
          items.push({
            id: file.replace('.json', ''),
            type,
            title: content.subject || content.title || file.replace('.json', ''),
            signal,
            source: `${agentId} agent`,
            body: content.body || content.message || '',
            timestamp: content.timestamp || content.createdAt || new Date().toISOString(),
          });
        } catch {
          // ignore malformed inbox file
        }
      }
    } catch {
      // ignore unreadable inbox dir
    }
  }

  return items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export function loadRepos() {
  return getCached('repos', { ttlMs: 8000, staleMs: 20000 }, loadReposUncached);
}

export function loadWorkflows() {
  return getCached('workflows', { ttlMs: 30000, staleMs: 60000 }, loadWorkflowsUncached);
}

export function loadBriefings() {
  return getCached('briefings', { ttlMs: 20000, staleMs: 40000 }, loadBriefingsUncached);
}

export function loadRadarItems() {
  return getCached('radar', { ttlMs: 10000, staleMs: 30000 }, loadRadarItemsUncached);
}
