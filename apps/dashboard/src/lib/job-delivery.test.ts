import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JobContract } from '@openclaw/contracts';

const { execFileAsyncMock } = vi.hoisted(() => ({
  execFileAsyncMock: vi.fn(),
}));

vi.mock('util', () => ({
  promisify: () => execFileAsyncMock,
}));

vi.mock('@/lib/paths', () => ({
  resolveRepoRoot: () => '/repo',
}));

import { deliverJobHandoff } from './job-delivery';

function makeJob(overrides: Partial<JobContract> = {}): JobContract {
  return {
    id: 'job-123',
    prompt: 'Ship the fix',
    targetAgent: 'main',
    status: 'completed',
    mode: 'workflow',
    workflow: 'publish_release',
    summary: 'Published the release and attached the final notes.',
    attempt: 2,
    createdAt: '2026-03-23T12:00:00.000Z',
    stepStatus: [
      {
        id: 'step-1',
        name: 'Export notes',
        type: 'artifact',
        status: 'completed',
        artifacts: {
          releaseNotes: {
            relativePath: 'exports/release-notes.md',
            name: 'Release Notes',
          },
          stdout: {
            relativePath: 'logs/stdout.txt',
            name: 'stdout',
          },
        },
      },
    ],
    ...overrides,
  };
}

describe('deliverJobHandoff', () => {
  beforeEach(() => {
    execFileAsyncMock.mockReset();
    execFileAsyncMock.mockResolvedValue({ stdout: '{"ok":true}' });
  });

  it('builds a note handoff with artifact links and bundle URLs', async () => {
    const result = await deliverJobHandoff({
      job: makeJob(),
      origin: 'http://localhost:3000',
      channel: 'notes',
      detailPath: '/command/jobs/job-123',
    });

    expect(execFileAsyncMock).toHaveBeenCalledWith(
      'python3',
      [
        '/repo/apps/steer/steer_cli.py',
        'notes',
        'create',
        '--title',
        'publish_release · completed',
        '--body',
        expect.stringContaining('Detail: http://localhost:3000/command/jobs/job-123'),
        '--json',
      ],
      expect.objectContaining({ cwd: '/repo' }),
    );
    expect(result.body).toContain('Bundle ZIP: http://localhost:3000/api/jobs/job-123/bundle');
    expect(result.body).toContain('Release Notes: http://localhost:3000/api/jobs/job-123/artifact?path=exports%2Frelease-notes.md');
    expect(result.body).not.toContain('stdout.txt');
  });

  it('requires a recipient for mail drafts and attaches the bundle path when provided', async () => {
    await expect(
      deliverJobHandoff({
        job: makeJob(),
        origin: 'http://localhost:3000',
        channel: 'mail_draft',
      }),
    ).rejects.toThrow('mailTo is required for mail drafts');

    await deliverJobHandoff({
      job: makeJob(),
      origin: 'http://localhost:3000',
      channel: 'mail_draft',
      mailTo: 'ops@example.com',
      attachmentPath: '/tmp/job-123-bundle.zip',
    });

    expect(execFileAsyncMock).toHaveBeenLastCalledWith(
      'python3',
      [
        '/repo/apps/steer/steer_cli.py',
        'mail',
        'draft',
        '--to',
        'ops@example.com',
        '--subject',
        'publish_release · completed',
        '--body',
        expect.stringContaining('Incident ZIP: http://localhost:3000/api/jobs/job-123/bundle?kind=incident'),
        '--attachment',
        '/tmp/job-123-bundle.zip',
        '--json',
      ],
      expect.objectContaining({ cwd: '/repo' }),
    );
  });

  it('requires an iMessage recipient', async () => {
    await expect(
      deliverJobHandoff({
        job: makeJob(),
        origin: 'http://localhost:3000',
        channel: 'imessage',
      }),
    ).rejects.toThrow('recipient is required for iMessage delivery');
  });
});
