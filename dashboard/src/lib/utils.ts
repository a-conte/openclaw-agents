import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNow, format } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function relativeTime(ts: number | string): string {
  const date = typeof ts === 'number' ? new Date(ts) : new Date(ts);
  return formatDistanceToNow(date, { addSuffix: true });
}

export function formatDate(ts: number | string, fmt: string = 'MMM d, yyyy HH:mm'): string {
  const date = typeof ts === 'number' ? new Date(ts) : new Date(ts);
  return format(date, fmt);
}

export function extractTextContent(content: string | Array<{ type: string; text?: string }>): string {
  if (typeof content === 'string') return content;
  return content
    .filter((c) => c.type === 'text' && c.text)
    .map((c) => c.text!)
    .join('\n');
}

export function getAgentStatus(lastActivity?: number): 'online' | 'warning' | 'offline' {
  if (!lastActivity) return 'offline';
  const age = Date.now() - lastActivity;
  if (age < 5 * 60 * 1000) return 'online';
  if (age < 60 * 60 * 1000) return 'warning';
  return 'offline';
}

export function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return str.slice(0, len) + '…';
}
