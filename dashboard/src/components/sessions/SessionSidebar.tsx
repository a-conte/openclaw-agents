'use client';

import { cn, relativeTime } from '@/lib/utils';
import { AGENT_EMOJIS } from '@/lib/constants';
import { MessageSquare } from 'lucide-react';
import type { Session } from '@/lib/types';

interface SessionSidebarProps {
  sessions: Record<string, Session>;
  selectedSession: string | null;
  onSelect: (key: string, session: Session) => void;
  agentId: string;
}

export function SessionSidebar({ sessions, selectedSession, onSelect, agentId }: SessionSidebarProps) {
  const entries = Object.entries(sessions)
    .filter(([_, s]) => s.sessionId)
    .sort(([_, a], [__, b]) => b.updatedAt - a.updatedAt);

  if (entries.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-text-tertiary">
        No sessions found
      </div>
    );
  }

  return (
    <div className="space-y-0.5 p-2">
      {entries.map(([key, session]) => (
        <button
          key={key}
          onClick={() => onSelect(key, session)}
          className={cn(
            'w-full text-left px-3 py-2.5 rounded-md transition-colors',
            selectedSession === key
              ? 'bg-accent-subtle text-text-primary'
              : 'hover:bg-surface-3 text-text-secondary'
          )}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm">{AGENT_EMOJIS[agentId] || '🤖'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{key.split(':').slice(-1)[0]}</p>
              <p className="text-[11px] text-text-tertiary mt-0.5">
                {relativeTime(session.updatedAt)}
              </p>
            </div>
            {session.chatType && (
              <span className="text-[10px] text-text-tertiary">{session.chatType}</span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
