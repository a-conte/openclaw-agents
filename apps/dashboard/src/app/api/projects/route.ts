import { NextRequest, NextResponse } from 'next/server';
import { getAllProjects, createProject } from '@/lib/projects-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(getAllProjects());
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const project = createProject(body);
  return NextResponse.json(project, { status: 201 });
}