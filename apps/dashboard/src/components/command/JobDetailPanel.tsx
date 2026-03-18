'use client';

import Link from 'next/link';
import type { JobContract } from '@openclaw/contracts';
import { Badge } from '@/components/shared/Badge';
import { Button } from '@/components/shared/Button';
import { relativeTime } from '@/lib/utils';

function badgeColor(status: string) {
  if (status === 'failed') return '#e94560';
  if (status === 'completed') return '#06d6a0';
  if (status === 'running') return '#4A9EFF';
  return '#ffd166';
}

function durationText(startedAt?: string, completedAt?: string) {
  if (!startedAt || !completedAt) return null;
  const started = new Date(startedAt).getTime();
  const completed = new Date(completedAt).getTime();
  if (!Number.isFinite(started) || !Number.isFinite(completed) || completed < started) return null;
  const ms = completed - started;
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = seconds / 60;
  return `${minutes.toFixed(1)}m`;
}

function renderArtifactValue(value: unknown) {
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function StepArtifacts({ artifacts }: { artifacts: Record<string, unknown> | undefined }) {
  if (!artifacts || Object.keys(artifacts).length === 0) return null;

  return (
    <div className="mt-3 rounded-md border border-border bg-surface-3/80 p-3">
      <div className="mb-2 text-[11px] uppercase tracking-[0.16em] text-text-tertiary">Artifacts</div>
      <div className="space-y-2 text-xs text-text-secondary">
        {Object.entries(artifacts).map(([key, value]) => (
          <div key={key}>
            <div className="font-semibold capitalize text-text-primary">{key}</div>
            <div className="mt-1 whitespace-pre-wrap break-words">
              {renderArtifactValue(value)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function JobDetailPanel({
  job,
  archived = false,
  onStop,
  onResume,
  detailHref,
}: {
  job: JobContract;
  archived?: boolean;
  onStop?: (jobId: string) => void;
  onResume?: (jobId: string, mode: 'resume_failed' | 'resume_from' | 'rerun_all', resumeFromStepId?: string) => void;
  detailHref?: string;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface-2/75 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-text-primary">{job.workflow || job.command || job.mode || job.id}</div>
          <div className="mt-1 text-xs text-text-tertiary">
            attempt {job.attempt || 1}
            {job.retryMode ? ` · ${job.retryMode}` : ''}
            {job.resumeFromStepId ? ` · from ${job.resumeFromStepId}` : ''}
            {job.createdAt ? ` · ${relativeTime(job.createdAt)}` : ''}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge color={badgeColor(job.status)}>{job.status}</Badge>
          {detailHref ? <Link href={detailHref} className="text-xs text-accent hover:text-accent-hover">Open Page</Link> : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {job.status === 'running' && !archived && onStop ? (
          <Button size="sm" variant="ghost" onClick={() => onStop(job.id)}>Stop</Button>
        ) : null}
        {(job.status === 'failed' || job.status === 'stopped') && onResume ? (
          <>
            <Button size="sm" variant="secondary" onClick={() => onResume(job.id, 'resume_failed')}>Resume Failed</Button>
            <Button size="sm" variant="secondary" onClick={() => onResume(job.id, 'rerun_all')}>Rerun All</Button>
          </>
        ) : null}
      </div>

      {job.summary ? (
        <div className="rounded-lg border border-border bg-surface-3 p-3 text-sm text-text-secondary">{job.summary}</div>
      ) : null}
      {job.policy && job.policy.allowed === false ? (
        <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/8 px-3 py-2 text-xs text-yellow-100">{job.policy.reason || 'Blocked by policy'}</div>
      ) : null}
      {job.error ? (
        <div className="rounded-lg border border-red-500/20 bg-red-500/8 px-3 py-2 text-xs text-red-300">{job.error}</div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface-3 p-3">
          <div className="mb-2 text-xs uppercase tracking-[0.16em] text-text-tertiary">Attempt History</div>
          <div className="space-y-1 text-xs text-text-secondary">
            {Array.isArray(job.history) && job.history.length > 0 ? job.history.map((item, index) => (
              <div key={`${item.jobId || 'attempt'}-${index}`}>
                #{item.attempt || index + 1} · {item.status || 'unknown'}
                {item.mode ? ` · ${item.mode}` : ''}
                {item.resumeFromStepId ? ` · from ${item.resumeFromStepId}` : ''}
              </div>
            )) : <div>No prior attempts recorded.</div>}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface-3 p-3">
          <div className="mb-2 text-xs uppercase tracking-[0.16em] text-text-tertiary">Recent Updates</div>
          {Array.isArray(job.updates) && job.updates.length > 0 ? (
            <div className="space-y-1 text-xs text-text-secondary">
              {job.updates.slice(-10).map((update) => (
                <div key={`${update.at}-${update.message}`} className={update.level === 'error' ? 'text-red-300' : undefined}>
                  • {update.message}
                </div>
              ))}
            </div>
          ) : <div className="text-xs text-text-secondary">No updates recorded.</div>}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface-3 p-3">
        <div className="mb-2 text-xs uppercase tracking-[0.16em] text-text-tertiary">Steps</div>
        <div className="space-y-3">
          {Array.isArray(job.stepStatus) && job.stepStatus.length > 0 ? job.stepStatus.map((step) => (
            <div key={step.id} className="rounded-md border border-border bg-surface-2/75 px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-text-primary">{step.name}</div>
                  <div className="mt-1 text-[11px] text-text-tertiary">
                    {step.type}
                    {step.completedAt ? ` · ${relativeTime(step.completedAt)}` : ''}
                    {durationText(step.startedAt, step.completedAt) ? ` · ${durationText(step.startedAt, step.completedAt)}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge color={badgeColor(step.status)}>{step.status}</Badge>
                  {(job.status === 'failed' || job.status === 'stopped') && onResume ? (
                    <Button size="sm" variant="ghost" onClick={() => onResume(job.id, 'resume_from', step.id)}>Resume Here</Button>
                  ) : null}
                </div>
              </div>
              {step.error ? <div className="mt-2 text-xs text-red-300">{step.error}</div> : null}
              <StepArtifacts artifacts={step.artifacts as Record<string, unknown> | undefined} />
            </div>
          )) : <div className="text-xs text-text-secondary">No step details for this job.</div>}
        </div>
      </div>

      {job.result ? (
        <pre className="overflow-x-auto rounded-lg border border-border bg-surface-3 px-3 py-2 text-xs text-text-secondary">
          {typeof job.result === 'string' ? job.result : JSON.stringify(job.result, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
