'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '@/lib/types';

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isWaiting, setIsWaiting] = useState(false);
  const [agentId, setAgentId] = useState('main');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (message: string) => {
      setMessages((prev) => [...prev, { role: 'user', content: message, timestamp: new Date().toISOString() }]);
      setIsWaiting(true);

      // Abort any in-flight request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch('/api/chat/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentId, message }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({}));
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: data.error || 'Failed to send', timestamp: new Date().toISOString(), error: true },
          ]);
          setIsWaiting(false);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process complete SSE events
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const block of lines) {
            const dataLine = block.split('\n').find((l) => l.startsWith('data: '));
            if (!dataLine) continue;

            try {
              const event = JSON.parse(dataLine.slice(6));

              if (event.status === 'done') {
                setMessages((prev) => [
                  ...prev,
                  { role: 'assistant', content: event.response || '', timestamp: new Date().toISOString(), agentId },
                ]);
                setIsWaiting(false);
              } else if (event.status === 'failed') {
                setMessages((prev) => [
                  ...prev,
                  { role: 'assistant', content: event.error || 'Something went wrong', timestamp: new Date().toISOString(), agentId, error: true },
                ]);
                setIsWaiting(false);
              }
            } catch {
              // Skip malformed events
            }
          }
        }

        // If we get here without a done/failed event, mark as done
        if (isWaiting) setIsWaiting(false);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: 'Network error', timestamp: new Date().toISOString(), error: true },
          ]);
        }
        setIsWaiting(false);
      }
    },
    [agentId],
  );

  const clearMessages = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setIsWaiting(false);
  }, []);

  const switchAgent = useCallback(
    (newAgentId: string) => {
      if (newAgentId !== agentId) {
        abortRef.current?.abort();
        setAgentId(newAgentId);
        setMessages([]);
        setIsWaiting(false);
      }
    },
    [agentId],
  );

  return {
    messages,
    agentId,
    sendMessage,
    switchAgent,
    clearMessages,
    isWaiting,
    messagesEndRef,
  };
}
