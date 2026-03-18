import { NextResponse } from 'next/server';
import { cloneJobTemplate } from '@/lib/jobs-store';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await params;
  try {
    const payload = await request.json().catch(() => ({}));
    return NextResponse.json(await cloneJobTemplate(templateId, payload), { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to clone template' },
      { status: 400 },
    );
  }
}
