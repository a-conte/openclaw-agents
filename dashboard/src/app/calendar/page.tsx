'use client';

import { useMemo } from 'react';
import { useCron } from '@/hooks/useCron';
import { useNow } from '@/hooks/useNow';
import { AGENT_COLORS, AGENT_EMOJIS } from '@/lib/constants';
import { Calendar as CalendarIcon } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { InlineError } from '@/components/shared/InlineError';
import { cn } from '@/lib/utils';
import type { CronJob } from '@/lib/types';

const HOURS = Array.from({ length: 18 }, (_, i) => i + 5); // 5am to 10pm
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function parseCronToEvents(jobs: CronJob[]) {
  const events: Array<{
    job: CronJob;
    day: number; // 0=Mon...6=Sun, -1=daily
    hour: number;
    minute: number;
  }> = [];

  for (const job of jobs) {
    if (!job.enabled) continue;
    const parts = (job.schedule || '').split(' ');
    if (parts.length < 5) continue;

    const minute = parseInt(parts[0]) || 0;
    const hour = parseInt(parts[1]) || 0;
    const dayOfWeek = parts[4];

    if (dayOfWeek === '*') {
      // Daily event — show on all days
      for (let d = 0; d < 7; d++) {
        events.push({ job, day: d, hour, minute });
      }
    } else {
      // Specific day (cron: 0=Sun, 1=Mon... we need 0=Mon)
      const cronDay = parseInt(dayOfWeek);
      if (!isNaN(cronDay)) {
        const mapped = cronDay === 0 ? 6 : cronDay - 1; // Convert to Mon=0
        events.push({ job, day: mapped, hour, minute });
      }
    }
  }

  return events;
}

function CalendarContent() {
  const { cronJobs, heartbeats, isLoading, error } = useCron();

  const events = useMemo(() => parseCronToEvents(cronJobs), [cronJobs]);

  // Get current day/hour for highlighting (deferred to client to avoid hydration mismatch)
  const { now: nowMs, hydrated } = useNow([cronJobs]);
  const nowDate = hydrated ? new Date(nowMs) : null;
  const currentDay = nowDate ? (nowDate.getDay() === 0 ? 6 : nowDate.getDay() - 1) : -1; // Mon=0
  const currentHour = nowDate ? nowDate.getHours() : -1;

  return (
    <div className="p-6 overflow-auto h-full">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-text-primary font-[var(--font-heading)]">Calendar</h1>
        <p className="text-sm text-text-tertiary mt-1">
          {cronJobs.filter((j: CronJob) => j.enabled).length} scheduled events
        </p>
      </div>

      {error && <div className="mb-4"><InlineError message="Failed to load calendar data." /></div>}

      {isLoading ? (
        <div className="h-[500px] bg-surface-2 rounded-lg animate-pulse" />
      ) : events.length === 0 ? (
        <EmptyState icon={<CalendarIcon size={32} />} title="No events" description="No cron jobs scheduled" />
      ) : (
        <div className="bg-surface-1 border border-border rounded-lg overflow-hidden">
          {/* Header row */}
          <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border">
            <div className="p-2" />
            {DAYS.map((day, i) => (
              <div
                key={day}
                className={cn(
                  'p-2 text-center text-xs font-medium uppercase tracking-wider border-l border-border',
                  i === currentDay ? 'text-accent bg-accent/5' : 'text-text-tertiary'
                )}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Time grid */}
          {HOURS.map((hour) => (
            <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border last:border-b-0">
              <div className={cn(
                'p-2 text-xs text-text-tertiary font-mono text-right pr-3',
                hour === currentHour && 'text-accent'
              )}>
                {hour.toString().padStart(2, '0')}:00
              </div>
              {DAYS.map((_, dayIdx) => {
                const cellEvents = events.filter(e => e.day === dayIdx && e.hour === hour);
                return (
                  <div
                    key={dayIdx}
                    className={cn(
                      'border-l border-border min-h-[40px] p-0.5',
                      dayIdx === currentDay && hour === currentHour && 'bg-accent/5'
                    )}
                  >
                    {cellEvents.map((ev, i) => {
                      const color = AGENT_COLORS[ev.job.agentId] || '#555';
                      return (
                        <div
                          key={`${ev.job.id}-${i}`}
                          className="text-[10px] px-1.5 py-0.5 rounded mb-0.5 truncate cursor-default"
                          style={{ backgroundColor: color + '20', color, borderLeft: `2px solid ${color}` }}
                          title={`${ev.job.name} (${ev.job.agentId}) at ${ev.hour}:${ev.minute.toString().padStart(2, '0')}`}
                        >
                          {ev.job.name}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CalendarPage() {
  return (
    <ErrorBoundary name="Calendar">
      <CalendarContent />
    </ErrorBoundary>
  );
}
