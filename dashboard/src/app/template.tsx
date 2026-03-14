'use client';

import { Sidebar } from '@/components/layout/Sidebar';
import { CommandPalette } from '@/components/layout/CommandPalette';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { GlobalWorkspaceFilters } from '@/components/layout/GlobalWorkspaceFilters';
import { DashboardProviders, useChatPanel } from '@/components/providers/DashboardProviders';
import { useState, useEffect } from 'react';

function DashboardShell({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const { openChat, closeChat, isChatOpen } = useChatPanel();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '[' && !e.metaKey && !e.ctrlKey) {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
        setSidebarCollapsed(v => !v);
      }
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandPaletteOpen(v => !v);
      }
      if (e.key === 'j' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (isChatOpen) closeChat();
        else openChat();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isChatOpen, openChat, closeChat]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(v => !v)} />
      <main className="flex flex-1 flex-col overflow-auto bg-surface-1/60">
        <GlobalWorkspaceFilters />
        <div className="min-h-0 flex-1">{children}</div>
      </main>
      <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
      <ChatPanel />
    </div>
  );
}

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <DashboardProviders>
      <DashboardShell>{children}</DashboardShell>
    </DashboardProviders>
  );
}
