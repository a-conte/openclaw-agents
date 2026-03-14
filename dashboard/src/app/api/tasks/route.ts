import { NextResponse } from 'next/server';
import { getAllTasks, createTask } from '@/lib/tasks-store';
import { TASK_STATUSES, TASK_PRIORITIES } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(getAllTasks());
}

export async function POST(request: Request) {
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

  const task = await createTask(data);
  return NextResponse.json(task, { status: 201 });
}
