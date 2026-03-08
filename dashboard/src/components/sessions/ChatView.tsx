'use client';

import { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { MessageBubble } from './MessageBubble';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/shared/Button';
import type { SessionMessage } from '@/lib/types';

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface ChatViewProps {
  agentId: string;
  sessionId: string;
}

export function ChatView({ agentId, sessionId }: ChatViewProps) {
  const [offset, setOffset] = useState(0);
  const [allMessages, setAllMessages] = useState<SessionMessage[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useSWR(
    `/api/agents/${agentId}/sessions/${sessionId}?offset=${offset}&limit=50`,
    fetcher
  );

  useEffect(() => {
    setOffset(0);
    setAllMessages([]);
  }, [sessionId]);

  useEffect(() => {
    if (data?.messages) {
      if (offset === 0) {
        setAllMessages(data.messages);
      } else {
        setAllMessages(prev => [...prev, ...data.messages]);
      }
    }
  }, [data, offset]);

  const hasMore = data && allMessages.length < data.total;

  return (
    <div className="flex flex-col h-full">
      <div ref={containerRef} className="flex-1 overflow-auto p-4">
        {isLoading && offset === 0 ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 size={20} className="animate-spin text-text-tertiary" />
          </div>
        ) : (
          <>
            {allMessages.map((msg, i) => (
              <MessageBubble key={msg.id || i} message={msg} />
            ))}
            {hasMore && (
              <div className="text-center py-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setOffset(prev => prev + 50)}
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 size={12} className="animate-spin mr-1" /> : null}
                  Load more ({data.total - allMessages.length} remaining)
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
