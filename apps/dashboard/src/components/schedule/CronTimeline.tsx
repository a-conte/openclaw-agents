'use client';

import { Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { AGENT_EMOJIS } from '@/lib/constants';
import { Badge } from '@/components/shared/Badge';
import type { CronJob } from '@/lib/types';

interface CronTimelineProps {
  jobs: CronJob[];
}

export function CronTimeline({ jobs }: CronTimelineProps) {
  if (jobs.length === 0) {
    return (
      <div className="bg-surface-2 border border-border rounded-lg p-8 text-center">
        <Clock size={24} className="mx-auto text-text-tertiary mb-3" />
        <p className="text-sm text-text-tertiary">No cron jobs scheduled</p>
        <p className="text-xs text-text-tertiary mt-1">
          Cron jobs configured in ~/.openclaw/cron/jobs.json will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {jobs.map((job) => (
        <div key={job.id} className="bg-surface-2 border border-border rounded-lg p-3 flex items-center gap-3">
          <span className="text-lg">{AGENT_EMOJIS[job.agentId] || '🤖'}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-text-primary">{job.name}</p>
            <p className="text-xs text-text-tertiary font-mono">{job.schedule}</p>
          </div>
          <Badge variant={job.enabled ? 'default' : 'outline'} color={job.enabled ? '#22c55e' : undefined}>
            {job.enabled ? 'Active' : 'Disabled'}
          </Badge>
          {job.lastStatus && (
            job.lastStatus === 'success'
              ? <CheckCircle size={14} className="text-status-online" />
              : <AlertCircle size={14} className="text-status-error" />
          )}
        </div>
      ))}
    </div>
  );
}
