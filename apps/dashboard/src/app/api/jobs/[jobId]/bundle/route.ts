import { getJobArtifactBundle } from '@/lib/jobs-store';

export async function GET(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const kind = new URL(request.url).searchParams.get('kind')?.trim() || 'bundle';

  try {
    const upstream = await getJobArtifactBundle(jobId, kind);
    const headers = new Headers();
    const contentType = upstream.headers.get('content-type');
    if (contentType) headers.set('content-type', contentType);
    const contentLength = upstream.headers.get('content-length');
    if (contentLength) headers.set('content-length', contentLength);
    const disposition = upstream.headers.get('content-disposition');
    if (disposition) headers.set('content-disposition', disposition);
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to load artifact bundle' },
      { status: 502 },
    );
  }
}
