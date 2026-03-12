import { NextResponse } from 'next/server';
import { updateTask, createTask } from '@/lib/tasks-store';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  const body = await request.json();
  const { action, taskId, title, description } = body;

  if (action === 'assign' && taskId) {
    // Assign existing unassigned task to this agent
    const task = updateTask(taskId, { agentId, status: 'todo' });
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, task });
  }

  if (action === 'create') {
    // Create a new task from a suggestion and assign to this agent
    const task = createTask({
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
