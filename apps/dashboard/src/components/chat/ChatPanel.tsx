'use client';

import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, X, Loader2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useChatPanel } from '@/components/providers/DashboardProviders';
import { useChat } from '@/hooks/useChat';
import { ACTIVE_AGENT_IDS, AGENT_EMOJIS, AGENT_ROLES } from '@/lib/constants';
import type { ChatMessage } from '@/lib/types';

export function ChatPanel() {
  const { isChatOpen, chatAgentId, chatLaunchContext, closeChat, clearChatLaunchContext } = useChatPanel();
  const { messages, agentId, sendMessage, switchAgent, clearMessages, isWaiting, messagesEndRef } = useChat();
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sync agent from context
  useEffect(() => {
    if (chatAgentId && chatAgentId !== agentId) {
      switchAgent(chatAgentId);
    }
  }, [chatAgentId]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, isWaiting]);

  // Focus textarea when panel opens
  useEffect(() => {
    if (isChatOpen) {
      setTimeout(() => textareaRef.current?.focus(), 150);
    }
  }, [isChatOpen]);

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || isWaiting) return;
    setInput('');
    sendMessage(trimmed);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  }

  return (
    <>
      {/* Backdrop */}
      {isChatOpen && (
        <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={closeChat} />
      )}

      {/* Panel */}
      <div
        className={cn(
          'fixed right-0 top-0 z-50 flex h-screen w-[440px] flex-col border-l border-border bg-surface-1/95 shadow-2xl backdrop-blur transition-transform duration-200',
          isChatOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <MessageCircle size={16} className="text-accent" />
          <select
            value={agentId}
            onChange={(e) => switchAgent(e.target.value)}
            className="flex-1 rounded-md border border-border bg-surface-2 px-2 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
          >
            {ACTIVE_AGENT_IDS.map((id) => (
              <option key={id} value={id}>
                {AGENT_EMOJIS[id]} {id}
              </option>
            ))}
          </select>
          <button
            onClick={clearMessages}
            className="rounded-md p-1.5 text-text-tertiary transition-colors hover:bg-surface-3 hover:text-text-secondary"
            title="Clear conversation"
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={closeChat}
            className="rounded-md p-1.5 text-text-tertiary transition-colors hover:bg-surface-3 hover:text-text-secondary"
          >
            <X size={16} />
          </button>
        </div>

        {/* Agent role subtitle */}
        <div className="border-b border-border px-4 py-2 text-xs text-text-tertiary">
          {AGENT_ROLES[agentId] || 'Agent'}
        </div>

        {chatLaunchContext ? (
          <div className="border-b border-border bg-surface-2/80 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-[0.16em] text-text-tertiary">Live handoff</div>
                <div className="mt-1 text-sm font-medium text-text-primary">{chatLaunchContext.title}</div>
                {chatLaunchContext.detail ? (
                  <div className="mt-1 text-xs leading-relaxed text-text-secondary">{chatLaunchContext.detail}</div>
                ) : null}
                <div className="mt-2 text-[11px] text-text-tertiary">
                  {chatLaunchContext.jobId ? `Job ${chatLaunchContext.jobId}` : 'Structured work dispatched'} · {new Date(chatLaunchContext.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <button
                onClick={clearChatLaunchContext}
                className="shrink-0 rounded-md p-1 text-text-tertiary transition-colors hover:bg-surface-3 hover:text-text-secondary"
                title="Dismiss handoff context"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        ) : null}

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-auto px-4 py-4">
          {messages.length === 0 && !isWaiting ? (
            <div className="flex flex-col items-center justify-center gap-3 pt-24 text-center">
              <span className="text-4xl">{AGENT_EMOJIS[agentId] || '🤖'}</span>
              <p className="text-sm text-text-secondary">Start a conversation with <span className="font-medium text-text-primary">{agentId}</span></p>
              <p className="max-w-[280px] text-xs text-text-tertiary">Messages are sent directly to the agent via OpenClaw. Responses appear here instead of Telegram.</p>
            </div>
          ) : (
            <>
              {messages.map((msg, i) => (
                <ChatBubble key={i} message={msg} agentId={agentId} />
              ))}
              {isWaiting && <TypingIndicator agentId={agentId} />}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-border p-3">
          <div className="flex items-end gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2 focus-within:border-accent">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${agentId}...`}
              rows={1}
              className="max-h-[120px] flex-1 resize-none bg-transparent text-sm text-text-primary outline-none placeholder:text-text-tertiary"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isWaiting}
              className={cn(
                'shrink-0 rounded-lg p-1.5 transition-colors',
                input.trim() && !isWaiting
                  ? 'bg-accent text-white hover:bg-accent/90'
                  : 'text-text-tertiary',
              )}
            >
              {isWaiting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
          <div className="mt-1.5 text-center text-[10px] text-text-tertiary">
            Enter to send, Shift+Enter for newline
          </div>
        </div>
      </div>
    </>
  );
}

function ChatBubble({ message, agentId }: { message: ChatMessage; agentId: string }) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex gap-2', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="mt-1 shrink-0 text-base">{AGENT_EMOJIS[message.agentId || agentId] || '🤖'}</div>
      )}
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
          isUser
            ? 'bg-accent/15 text-text-primary'
            : message.error
              ? 'border border-red-500/20 bg-red-500/8 text-red-200'
              : 'bg-surface-3 text-text-primary',
        )}
      >
        <div className="whitespace-pre-wrap break-words">{message.content}</div>
        <div className={cn('mt-1 text-[10px]', isUser ? 'text-right text-text-tertiary' : 'text-text-tertiary')}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}

function TypingIndicator({ agentId }: { agentId: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="text-base">{AGENT_EMOJIS[agentId] || '🤖'}</div>
      <div className="flex items-center gap-1 rounded-2xl bg-surface-3 px-4 py-3">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-tertiary [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-tertiary [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-tertiary [animation-delay:300ms]" />
      </div>
    </div>
  );
}
