'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bot,
  LayoutGrid,
  Calendar,
  MessageSquare,
  Activity,
  ChevronLeft,
  ChevronRight,
  Circle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(r => r.json());

const navItems = [
  { href: '/agents', icon: Bot, label: 'Agents' },
  { href: '/tasks', icon: LayoutGrid, label: 'Tasks' },
  { href: '/schedule', icon: Calendar, label: 'Schedule' },
  { href: '/sessions', icon: MessageSquare, label: 'Sessions' },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { data: health } = useSWR('/api/health', fetcher, { refreshInterval: 15000 });

  return (
    <aside
      className={cn(
        'flex flex-col border-r border-border bg-surface-2 transition-all duration-200',
        collapsed ? 'w-[52px]' : 'w-[240px]'
      )}
    >
      <div className="flex items-center h-14 px-3 border-b border-border">
        {!collapsed && (
          <span className="text-sm font-semibold text-text-primary tracking-tight">
            OpenClaw
          </span>
        )}
        <button
          onClick={onToggle}
          className="ml-auto p-1.5 rounded-md hover:bg-surface-3 text-text-secondary transition-colors"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <nav className="flex-1 py-2 px-2 space-y-0.5">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-2.5 py-2 rounded-md text-sm transition-colors',
                active
                  ? 'bg-accent-subtle text-text-primary'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-3'
              )}
            >
              <item.icon size={18} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border">
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
              {health?.ok ? 'Gateway Online' : 'Gateway Offline'}
            </span>
          )}
        </div>
      </div>
    </aside>
  );
}
