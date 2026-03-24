import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JobContract } from '@openclaw/contracts';

const {
  getJobMock,
  getJobArtifactBundleMock,
  deliverJobHandoffMock,
  mkdirMock,
  writeFileMock,
} = vi.hoisted(() => ({
  getJobMock: vi.fn(),
  getJobArtifactBundleMock: vi.fn(),
  deliverJobHandoffMock: vi.fn(),
  mkdirMock: vi.fn(),
  writeFileMock: vi.fn(),
}));

vi.mock('@/lib/jobs-store', () => ({
  getJob: getJobMock,
  getJobArtifactBundle: getJobArtifactBundleMock,
}));

vi.mock('@/lib/job-delivery', () => ({
  deliverJobHandoff: deliverJobHandoffMock,
}));

vi.mock('fs/promises', () => ({
  mkdir: mkdirMock,
  writeFile: writeFileMock,
}));

import { POST } from './route';

function makeJob(overrides: Partial<JobContract> = {}): JobContract {
  return {
    id: 'job-123',
    prompt: 'Investigate delivery',
    targetAgent: 'main',
    status: 'completed',
    createdAt: '2026-03-23T12:00:00.000Z',
    ...overrides,
  };
}

describe('POST /api/jobs/[jobId]/deliver', () => {
  beforeEach(() => {
    getJobMock.mockReset();
    getJobArtifactBundleMock.mockReset();
    deliverJobHandoffMock.mockReset();
    mkdirMock.mockReset();
    writeFileMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects unsupported delivery channels', async () => {
    const response = await POST(
      new Request('http://localhost:3000/api/jobs/job-123/deliver', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ channel: 'slack' }),
      }),
      { params: Promise.resolve({ jobId: 'job-123' }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid delivery channel' });
  });

  it('returns 404 when the job does not exist', async () => {
    getJobMock.mockResolvedValue(undefined);

    const response = await POST(
      new Request('http://localhost:3000/api/jobs/job-123/deliver', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ channel: 'notes' }),
      }),
      { params: Promise.resolve({ jobId: 'job-123' }) },
    );

    expect(getJobMock).toHaveBeenCalledWith('job-123');
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Job not found' });
  });

  it('persists a sanitized bundle attachment before drafting mail', async () => {
    getJobMock.mockResolvedValue(makeJob());
    getJobArtifactBundleMock.mockResolvedValue(
      new Response('zip-bytes', {
        headers: {
          'content-disposition': 'attachment; filename="../unsafe/job-123.zip"',
        },
      }),
    );
    deliverJobHandoffMock.mockResolvedValue({ channel: 'mail_draft', title: 'handoff' });

    const response = await POST(
      new Request('http://localhost:3000/api/jobs/job-123/deliver', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ channel: 'mail_draft', mailTo: 'ops@example.com', detailPath: '/command/jobs/job-123' }),
      }),
      { params: Promise.resolve({ jobId: 'job-123' }) },
    );

    expect(response.status).toBe(200);
    expect(getJobArtifactBundleMock).toHaveBeenCalledWith('job-123', 'bundle');
    expect(mkdirMock).toHaveBeenCalledOnce();
    expect(writeFileMock).toHaveBeenCalledOnce();
    expect(String(writeFileMock.mock.calls[0][0])).toMatch(/openclaw-job-delivery\/job-123\.zip$/);
    expect(deliverJobHandoffMock).toHaveBeenCalledWith(
      expect.objectContaining({
        job: expect.objectContaining({ id: 'job-123' }),
        channel: 'mail_draft',
        mailTo: 'ops@example.com',
        detailPath: '/command/jobs/job-123',
        attachmentPath: expect.stringMatching(/openclaw-job-delivery\/job-123\.zip$/),
        origin: 'http://localhost:3000',
      }),
    );
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        ok: true,
        channel: 'mail_draft',
        title: 'handoff',
        attachmentPath: expect.stringMatching(/openclaw-job-delivery\/job-123\.zip$/),
      }),
    );
  });
});
