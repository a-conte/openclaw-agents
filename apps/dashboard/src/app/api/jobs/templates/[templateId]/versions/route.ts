import { NextResponse } from 'next/server';
import { getJobTemplateVersions } from '@/lib/jobs-store';

export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await params;
  return NextResponse.json(await getJobTemplateVersions(templateId));
}
