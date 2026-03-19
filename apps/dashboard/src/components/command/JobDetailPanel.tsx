'use client';

import { useEffect, useMemo, useState } from 'react';
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

function durationMsText(durationMs?: number) {
  if (typeof durationMs !== 'number' || !Number.isFinite(durationMs) || durationMs < 0) return null;
  if (durationMs < 1000) return `${durationMs}ms`;
  const seconds = durationMs / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  return `${(seconds / 60).toFixed(1)}m`;
}

function liveDurationText(startedAt?: string, completedAt?: string) {
  const anchor = completedAt || new Date().toISOString();
  return durationText(startedAt, anchor);
}

function normalizeLiveTranscript(text: string) {
  const lines = text
    .split('\n')
    .map((line) => line.replace(/\r/g, ''))
    .filter((line) => line.trim().length > 0);
  if (lines.length === 0) return '';

  const filtered = lines.filter((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("printf '\\n__START_")) return false;
    if (trimmed.startsWith('drive_stdout_file=$(mktemp)')) return false;
    if (trimmed.startsWith('drive_stderr_file=$(mktemp)')) return false;
    if (trimmed.startsWith('__DONE_')) return false;
    if (trimmed.startsWith('__STDERR_END_')) return false;
    if (trimmed.startsWith('a_conte@server ')) return false;
    return true;
  });

  const compact = filtered.join('\n').trim();
  if (!compact) return '';
  return compact;
}

type ArtifactReference = {
  relativePath?: string;
  preview?: string | null;
  kind?: string;
  name?: string;
  size?: number;
  sourcePath?: string;
};

function isArtifactReference(value: unknown): value is ArtifactReference {
  return typeof value === 'object' && value !== null && 'relativePath' in value;
}

function isImageArtifact(value: ArtifactReference) {
  const name = value.name?.toLowerCase() || value.relativePath?.toLowerCase() || '';
  return /\.(png|jpe?g|gif|webp)$/i.test(name);
}

function previewBlock(text: string) {
  return (
    <pre className="mt-2 overflow-x-auto rounded-md border border-border bg-surface-2 px-2 py-2 text-[11px] text-text-secondary">
      {text}
    </pre>
  );
}

function renderArtifactValue(jobId: string, value: unknown) {
  if (isArtifactReference(value) && typeof value.relativePath === 'string' && value.relativePath) {
    const label = value.preview || value.name || value.relativePath;
    const href = `/api/jobs/${jobId}/artifact?path=${encodeURIComponent(value.relativePath)}`;
    return (
      <div className="space-y-1">
        <Link
          href={href}
          target="_blank"
          className="text-accent hover:text-accent-hover"
        >
          {label}
        </Link>
        <div className="text-[11px] text-text-tertiary">
          {value.kind || 'artifact'}
          {typeof value.size === 'number' ? ` · ${value.size} bytes` : ''}
          {value.sourcePath ? ` · source ${value.sourcePath}` : ''}
        </div>
        {value.preview ? previewBlock(value.preview) : null}
        {isImageArtifact(value) ? (
          <img
            src={href}
            alt={value.name || 'artifact preview'}
            className="mt-2 max-h-56 rounded-md border border-border object-contain"
          />
        ) : null}
      </div>
    );
  }
  if (typeof value === 'string') return value;
  return previewBlock(JSON.stringify(value, null, 2));
}

function StepArtifacts({ jobId, artifacts }: { jobId: string; artifacts: Record<string, unknown> | undefined }) {
  if (!artifacts || Object.keys(artifacts).length === 0) return null;

  return (
    <div className="mt-3 rounded-md border border-border bg-surface-3/80 p-3">
      <div className="mb-2 text-[11px] uppercase tracking-[0.16em] text-text-tertiary">Artifacts</div>
      <div className="space-y-2 text-xs text-text-secondary">
        {Object.entries(artifacts).map(([key, value]) => (
          <div key={key}>
            <div className="font-semibold capitalize text-text-primary">{key}</div>
            <div className="mt-1 whitespace-pre-wrap break-words">
              {renderArtifactValue(jobId, value)}
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
  const currentStep = Array.isArray(job.stepStatus) ? job.stepStatus.find((step) => step.id === job.currentStepId) : null;
  const latestUpdate = Array.isArray(job.updates) && job.updates.length > 0 ? job.updates[job.updates.length - 1] : null;
  const [liveTranscript, setLiveTranscript] = useState<{ session: string; transcript: string; error?: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function loadLiveTranscript() {
      if (job.status !== 'running') {
        setLiveTranscript(null);
        return;
      }
      try {
        const response = await fetch(`/api/jobs/${job.id}/live?lines=120`, { cache: 'no-store' });
        const payload = await response.json();
        if (!cancelled) {
          setLiveTranscript({
            session: typeof payload.session === 'string' ? payload.session : '',
            transcript: typeof payload.transcript === 'string' ? payload.transcript : '',
            error: typeof payload.error === 'string' ? payload.error : undefined,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setLiveTranscript({
            session: '',
            transcript: '',
            error: error instanceof Error ? error.message : 'Unable to load live transcript',
          });
        }
      } finally {
        if (!cancelled && job.status === 'running') {
          timer = setTimeout(loadLiveTranscript, 4000);
        }
      }
    }

    void loadLiveTranscript();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [job.id, job.status]);

  const liveTranscriptText = useMemo(() => {
    const text = liveTranscript?.transcript ? normalizeLiveTranscript(liveTranscript.transcript) : '';
    return text || '';
  }, [liveTranscript]);

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
        <Link href={`/api/jobs/${job.id}/bundle`} target="_blank" className="text-xs text-accent hover:text-accent-hover">
          Download Bundle
        </Link>
        <Link href={`/api/jobs/${job.id}/bundle?kind=incident`} target="_blank" className="text-xs text-accent hover:text-accent-hover">
          Incident Bundle
        </Link>
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
      {currentStep ? (
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/8 px-3 py-2 text-xs text-blue-100">
          Running now: <span className="font-semibold">{currentStep.name}</span>
          {liveDurationText(currentStep.startedAt, currentStep.completedAt) ? ` · ${liveDurationText(currentStep.startedAt, currentStep.completedAt)}` : ''}
          {latestUpdate?.message ? ` · ${latestUpdate.message}` : ''}
        </div>
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
                  • {update.message} <span className="text-text-tertiary">· {relativeTime(update.at)}</span>
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
                    {(durationMsText(step.durationMs) || durationText(step.startedAt, step.completedAt))
                      ? ` · ${durationMsText(step.durationMs) || durationText(step.startedAt, step.completedAt)}`
                      : ''}
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
              <StepArtifacts jobId={job.id} artifacts={step.artifacts as Record<string, unknown> | undefined} />
            </div>
          )) : <div className="text-xs text-text-secondary">No step details for this job.</div>}
        </div>
      </div>

      {job.status === 'running' ? (
        <div className="rounded-lg border border-border bg-surface-3 p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="text-xs uppercase tracking-[0.16em] text-text-tertiary">Live Transcript</div>
            <div className="text-[11px] text-text-tertiary">
              {liveTranscript?.session ? `session ${liveTranscript.session}` : 'waiting for session'}
            </div>
          </div>
          {liveTranscript?.error ? (
            <div className="text-xs text-red-300">{liveTranscript.error}</div>
          ) : liveTranscriptText ? (
            <pre className="max-h-80 overflow-auto rounded-md border border-border bg-surface-2 px-3 py-2 text-[11px] text-text-secondary">
              {liveTranscriptText}
            </pre>
          ) : (
            <div className="text-xs text-text-secondary">Waiting for live shell output…</div>
          )}
        </div>
      ) : null}

      {job.result ? (
        <pre className="overflow-x-auto rounded-lg border border-border bg-surface-3 px-3 py-2 text-xs text-text-secondary">
          {typeof job.result === 'string' ? job.result : JSON.stringify(job.result, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
