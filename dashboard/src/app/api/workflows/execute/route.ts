import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

function resolveAgentsRoot(): string {
  if (process.env.OPENCLAW_AGENTS) return process.env.OPENCLAW_AGENTS;
  const fromCwd = path.resolve(process.cwd(), '..');
  if (existsSync(path.join(fromCwd, 'main')) || existsSync(path.join(fromCwd, 'dashboard'))) {
    return fromCwd;
  }
  return `${process.env.HOME}/openclaw-agents`;
}

export async function POST(req: NextRequest) {
  try {
    const { workflow } = await req.json();

    if (!workflow?.name || !workflow?.steps?.length) {
      return NextResponse.json({ error: 'Invalid workflow' }, { status: 400 });
    }

    const agentsRoot = resolveAgentsRoot();
    const firstStep = workflow.steps[0];
    const targetAgent = firstStep.agent;
    const inboxDir = path.join(agentsRoot, 'shared', 'inbox', targetAgent);

    if (!existsSync(inboxDir)) {
      mkdirSync(inboxDir, { recursive: true });
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const filename = `${timestamp}-dashboard.json`;

    // Build the full workflow instruction for the agent
    const stepsDescription = workflow.steps
      .map((s: any, i: number) => `Step ${i + 1} (${s.agent}): ${s.action}`)
      .join('\n');

    const message = {
      from: 'dashboard',
      to: targetAgent,
      subject: `[Workflow] ${workflow.name}`,
      body: `You have been asked to execute the "${workflow.name}" power workflow.\n\n` +
        `Description: ${workflow.description}\n\n` +
        `Your task (Step 1): ${firstStep.action}\n\n` +
        `Full workflow steps:\n${stepsDescription}\n\n` +
        (workflow.steps.length > 1
          ? `After completing your step, forward the results to the next agent (${workflow.steps[1].agent}) via shared/inbox/${workflow.steps[1].agent}/.`
          : 'This is a single-step workflow.'),
      priority: 'high' as const,
      timestamp: new Date().toISOString(),
      status: 'unread' as const,
      pipeline: null,
      replyTo: null,
      workflow: workflow.name,
      expiresAt: null,
    };

    writeFileSync(path.join(inboxDir, filename), JSON.stringify(message, null, 2));

    return NextResponse.json({
      ok: true,
      message: `Workflow "${workflow.name}" dispatched to ${targetAgent}`,
      inboxFile: `shared/inbox/${targetAgent}/${filename}`,
    });
  } catch (err) {
    console.error('Workflow execute failed:', err);
    return NextResponse.json({ error: 'Failed to execute workflow' }, { status: 500 });
  }
}
