import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync, readdirSync } from 'fs';
import path from 'path';
import type { Workflow } from '@/lib/types';
import { createRun } from '@/lib/workflow-runs-store';
import { executeWorkflowInBackground } from '@/lib/workflow-executor';
import { resolveAgentsRoot } from '@/lib/paths';

export const dynamic = 'force-dynamic';

function loadWorkflows(): Workflow[] {
  const agentsRoot = resolveAgentsRoot();
  const sharedDir = path.join(agentsRoot, 'shared');
  const workflows: Workflow[] = [];

  for (const [dir, source] of [['workflows', 'workflow'], ['pipelines', 'pipeline']] as const) {
    const fullDir = path.join(sharedDir, dir);
    if (!existsSync(fullDir)) continue;
    for (const f of readdirSync(fullDir).filter(f => f.endsWith('.json'))) {
      try {
        const raw = JSON.parse(readFileSync(path.join(fullDir, f), 'utf-8'));
        workflows.push({
          name: raw.name,
          description: raw.description || '',
          trigger: raw.trigger || (source === 'workflow' ? 'on-demand' : 'event'),
          schedule: raw.schedule,
          keyword: raw.keyword,
          approvalRequired: raw.approvalRequired || false,
          approvalReason: raw.approvalReason,
          steps: (raw.steps || []).map((s: any) => ({
            agent: s.agent,
            action: s.action,
            passOutput: s.passOutput ?? false,
          })),
          source,
        });
      } catch { /* skip malformed files */ }
    }
  }
  return workflows;
}

export async function POST(req: NextRequest) {
  try {
    const { workflowName } = await req.json();

    if (!workflowName) {
      return NextResponse.json({ error: 'workflowName is required' }, { status: 400 });
    }

    const workflows = loadWorkflows();
    const workflow = workflows.find(w => w.name === workflowName);

    if (!workflow) {
      return NextResponse.json({ error: `Workflow "${workflowName}" not found` }, { status: 404 });
    }

    if (!workflow.steps.length) {
      return NextResponse.json({ error: 'Workflow has no steps' }, { status: 400 });
    }

    const run = await createRun(workflow);

    // Fire and forget — do not await
    executeWorkflowInBackground(run.id, workflow).catch(() => {});

    return NextResponse.json({ runId: run.id, status: 'running' }, { status: 202 });
  } catch (err) {
    void err;
    return NextResponse.json({ error: 'Failed to execute workflow' }, { status: 500 });
  }
}
