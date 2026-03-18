import { NextResponse } from 'next/server';
import { createJobTemplate, getJobTemplates } from '@/lib/jobs-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await getJobTemplates());
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    return NextResponse.json(await createJobTemplate(payload), { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create template' },
      { status: 400 },
    );
  }
}
