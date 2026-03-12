import { NextResponse } from 'next/server';
import { readFileSync, existsSync, readdirSync } from 'fs';
import path from 'path';
import { AGENT_ROLES } from '@/lib/constants';

export const dynamic = 'force-dynamic';

interface Recommendation {
  id: string;
  type: 'workflow' | 'cron' | 'task' | 'suggestion';
  title: string;
  description: string;
  source?: string;
  status: 'active' | 'available' | 'suggested';
  action?: 'assign' | 'create' | 'view';
  taskId?: string;
}

function loadWorkflows(): any[] {
  const AGENTS_DIR = process.env.OPENCLAW_AGENTS || process.cwd();
  const workflows: any[] = [];
  for (const dir of ['shared/workflows', 'shared/pipelines']) {
    const fullDir = path.join(AGENTS_DIR, dir);
    if (!existsSync(fullDir)) continue;
    for (const file of readdirSync(fullDir).filter(f => f.endsWith('.json'))) {
      try {
        const data = JSON.parse(readFileSync(path.join(fullDir, file), 'utf-8'));
        workflows.push({ ...data, _file: file, source: dir.includes('pipeline') ? 'pipeline' : 'workflow' });
      } catch {}
    }
  }
  return workflows;
}

function loadCronJobs(): any[] {
  const OPENCLAW_HOME = process.env.OPENCLAW_HOME || `${process.env.HOME}/.openclaw`;
  const cronPath = path.join(OPENCLAW_HOME, 'cron', 'jobs.json');
  if (!existsSync(cronPath)) return [];
  try {
    const data = JSON.parse(readFileSync(cronPath, 'utf-8'));
    return data.jobs || [];
  } catch {
    return [];
  }
}

function loadTasks(): any[] {
  const tasksPath = path.join(process.cwd(), 'data', 'tasks.json');
  if (!existsSync(tasksPath)) return [];
  try {
    return JSON.parse(readFileSync(tasksPath, 'utf-8'));
  } catch {
    return [];
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  const recommendations: Recommendation[] = [];

  const workflows = loadWorkflows();
  const cronJobs = loadCronJobs();
  const tasks = loadTasks();
  const role = AGENT_ROLES[agentId] || '';

  // 1. Workflows this agent participates in
  for (const wf of workflows) {
    const steps = wf.steps || [];
    const agentSteps = steps.filter((s: any) => s.agent === agentId);
    if (agentSteps.length > 0) {
      recommendations.push({
        id: `wf-${wf._file}`,
        type: 'workflow',
        title: wf.name,
        description: `${agentSteps.length} of ${steps.length} steps — ${wf.description || ''}`,
        source: wf.source,
        status: 'active',
        action: 'view',
      });
    }
  }

  // 2. Cron jobs assigned to this agent
  for (const job of cronJobs) {
    if (job.agentId === agentId && job.enabled) {
      const expr = typeof job.schedule === 'string' ? job.schedule : job.schedule?.expr || '';
      recommendations.push({
        id: `cron-${job.id}`,
        type: 'cron',
        title: job.name || 'Untitled job',
        description: `Schedule: ${expr}${job.state?.lastRunStatus === 'error' ? ' (last run failed)' : ''}`,
        status: 'active',
        action: 'view',
      });
    }
  }

  // 3. Tasks assigned to this agent
  const agentTasks = tasks.filter((t: any) => t.agentId === agentId && t.status !== 'done');
  for (const task of agentTasks) {
    recommendations.push({
      id: `task-${task.id}`,
      type: 'task',
      title: task.title,
      description: `${task.priority} priority — ${task.status.replace('_', ' ')}`,
      status: 'active',
      action: 'view',
      taskId: task.id,
    });
  }

  // 4. Unassigned tasks that could fit this agent's role
  const unassigned = tasks.filter((t: any) => !t.agentId && t.status !== 'done');
  for (const task of unassigned) {
    recommendations.push({
      id: `task-${task.id}`,
      type: 'task',
      title: task.title,
      description: `Unassigned — ${task.priority} priority`,
      status: 'available',
      action: 'assign',
      taskId: task.id,
    });
  }

  // 5. Role-based suggestions for workflows this agent doesn't participate in
  for (const wf of workflows) {
    const steps = wf.steps || [];
    const participates = steps.some((s: any) => s.agent === agentId);
    if (!participates) {
      const couldHelp = matchesRole(agentId, role, wf);
      if (couldHelp) {
        recommendations.push({
          id: `suggest-wf-${wf._file}`,
          type: 'suggestion',
          title: `Could contribute to "${wf.name}"`,
          description: couldHelp,
          status: 'suggested',
          action: 'create',
        });
      }
    }
  }

  // 6. General role-based suggestions
  const roleSuggestions = getRoleSuggestions(agentId, role, {
    workflowCount: workflows.filter(w => (w.steps || []).some((s: any) => s.agent === agentId)).length,
    cronCount: cronJobs.filter(j => j.agentId === agentId && j.enabled).length,
    taskCount: agentTasks.length,
  });
  for (const s of roleSuggestions) {
    recommendations.push(s);
  }

  return NextResponse.json({ recommendations });
}

function matchesRole(agentId: string, role: string, workflow: any): string | null {
  const desc = (workflow.description || '').toLowerCase();
  const stepTexts = (workflow.steps || []).map((s: any) => s.action?.toLowerCase() || '').join(' ');
  const combined = desc + ' ' + stepTexts;

  const matchers: Record<string, { keywords: string[]; reason: string }> = {
    mail: { keywords: ['email', 'inbox', 'notification', 'outreach'], reason: 'Involves email/notification handling' },
    research: { keywords: ['research', 'scan', 'analyze', 'findings', 'news'], reason: 'Involves research or analysis' },
    'ai-research': { keywords: ['model', 'ai ', 'llm', 'benchmark', 'evaluation'], reason: 'Involves AI/model analysis' },
    dev: { keywords: ['code', 'build', 'deploy', 'ci', 'repo', 'branch', 'pr '], reason: 'Involves code or infrastructure' },
    docs: { keywords: ['document', 'report', 'draft', 'write', 'content'], reason: 'Involves documentation or content' },
    security: { keywords: ['security', 'audit', 'compliance', 'vulnerability', 'threat'], reason: 'Involves security concerns' },
  };

  const matcher = matchers[agentId];
  if (!matcher) return null;

  const matches = matcher.keywords.some(kw => combined.includes(kw));
  return matches ? matcher.reason : null;
}

function getRoleSuggestions(
  agentId: string,
  _role: string,
  stats: { workflowCount: number; cronCount: number; taskCount: number }
): Recommendation[] {
  const suggestions: Recommendation[] = [];

  const roleSuggestionMap: Record<string, Recommendation[]> = {
    mail: [
      { id: 'suggest-mail-1', type: 'suggestion', title: 'Email digest automation', description: 'Set up automated email categorization and priority scoring', status: 'suggested', action: 'create' },
      { id: 'suggest-mail-2', type: 'suggestion', title: 'Follow-up tracker', description: 'Monitor sent emails that haven\'t received replies after 48h', status: 'suggested', action: 'create' },
    ],
    research: [
      { id: 'suggest-research-1', type: 'suggestion', title: 'RSS feed monitoring', description: 'Auto-scan FreshRSS feeds for high-signal items daily', status: 'suggested', action: 'create' },
      { id: 'suggest-research-2', type: 'suggestion', title: 'Competitor tracking', description: 'Weekly scan of competitor repos, blogs, and releases', status: 'suggested', action: 'create' },
    ],
    'ai-research': [
      { id: 'suggest-air-1', type: 'suggestion', title: 'Model benchmark tracking', description: 'Monitor new model releases and benchmark scores weekly', status: 'suggested', action: 'create' },
      { id: 'suggest-air-2', type: 'suggestion', title: 'Paper digest', description: 'Scan arxiv for relevant AI/ML papers and summarize key findings', status: 'suggested', action: 'create' },
    ],
    dev: [
      { id: 'suggest-dev-1', type: 'suggestion', title: 'Dependency audit', description: 'Weekly check for outdated or vulnerable dependencies', status: 'suggested', action: 'create' },
      { id: 'suggest-dev-2', type: 'suggestion', title: 'Dead code scan', description: 'Identify unused exports, unreachable code, and stale branches', status: 'suggested', action: 'create' },
    ],
    docs: [
      { id: 'suggest-docs-1', type: 'suggestion', title: 'Documentation freshness check', description: 'Scan READMEs and docs for outdated information', status: 'suggested', action: 'create' },
      { id: 'suggest-docs-2', type: 'suggestion', title: 'Changelog generation', description: 'Auto-generate changelogs from merged PRs and commit messages', status: 'suggested', action: 'create' },
    ],
    security: [
      { id: 'suggest-sec-1', type: 'suggestion', title: 'Access audit', description: 'Review GitHub team permissions and API token scopes', status: 'suggested', action: 'create' },
      { id: 'suggest-sec-2', type: 'suggestion', title: 'Secret scanning', description: 'Scan repos for accidentally committed secrets or credentials', status: 'suggested', action: 'create' },
    ],
    main: [
      { id: 'suggest-main-1', type: 'suggestion', title: 'Agent health monitoring', description: 'Track agent response times and error rates, alert on degradation', status: 'suggested', action: 'create' },
      { id: 'suggest-main-2', type: 'suggestion', title: 'Cross-agent coordination', description: 'Detect when multiple agents are working on overlapping tasks', status: 'suggested', action: 'create' },
    ],
  };

  const agentSuggestions = roleSuggestionMap[agentId] || [];

  if (stats.workflowCount + stats.cronCount + stats.taskCount < 5) {
    suggestions.push(...agentSuggestions);
  } else if (agentSuggestions.length > 0) {
    suggestions.push(agentSuggestions[0]);
  }

  return suggestions;
}
