import { getJobArtifact } from '@/lib/jobs-store';

export async function GET(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const relativePath = new URL(request.url).searchParams.get('path')?.trim() || '';
  if (!relativePath) {
    return Response.json({ error: 'path query parameter is required' }, { status: 400 });
  }

  try {
    const upstream = await getJobArtifact(jobId, relativePath);
    const headers = new Headers();
    const contentType = upstream.headers.get('content-type');
    if (contentType) headers.set('content-type', contentType);
    const contentLength = upstream.headers.get('content-length');
    if (contentLength) headers.set('content-length', contentLength);
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to load artifact' },
      { status: 502 },
    );
  }
}
