'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Diamond,
  Users,
  Building2,
  FolderKanban,
  Play,
  FileText,
  Radar,
  Brain,
  Calendar,
  Settings,
  Circle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(r => r.json());

const navItems = [
  { href: '/command', icon: Diamond, label: 'Command' },
  { href: '/agents', icon: Users, label: 'Agents' },
  { href: '/office', icon: Building2, label: 'Office' },
  { href: '/projects', icon: FolderKanban, label: 'Projects' },
  { href: '/pipeline', icon: Play, label: 'Pipeline' },
  { href: '/content', icon: FileText, label: 'Content' },
  { href: '/radar', icon: Radar, label: 'Radar' },
  { href: '/memory', icon: Brain, label: 'Memory' },
  { href: '/calendar', icon: Calendar, label: 'Calendar' },
  { href: '/system', icon: Settings, label: 'System' },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { data: health } = useSWR('/api/health', fetcher, { refreshInterval: 15000 });
  const [clock, setClock] = useState('');

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <aside
      className={cn(
        'flex flex-col border-r border-border bg-surface-1 transition-all duration-200',
        collapsed ? 'w-[52px]' : 'w-[220px]'
      )}
    >
      <button
        onClick={onToggle}
        className="flex items-center h-14 px-3 border-b border-border hover:bg-surface-2 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-accent/20 flex items-center justify-center">
            <Diamond size={14} className="text-accent" />
          </div>
          {!collapsed && (
            <span className="text-sm font-semibold text-text-primary font-[var(--font-heading)] tracking-tight">
              OpenClaw
            </span>
          )}
        </div>
      </button>

      <nav className="flex-1 py-2 px-2 space-y-0.5 overflow-auto">
        {navItems.map((item) => {
          const active = item.href === '/command'
            ? pathname === '/command' || pathname === '/'
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-2.5 py-2 rounded-md text-sm transition-colors duration-200',
                active
                  ? 'bg-accent-subtle text-accent border-r-2 border-accent'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-2'
              )}
            >
              <item.icon size={16} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border space-y-2">
        <div className="flex items-center gap-2">
          <Circle
            size={8}
            className={cn(
              'fill-current',
              health?.ok ? 'text-status-online' : 'text-status-error'
            )}
          />
          {!collapsed && (
            <span className="text-xs text-text-tertiary">
              {health?.ok ? 'Online' : 'Offline'}
            </span>
          )}
        </div>
        {!collapsed && (
          <div className="text-xs text-text-tertiary font-mono tabular-nums">
            {clock}
          </div>
        )}
      </div>
    </aside>
  );
}
