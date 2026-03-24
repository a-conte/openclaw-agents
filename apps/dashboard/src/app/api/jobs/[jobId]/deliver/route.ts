import os from 'os';
import path from 'path';
import { mkdir, writeFile } from 'fs/promises';
import { NextResponse } from 'next/server';
import { getJob, getJobArtifactBundle } from '@/lib/jobs-store';
import { deliverJobHandoff } from '@/lib/job-delivery';

export const dynamic = 'force-dynamic';

async function persistBundleAttachment(jobId: string) {
  const response = await getJobArtifactBundle(jobId, 'bundle');
  const bytes = Buffer.from(await response.arrayBuffer());
  const requestedFilename =
    response.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1] || `${jobId}-bundle.zip`;
  const filename = path.basename(requestedFilename);
  const targetDir = path.join(os.tmpdir(), 'openclaw-job-delivery');
  await mkdir(targetDir, { recursive: true });
  const filePath = path.join(targetDir, filename);
  await writeFile(filePath, bytes);
  return filePath;
}

export async function POST(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;

  try {
    const payload = await request.json();
    const channel = typeof payload.channel === 'string' ? payload.channel : '';
    if (!['notes', 'mail_draft', 'imessage'].includes(channel)) {
      return NextResponse.json({ error: 'Invalid delivery channel' }, { status: 400 });
    }

    const job = await getJob(jobId);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const origin = new URL(request.url).origin;
    const attachmentPath = channel === 'mail_draft' ? await persistBundleAttachment(jobId) : undefined;
    const result = await deliverJobHandoff({
      job,
      origin,
      channel,
      detailPath: typeof payload.detailPath === 'string' ? payload.detailPath : undefined,
      mailTo: typeof payload.mailTo === 'string' ? payload.mailTo : undefined,
      recipient: typeof payload.recipient === 'string' ? payload.recipient : undefined,
      attachmentPath,
    });

    return NextResponse.json({ ok: true, ...result, attachmentPath });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to deliver job handoff' },
      { status: 400 },
    );
  }
}
