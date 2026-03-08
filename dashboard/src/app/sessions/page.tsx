'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { SessionSidebar } from '@/components/sessions/SessionSidebar';
import { ChatView } from '@/components/sessions/ChatView';
import { AGENT_EMOJIS } from '@/lib/constants';
import { MessageSquare } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import type { Session } from '@/lib/types';

const fetcher = (url: string) => fetch(url).then(r => r.json());
const AGENT_IDS = ['main', 'mail', 'docs', 'research', 'ai-research', 'dev', 'security'];

export default function SessionsPage() {
  const [agentId, setAgentId] = useState('main');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  const { data: sessions, isLoading } = useSWR(
    `/api/agents/${agentId}/sessions`,
    fetcher,
    { refreshInterval: 15000 }
  );

  const handleSelect = (key: string, session: Session) => {
    setSelectedKey(key);
    setSelectedSession(session);
  };

  return (
    <div className="flex h-full">
      <div className="w-[280px] border-r border-border flex flex-col bg-surface-2">
        <div className="p-3 border-b border-border">
          <select
            value={agentId}
            onChange={e => { setAgentId(e.target.value); setSelectedKey(null); setSelectedSession(null); }}
            className="w-full bg-surface-3 border border-border rounded-md px-2.5 py-1.5 text-xs text-text-primary focus:outline-none"
          >
            {AGENT_IDS.map(id => (
              <option key={id} value={id}>{AGENT_EMOJIS[id]} {id}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="space-y-2 p-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-14 bg-surface-3 rounded-md animate-pulse" />
              ))}
            </div>
          ) : sessions ? (
            <SessionSidebar
              sessions={sessions}
              selectedSession={selectedKey}
              onSelect={handleSelect}
              agentId={agentId}
            />
          ) : null}
        </div>
      </div>

      <div className="flex-1 bg-surface-1">
        {selectedSession ? (
          <ChatView agentId={agentId} sessionId={selectedSession.sessionId} />
        ) : (
          <EmptyState
            icon={<MessageSquare size={32} />}
            title="Select a session"
            description="Choose a session from the sidebar to view messages"
          />
        )}
      </div>
    </div>
  );
}
