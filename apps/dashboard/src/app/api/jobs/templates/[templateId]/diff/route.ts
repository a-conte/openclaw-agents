import { NextResponse } from 'next/server';
import { diffJobTemplateVersions } from '@/lib/jobs-store';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await params;
  const { searchParams } = new URL(request.url);
  const fromVersion = Number(searchParams.get('from') || 0);
  const toRaw = searchParams.get('to');
  const toVersion = toRaw ? Number(toRaw) : undefined;
  try {
    return NextResponse.json(await diffJobTemplateVersions(templateId, fromVersion, toVersion));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to diff template versions' },
      { status: 400 },
    );
  }
}
