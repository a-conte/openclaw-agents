'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import type { JobContract } from '@openclaw/contracts';
import { JobDetailPanel } from '@/components/command/JobDetailPanel';
import { Button } from '@/components/shared/Button';
import { InlineError } from '@/components/shared/InlineError';
import { POLL_INTERVAL } from '@/lib/constants';

const fetcher = async (url: string) => {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `Request failed: ${response.status}`);
  }
  return response.json();
};

export default function CommandJobDetailPage() {
  const params = useParams<{ jobId: string }>();
  const jobId = String(params.jobId || '');
  const { data: job, error, mutate } = useSWR<JobContract>(jobId ? `/api/jobs/${jobId}` : null, fetcher, {
    refreshInterval: POLL_INTERVAL,
  });

  async function stopJob(id: string) {
    await fetch(`/api/jobs/${id}`, { method: 'DELETE' });
    await mutate();
  }

  async function resumeJob(id: string, mode: 'resume_failed' | 'resume_from' | 'rerun_all', resumeFromStepId?: string) {
    await fetch(`/api/jobs/${id}/retry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, resumeFromStepId }),
    });
    await mutate();
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-6 overflow-auto p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-text-tertiary">Automation Jobs</div>
          <h1 className="mt-1 font-[var(--font-heading)] text-2xl text-text-primary">Job Detail</h1>
        </div>
        <Link href="/command">
          <Button variant="secondary">Back To Command</Button>
        </Link>
      </div>

      {error ? <InlineError message={error.message} onRetry={() => void mutate()} /> : null}
      {job ? (
        <JobDetailPanel job={job} onStop={(id) => void stopJob(id)} onResume={(id, mode, stepId) => void resumeJob(id, mode, stepId)} />
      ) : !error ? (
        <div className="rounded-xl border border-border bg-surface-2/75 p-6 text-sm text-text-secondary">Loading job detail…</div>
      ) : null}
    </div>
  );
}
