import { NextResponse } from 'next/server';
import { restoreJobTemplate } from '@/lib/jobs-store';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await params;
  try {
    const payload = await request.json();
    const version = Number(payload?.version ?? 0);
    return NextResponse.json(await restoreJobTemplate(templateId, version));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to restore template version' },
      { status: 400 },
    );
  }
}
