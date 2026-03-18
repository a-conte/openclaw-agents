import { NextResponse } from 'next/server';
import { deleteJobTemplate, updateJobTemplate } from '@/lib/jobs-store';

export const dynamic = 'force-dynamic';

export async function PUT(request: Request, { params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await params;
  try {
    const payload = await request.json();
    return NextResponse.json(await updateJobTemplate(templateId, payload));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update template' },
      { status: 400 },
    );
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await params;
  try {
    return NextResponse.json(await deleteJobTemplate(templateId));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete template' },
      { status: 400 },
    );
  }
}
