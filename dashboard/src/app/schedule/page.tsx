'use client';

import { useState } from 'react';
import { useCron } from '@/hooks/useCron';
import { HeartbeatGrid } from '@/components/schedule/HeartbeatGrid';
import { CronCalendar } from '@/components/schedule/CronCalendar';
import { CronTimeline } from '@/components/schedule/CronTimeline';
import { Button } from '@/components/shared/Button';
import { Calendar, List } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SchedulePage() {
  const { cronJobs, heartbeats, isLoading } = useCron();
  const [view, setView] = useState<'calendar' | 'timeline'>('calendar');

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Schedule</h1>
          <p className="text-sm text-text-tertiary mt-1">Heartbeats and cron jobs</p>
        </div>
        <div className="flex items-center bg-surface-3 rounded-md p-0.5">
          <button
            onClick={() => setView('calendar')}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors',
              view === 'calendar' ? 'bg-surface-4 text-text-primary' : 'text-text-tertiary hover:text-text-secondary'
            )}
          >
            <Calendar size={12} /> Calendar
          </button>
          <button
            onClick={() => setView('timeline')}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors',
              view === 'timeline' ? 'bg-surface-4 text-text-primary' : 'text-text-tertiary hover:text-text-secondary'
            )}
          >
            <List size={12} /> Timeline
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="h-[200px] bg-surface-2 rounded-lg animate-pulse" />
          <div className="h-[300px] bg-surface-2 rounded-lg animate-pulse" />
        </div>
      ) : (
        <div className="space-y-6">
          <HeartbeatGrid heartbeats={heartbeats} />
          {view === 'calendar' ? (
            <CronCalendar />
          ) : (
            <CronTimeline jobs={cronJobs} />
          )}
        </div>
      )}
    </div>
  );
}
