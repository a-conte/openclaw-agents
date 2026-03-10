import { NextResponse } from 'next/server';
import { readFileSync, existsSync, readdirSync } from 'fs';
import path from 'path';
import type { Workflow } from '@/lib/types';

export const dynamic = 'force-dynamic';

function resolveAgentsRoot(): string {
  if (process.env.OPENCLAW_AGENTS) return process.env.OPENCLAW_AGENTS;
  const fromCwd = path.resolve(process.cwd(), '..');
  if (existsSync(path.join(fromCwd, 'main')) || existsSync(path.join(fromCwd, 'dashboard'))) {
    return fromCwd;
  }
  return `${process.env.HOME}/openclaw-agents`;
}

function readJsonFiles(dir: string): Record<string, unknown>[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      try {
        const raw = JSON.parse(readFileSync(path.join(dir, f), 'utf-8'));
        return { ...raw, _filename: f };
      } catch {
        return null;
      }
    })
    .filter(Boolean) as Record<string, unknown>[];
}

export async function GET() {
  const agentsRoot = resolveAgentsRoot();
  const sharedDir = path.join(agentsRoot, 'shared');

  // Read workflow definitions
  const workflowFiles = readJsonFiles(path.join(sharedDir, 'workflows'));
  const workflows: Workflow[] = workflowFiles.map(w => ({
    name: w.name as string,
    description: w.description as string,
    trigger: (w.trigger as Workflow['trigger']) || 'on-demand',
    schedule: w.schedule as string | undefined,
    keyword: w.keyword as string | undefined,
    approvalRequired: (w.approvalRequired as boolean) || false,
    approvalReason: w.approvalReason as string | undefined,
    steps: (w.steps as Workflow['steps']) || [],
    source: 'workflow' as const,
  }));

  // Read pipeline definitions
  const pipelineFiles = readJsonFiles(path.join(sharedDir, 'pipelines'));
  const pipelines: Workflow[] = pipelineFiles.map(p => ({
    name: p.name as string,
    description: p.description as string,
    trigger: (p.trigger as Workflow['trigger']) || 'event',
    schedule: p.schedule as string | undefined,
    keyword: undefined,
    approvalRequired: false,
    steps: ((p.steps as any[]) || []).map(s => ({
      agent: s.agent,
      action: s.action,
      passOutput: s.passOutput ?? false,
    })),
    source: 'pipeline' as const,
  }));

  return NextResponse.json({ workflows: [...workflows, ...pipelines] });
}
