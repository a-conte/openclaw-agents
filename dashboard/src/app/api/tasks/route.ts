import { NextResponse } from 'next/server';
import { getAllTasks, createTask } from '@/lib/tasks-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(getAllTasks());
}

export async function POST(request: Request) {
  const data = await request.json();
  const task = createTask(data);
  return NextResponse.json(task, { status: 201 });
}
