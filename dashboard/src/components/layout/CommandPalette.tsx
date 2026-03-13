'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Bot, LayoutGrid, Calendar, MessageSquare } from 'lucide-react';
import Fuse from 'fuse.js';
import { cn } from '@/lib/utils';
import { ACTIVE_AGENT_IDS, AGENT_EMOJIS } from '@/lib/constants';

interface CommandItem {
  id: string;
  label: string;
  category: string;
  action: () => void;
  icon?: React.ReactNode;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: CommandItem[] = [
    { id: 'nav-command', label: 'Go to Command', category: 'Navigation', action: () => router.push('/command'), icon: <LayoutGrid size={16} /> },
    { id: 'nav-agents', label: 'Go to Agents', category: 'Navigation', action: () => router.push('/agents'), icon: <Bot size={16} /> },
    { id: 'nav-projects', label: 'Go to Projects', category: 'Navigation', action: () => router.push('/projects'), icon: <LayoutGrid size={16} /> },
    { id: 'nav-calendar', label: 'Go to Calendar', category: 'Navigation', action: () => router.push('/calendar'), icon: <Calendar size={16} /> },
    { id: 'nav-pipeline', label: 'Go to Pipeline', category: 'Navigation', action: () => router.push('/pipeline'), icon: <MessageSquare size={16} /> },
    { id: 'nav-radar', label: 'Go to Radar', category: 'Navigation', action: () => router.push('/radar'), icon: <Search size={16} /> },
    { id: 'nav-system', label: 'Go to System', category: 'Navigation', action: () => router.push('/system'), icon: <Search size={16} /> },
    ...ACTIVE_AGENT_IDS.map(id => ({
      id: `agent-${id}`,
      label: `${AGENT_EMOJIS[id] || ''} ${id}`,
      category: 'Agents',
      action: () => router.push(`/agents/${id}`),
    })),
  ];

  const fuse = new Fuse(commands, { keys: ['label', 'category'], threshold: 0.4 });
  const results = query ? fuse.search(query).map(r => r.item) : commands;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!open) return;
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && results[selectedIndex]) {
      results[selectedIndex].action();
      onClose();
    }
  }, [open, onClose, results, selectedIndex]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => { setSelectedIndex(0); }, [query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-surface-2 border border-border rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search size={16} className="text-text-tertiary" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search commands..."
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-tertiary outline-none"
          />
          <kbd className="text-[10px] text-text-tertiary bg-surface-3 px-1.5 py-0.5 rounded">ESC</kbd>
        </div>
        <div className="max-h-[300px] overflow-auto py-2">
          {results.map((item, i) => (
            <button
              key={item.id}
              onClick={() => { item.action(); onClose(); }}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-2 text-sm text-left transition-colors',
                i === selectedIndex ? 'bg-surface-3 text-text-primary' : 'text-text-secondary hover:bg-surface-3'
              )}
            >
              {item.icon && <span className="text-text-tertiary">{item.icon}</span>}
              <span>{item.label}</span>
              <span className="ml-auto text-xs text-text-tertiary">{item.category}</span>
            </button>
          ))}
          {results.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-text-tertiary">No results found</div>
          )}
        </div>
      </div>
    </div>
  );
}
