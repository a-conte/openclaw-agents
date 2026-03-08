'use client';

import { cn } from '@/lib/utils';
import { MarkdownRenderer } from '@/components/shared/MarkdownRenderer';
import { extractTextContent, formatDate } from '@/lib/utils';
import type { SessionMessage } from '@/lib/types';

interface MessageBubbleProps {
  message: SessionMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  if (!message.message) return null;
  const { role, content } = message.message;
  const text = extractTextContent(content);
  if (!text.trim()) return null;

  const isUser = role === 'user';
  const isSystem = role === 'system';

  return (
    <div className={cn(
      'flex mb-3',
      isUser ? 'justify-start' : 'justify-end'
    )}>
      <div className={cn(
        'max-w-[80%] rounded-lg px-4 py-3',
        isUser && 'bg-surface-3 border border-border',
        !isUser && !isSystem && 'bg-accent/10 border border-accent/20',
        isSystem && 'bg-surface-2 border border-border w-full opacity-60'
      )}>
        <div className="flex items-center gap-2 mb-1.5">
          <span className={cn(
            'text-[10px] font-medium uppercase tracking-wider',
            isUser ? 'text-text-tertiary' : 'text-accent'
          )}>
            {role}
          </span>
          <span className="text-[10px] text-text-tertiary">
            {formatDate(message.timestamp, 'HH:mm:ss')}
          </span>
        </div>
        <div className="text-sm">
          <MarkdownRenderer content={text.slice(0, 2000)} />
        </div>
      </div>
    </div>
  );
}
