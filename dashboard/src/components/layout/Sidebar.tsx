'use client';

import { useState, useEffect, type MouseEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  MessageCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import useSWR from 'swr';
import { useDashboardFilters, useChatPanel } from '@/components/providers/DashboardProviders';

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
  const router = useRouter();
  const pathname = usePathname();
  const { filters, setFocus } = useDashboardFilters();
  const { openChat } = useChatPanel();
  const { data: health } = useSWR('/api/health', fetcher, { refreshInterval: 15000 });
  const { data: summary } = useSWR('/api/dashboard-summary', fetcher, { refreshInterval: 15000 });
  const { data: radarData } = useSWR('/api/radar', fetcher, { refreshInterval: 30000 });
  const [clock, setClock] = useState('');

  const dirtyRepoCount = summary?.counts?.dirtyRepos || 0;
  const failedRunCount = summary?.counts?.failedRuns || 0;
  const inProgressCount = summary?.counts?.inProgressTasks || 0;
  const staleTaskCount = summary?.counts?.staleTasks || 0;
  const radarCount = radarData?.items?.length || 0;
  const quietAgentCount = summary?.counts?.quietAgents || 0;

  const badgeCounts: Record<string, number> = {
    '/command': failedRunCount + dirtyRepoCount + staleTaskCount,
    '/agents': health?.ok ? quietAgentCount : 1,
    '/projects': inProgressCount,
    '/pipeline': failedRunCount + inProgressCount,
    '/radar': radarCount,
    '/system': health?.ok ? dirtyRepoCount : dirtyRepoCount + 1,
  };

  const focusMap: Record<string, string> = {
    '/command': 'attention',
    '/agents': 'quiet-agents',
    '/projects': 'active-projects',
    '/pipeline': 'pipeline-hotspots',
    '/radar': 'signals',
    '/system': 'system-check',
  };

  const handleBadgeClick = (event: MouseEvent, href: string) => {
    event.preventDefault();
    event.stopPropagation();
    setFocus(focusMap[href] || '');
    router.push(href);
  };

  const handleNavClick = (href: string) => {
    if (filters.focus && focusMap[href] !== filters.focus) {
      setFocus('');
    }
  };

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
        'flex flex-col border-r border-border bg-surface-1/80 glass transition-all duration-200',
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
              Mission Control
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
            <div
              key={item.href}
              className={cn(
                'flex items-center gap-2 rounded-md text-sm transition-colors duration-200',
                active
                  ? 'bg-accent-subtle text-accent border-r-2 border-accent'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-2'
              )}
            >
              <Link
                href={item.href}
                onClick={() => handleNavClick(item.href)}
                className="flex min-w-0 flex-1 items-center gap-3 px-2.5 py-2"
              >
                <item.icon size={16} />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
              {!collapsed && badgeCounts[item.href] > 0 && (
                <button
                  onClick={(event) => handleBadgeClick(event, item.href)}
                  className={cn(
                    'ml-auto min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] transition',
                    filters.focus === focusMap[item.href]
                      ? 'bg-accent text-surface-0'
                      : 'bg-accent/15 text-accent hover:bg-accent/25'
                  )}
                  title={`Focus ${item.label.toLowerCase()}`}
                >
                  {badgeCounts[item.href]}
                </button>
              )}
            </div>
          );
        })}
      </nav>

      <div className="px-2 pb-1">
        <button
          onClick={() => openChat()}
          className={cn(
            'flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary',
          )}
          title="Chat with agents (Cmd+J)"
        >
          <MessageCircle size={16} />
          {!collapsed && <span>Chat</span>}
          {!collapsed && (
            <kbd className="ml-auto rounded border border-border bg-surface-3 px-1.5 py-0.5 text-[10px] text-text-tertiary">
              J
            </kbd>
          )}
        </button>
      </div>

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
