import { NextResponse } from 'next/server';
import { updateTask, deleteTask } from '@/lib/tasks-store';
import { TASK_STATUSES, TASK_PRIORITIES } from '@/lib/constants';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;

  let data: any;
  try {
    data = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (data.title !== undefined && (typeof data.title !== 'string' || data.title.trim().length === 0)) {
    return NextResponse.json({ error: 'title must be a non-empty string' }, { status: 400 });
  }
  if (data.status !== undefined && !(TASK_STATUSES as readonly string[]).includes(data.status)) {
    return NextResponse.json({ error: `status must be one of: ${TASK_STATUSES.join(', ')}` }, { status: 400 });
  }
  if (data.priority !== undefined && !(TASK_PRIORITIES as readonly string[]).includes(data.priority)) {
    return NextResponse.json({ error: `priority must be one of: ${TASK_PRIORITIES.join(', ')}` }, { status: 400 });
  }

  const task = await updateTask(taskId, data);
  if (!task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }
  return NextResponse.json(task);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  const success = await deleteTask(taskId);
  if (!success) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
