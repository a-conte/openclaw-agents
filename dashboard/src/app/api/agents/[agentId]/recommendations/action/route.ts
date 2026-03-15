import { NextResponse } from 'next/server';
import { updateTask, createTask } from '@/lib/tasks-store';
import { runOpenClaw } from '@/lib/openclaw-cli';
import { createLogger } from '@/lib/logger';

const log = createLogger('recommendations-action');

function runAgent(agentId: string, message: string, taskId?: string) {
  // Fire and forget — don't block the response
  runOpenClaw(
    [
      'agent', '--agent', agentId, '--message', message, '--json',
      '--deliver', '--reply-channel', 'telegram', '--reply-account', 'main', '--reply-to', '1858496116',
    ],
    {
      timeout: 600_000,
      cwd: process.env.HOME || '/Users/a_conte',
    }
  ).then(async () => {
    if (taskId) await updateTask(taskId, { status: 'done' });
  }).catch(async (err) => {
    log.error('Agent run failed', { agentId, err: err.stderr || err.message });
    if (taskId) await updateTask(taskId, { status: 'todo', labels: ['agent-failed'] });
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  const body = await request.json();
  const { action, taskId, title, description, type } = body;

  // "run" — trigger the agent to execute a task/workflow/suggestion
  if (action === 'run') {
    let message = '';
    let runTaskId: string | undefined;

    const prInstruction = '\n\nIMPORTANT: When you are done with your changes, create a new branch and open a Pull Request to main for review. Do NOT push directly to main.';

    if (type === 'task' && taskId) {
      // Mark task as in_progress
      await updateTask(taskId, { agentId, status: 'in_progress' });
      runTaskId = taskId;
      message = `You have been assigned the following task. Complete it and report back with what you did.\n\nTask: ${title}\n${description ? `Details: ${description}` : ''}${prInstruction}`;
    } else if (type === 'workflow') {
      message = `Execute the following workflow: "${title}"\n${description ? `Context: ${description}` : ''}`;
    } else if (type === 'cron') {
      message = `Run your scheduled job now: "${title}"\n${description ? `Context: ${description}` : ''}`;
    } else if (type === 'suggestion') {
      // Create a task from the suggestion, then run it
      const task = await createTask({
        title: title || 'Untitled',
        description: description || '',
        agentId,
        status: 'in_progress',
        priority: 'medium',
        labels: ['auto-suggested'],
      });
      runTaskId = task.id;
      message = `You have been assigned a new task. Complete it and report back with what you did.\n\nTask: ${title}\n${description ? `Details: ${description}` : ''}${prInstruction}`;
    } else {
      message = `${title}\n${description || ''}${prInstruction}`;
    }

    runAgent(agentId, message, runTaskId);

    return NextResponse.json({
      ok: true,
      message: `Agent ${agentId} is now working on: ${title}`,
    }, { status: 202 });
  }

  // Legacy: "assign" — just assign without running
  if (action === 'assign' && taskId) {
    const task = await updateTask(taskId, { agentId, status: 'todo' });
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, task });
  }

  // Legacy: "create" — just create without running
  if (action === 'create') {
    const task = await createTask({
      title: title || 'Untitled',
      description: description || '',
      agentId,
      status: 'todo',
      priority: 'medium',
      labels: ['auto-suggested'],
    });
    return NextResponse.json({ ok: true, task }, { status: 201 });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
