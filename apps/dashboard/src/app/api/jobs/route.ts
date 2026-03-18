import { NextResponse } from 'next/server';
import { createJob, getAllJobs, isKnownAgent } from '@/lib/jobs-store';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const archived = searchParams.get('archived') === 'true';
  return NextResponse.json(await getAllJobs(archived));
}

export async function POST(request: Request) {
  let data: any;
  try {
    data = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const mode = typeof data.mode === 'string' ? data.mode : 'agent';
  const workflowSpec = data.workflowSpec;
  const templateId = typeof data.templateId === 'string' ? data.templateId.trim() : '';
  const templateInputs = typeof data.templateInputs === 'object' && data.templateInputs !== null && !Array.isArray(data.templateInputs)
    ? Object.fromEntries(Object.entries(data.templateInputs).map(([key, value]) => [key, String(value)]))
    : undefined;
  if (!['agent', 'shell', 'steer', 'drive', 'workflow', 'note'].includes(mode)) {
    return NextResponse.json({ error: 'mode must be one of: agent, shell, steer, drive, workflow, note' }, { status: 400 });
  }
  if (mode === 'agent' || mode === 'shell' || mode === 'note') {
    if (typeof data.prompt !== 'string' || data.prompt.trim().length === 0) {
      return NextResponse.json({ error: 'prompt must be a non-empty string' }, { status: 400 });
    }
  }
  if (mode === 'agent') {
    if (typeof data.targetAgent !== 'string' || !isKnownAgent(data.targetAgent)) {
      return NextResponse.json(
        { error: 'targetAgent must be one of: main, mail, docs, research, ai-research, dev, security' },
        { status: 400 },
      );
    }
  }
  if ((mode === 'steer' || mode === 'drive') && (typeof data.command !== 'string' || data.command.trim().length === 0)) {
    return NextResponse.json({ error: 'command is required for steer and drive jobs' }, { status: 400 });
  }
  if (
    mode === 'workflow' &&
    (typeof data.workflow !== 'string' || data.workflow.trim().length === 0) &&
    (typeof workflowSpec !== 'object' || workflowSpec === null || Array.isArray(workflowSpec)) &&
    !templateId
  ) {
    return NextResponse.json({ error: 'workflow, workflowSpec, or templateId is required for workflow jobs' }, { status: 400 });
  }

  const job = await createJob({
    prompt: typeof data.prompt === 'string' ? data.prompt.trim() : '',
    targetAgent: typeof data.targetAgent === 'string' ? data.targetAgent : 'main',
    priority: data.priority,
    mode,
    command: typeof data.command === 'string' ? data.command.trim() : undefined,
    workflow: typeof data.workflow === 'string' ? data.workflow.trim() : undefined,
    args: Array.isArray(data.args) ? data.args.map((item: unknown) => String(item)) : [],
    workflowSpec: typeof workflowSpec === 'object' && workflowSpec !== null && !Array.isArray(workflowSpec) ? workflowSpec : undefined,
    templateId: templateId || undefined,
    templateInputs,
    thinking: typeof data.thinking === 'string' ? data.thinking : undefined,
    local: Boolean(data.local),
  });
  return NextResponse.json(job, { status: 201 });
}
