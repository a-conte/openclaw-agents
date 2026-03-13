import { execSync } from 'child_process';
import { existsSync, readFileSync, readdirSync } from 'fs';
import path from 'path';
import type { Briefing, RadarItem, RepoStatus, SystemRecommendation, Task, Workflow, WorkflowRun } from './types';
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

export function buildSystemRecommendations(input: {
  healthOk: boolean;
  agents: Array<{ agentId: string; sessions?: { recent?: Array<{ updatedAt: number }> } }>;
  tasks: Task[];
  runs: WorkflowRun[];
  repos: RepoStatus[];
  briefings: Briefing[];
  radarItems: RadarItem[];
}): SystemRecommendation[] {
  const { healthOk, agents, tasks, runs, repos, briefings, radarItems } = input;
  const recommendations: SystemRecommendation[] = [];
  const now = Date.now();

  const failedRuns = runs
    .filter((run) => run.status === 'failed')
    .sort((a, b) => +new Date(b.startedAt) - +new Date(a.startedAt));
  const dirtyRepos = repos.filter((repo) => repo.status !== 'clean');
  const staleTasks = tasks.filter(
    (task) => task.status === 'in_progress' && now - new Date(task.updatedAt).getTime() > 2 * 60 * 60 * 1000
  );
  const quietAgents = agents.filter((agent) => {
    const lastActivity = agent.sessions?.recent?.[0]?.updatedAt;
    return !lastActivity || now - lastActivity > 6 * 60 * 60 * 1000;
  });
  const pendingBriefings = briefings.filter((briefing) => briefing.status !== 'delivered');
  const highSignalRadar = radarItems.filter((item) => item.signal === 'high');

  if (!healthOk) {
    recommendations.push({
      id: 'gateway-recovery',
      title: 'Stabilize gateway connectivity',
      detail: 'Restore the gateway first so health, sessions, and command data stop drifting out of date.',
      rationale: 'Every other recommendation depends on live gateway telemetry.',
      href: '/system',
      actionLabel: 'Open system health',
      tone: 'danger',
      impact: 'high',
      effort: 'medium',
      taskDraft: {
        title: 'Restore gateway connectivity',
        description: 'Investigate the gateway health path, restore connectivity, and verify live agent/session telemetry is updating again.',
        priority: 'urgent',
        labels: ['system-improvement', 'gateway', 'reliability'],
      },
    });
  }

  if (failedRuns.length > 0) {
    const latest = failedRuns[0];
    recommendations.push({
      id: 'failed-workflow',
      title: `Harden "${latest.workflowName}"`,
      detail: latest.error
        ? `Latest failure: ${latest.error.slice(0, 120)}`
        : 'A recent workflow run failed and needs a postmortem plus guardrails.',
      rationale: `${failedRuns.length} failed run${failedRuns.length === 1 ? '' : 's'} increase operational drag and hide follow-on issues.`,
      href: '/pipeline',
      actionLabel: 'Inspect workflow runs',
      tone: 'danger',
      impact: 'high',
      effort: 'medium',
      taskDraft: {
        title: `Harden workflow: ${latest.workflowName}`,
        description: latest.error
          ? `Investigate the recent failure in "${latest.workflowName}", add guardrails or retries, and document the fix.\n\nLatest error: ${latest.error}`
          : `Investigate the recent failure in "${latest.workflowName}" and add guardrails or retries so it stops failing repeatedly.`,
        priority: 'high',
        labels: ['system-improvement', 'workflow', 'reliability'],
      },
    });
  }

  if (staleTasks.length > 0) {
    recommendations.push({
      id: 'stale-task-recovery',
      title: 'Rebalance stale in-progress work',
      detail: `${staleTasks.length} task${staleTasks.length === 1 ? '' : 's'} have not moved in over two hours.`,
      rationale: 'Long-lived in-progress tasks usually mean blocked execution, unclear ownership, or missing automation.',
      href: '/projects',
      actionLabel: 'Review project tasks',
      tone: 'warn',
      impact: 'high',
      effort: 'low',
      taskDraft: {
        title: 'Rebalance stale in-progress tasks',
        description: `Review ${staleTasks.length} stale in-progress task${staleTasks.length === 1 ? '' : 's'}, reassign blocked work, and capture the automation gaps causing drift.`,
        priority: 'high',
        labels: ['system-improvement', 'tasks', 'operations'],
      },
    });
  }

  if (dirtyRepos.length > 0) {
    const totalChanges = dirtyRepos.reduce((sum, repo) => sum + repo.uncommittedCount, 0);
    recommendations.push({
      id: 'repo-hygiene',
      title: 'Reduce repo drift in watched workspaces',
      detail: `${dirtyRepos.length} watched repo${dirtyRepos.length === 1 ? '' : 's'} have ${totalChanges} uncommitted change${totalChanges === 1 ? '' : 's'}.`,
      rationale: 'Cleaning or checkpointing local changes lowers context-switch cost and makes automation safer.',
      href: '/system',
      actionLabel: 'Open repo status',
      tone: 'warn',
      impact: 'medium',
      effort: 'low',
      taskDraft: {
        title: 'Reduce repo drift in watched workspaces',
        description: `Audit ${dirtyRepos.length} watched repo${dirtyRepos.length === 1 ? '' : 's'} with local changes, checkpoint valid work, and clean up stale branches or uncommitted edits.`,
        priority: 'medium',
        labels: ['system-improvement', 'repos', 'hygiene'],
      },
    });
  }

  if (quietAgents.length > 0) {
    recommendations.push({
      id: 'quiet-agent-coverage',
      title: 'Audit quiet agents for coverage gaps',
      detail: `${quietAgents.length} agent${quietAgents.length === 1 ? '' : 's'} have been idle long enough to look stale.`,
      rationale: 'Consistently quiet agents may need new workflows, heartbeats, or explicit task routing.',
      href: '/agents',
      actionLabel: 'Review agents',
      tone: 'info',
      impact: 'medium',
      effort: 'medium',
      taskDraft: {
        title: 'Audit quiet agents for routing gaps',
        description: `Review ${quietAgents.length} quiet agent${quietAgents.length === 1 ? '' : 's'}, confirm heartbeat coverage, and add workflows or task routing where the system has gone idle.`,
        priority: 'medium',
        labels: ['system-improvement', 'agents', 'coverage'],
      },
    });
  }

  if (highSignalRadar.length > 0) {
    recommendations.push({
      id: 'radar-conversion',
      title: 'Turn high-signal radar into executable work',
      detail: `${highSignalRadar.length} radar item${highSignalRadar.length === 1 ? '' : 's'} are marked high signal and should become tasks, workflows, or briefings.`,
      rationale: 'Signal only matters if it is routed into a decision, a task, or an automated follow-up.',
      href: '/radar',
      actionLabel: 'Review radar',
      tone: 'info',
      impact: 'medium',
      effort: 'low',
      taskDraft: {
        title: 'Convert high-signal radar into executable work',
        description: `Review ${highSignalRadar.length} high-signal radar item${highSignalRadar.length === 1 ? '' : 's'} and turn the important ones into tasks, workflows, or scheduled briefings.`,
        priority: 'medium',
        labels: ['system-improvement', 'radar', 'triage'],
      },
    });
  }

  if (pendingBriefings.length > 0) {
    recommendations.push({
      id: 'briefing-followthrough',
      title: 'Tighten briefing delivery follow-through',
      detail: `${pendingBriefings.length} scheduled briefing${pendingBriefings.length === 1 ? '' : 's'} are still pending.`,
      rationale: 'Pending briefings are a sign that scheduled insight is not reliably reaching the operating loop.',
      href: '/system',
      actionLabel: 'Check schedule',
      tone: 'info',
      impact: 'medium',
      effort: 'low',
      taskDraft: {
        title: 'Tighten briefing delivery follow-through',
        description: `Investigate ${pendingBriefings.length} pending briefing${pendingBriefings.length === 1 ? '' : 's'} and close the gaps preventing scheduled insight from being delivered reliably.`,
        priority: 'medium',
        labels: ['system-improvement', 'briefings', 'schedule'],
      },
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      id: 'preventive-maintenance',
      title: 'Run a preventive maintenance pass',
      detail: 'The system looks stable, which is the right time to tighten documentation, add tests, or automate a manual review.',
      rationale: 'Use low-incident periods to improve resilience before the next spike in activity.',
      href: '/system',
      actionLabel: 'Open system controls',
      tone: 'info',
      impact: 'medium',
      effort: 'medium',
      taskDraft: {
        title: 'Run preventive maintenance on the system',
        description: 'Use the current stable window to improve documentation, add tests, or automate one manual review step before the next incident.',
        priority: 'medium',
        labels: ['system-improvement', 'maintenance'],
      },
    });
  }

  return recommendations.slice(0, 4);
}
