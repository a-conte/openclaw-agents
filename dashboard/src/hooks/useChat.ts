'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import type { ChatMessage } from '@/lib/types';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [agentId, setAgentId] = useState('main');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const { data: activeChat } = useSWR(
    activeChatId ? `/api/chat/${activeChatId}` : null,
    fetcher,
    {
      refreshInterval: (data: any) => {
        if (!data || data.status === 'done' || data.status === 'failed') return 0;
        return 2000;
      },
    },
  );

  useEffect(() => {
    if (!activeChat) return;
    if (activeChat.status === 'done') {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: activeChat.response || '', timestamp: activeChat.completedAt, agentId: activeChat.agentId },
      ]);
      setActiveChatId(null);
    } else if (activeChat.status === 'failed') {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: activeChat.error || 'Something went wrong', timestamp: activeChat.completedAt, agentId: activeChat.agentId, error: true },
      ]);
      setActiveChatId(null);
    }
  }, [activeChat?.status, activeChat?.completedAt]);

  const sendMessage = useCallback(
    async (message: string) => {
      setMessages((prev) => [...prev, { role: 'user', content: message, timestamp: new Date().toISOString() }]);

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentId, message }),
        });
        const data = await res.json();
        if (data.chatId) {
          setActiveChatId(data.chatId);
        } else {
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: data.error || 'Failed to send', timestamp: new Date().toISOString(), error: true },
          ]);
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'Network error', timestamp: new Date().toISOString(), error: true },
        ]);
      }
    },
    [agentId],
  );

  const clearMessages = useCallback(() => setMessages([]), []);

  const switchAgent = useCallback(
    (newAgentId: string) => {
      if (newAgentId !== agentId) {
        setAgentId(newAgentId);
        setMessages([]);
        setActiveChatId(null);
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
    isWaiting: !!activeChatId,
    messagesEndRef,
  };
}
